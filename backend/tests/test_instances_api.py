from collections.abc import Generator
from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.v1 import instances as instances_routes
from app.api.v1 import system as system_routes
from app.core.security import enforce_auth
from app.db.base import Base
from app.db.session import get_db
from app.main import create_app
from app.models.network import Network, NetworkType
from app.plugins.haproxy.validator import ValidationResult
from app.services.docker.client import DockerClientAdapter


@pytest.fixture()
def db_session() -> Generator[Session, None, None]:
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    TestingSessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    session = TestingSessionLocal()
    session.add(
        Network(
            id="net-1",
            name="lab-bridge",
            network_type=NetworkType.BRIDGE.value,
            subnet="172.30.50.0/24",
            gateway="172.30.50.1",
            docker_network_id="docker-net-1",
            docker_network_name="ax-net-net-1",
            enabled=True,
        )
    )
    session.add(
        Network(
            id="net-2",
            name="lab-backend",
            network_type=NetworkType.BRIDGE.value,
            subnet="172.30.60.0/24",
            gateway="172.30.60.1",
            docker_network_id="docker-net-2",
            docker_network_name="ax-net-net-2",
            enabled=True,
        )
    )
    session.commit()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture()
def docker_adapter(monkeypatch: pytest.MonkeyPatch) -> MagicMock:
    adapter = MagicMock(spec=DockerClientAdapter)
    adapter.ping.return_value = None
    adapter.network_exists.return_value = True
    adapter.create_managed_container.return_value = "container-1"
    adapter.inspect_container.side_effect = [
        {"State": {"Status": "created"}},  # ensure after create
        {"State": {"Status": "created"}},  # start reconcile check
        {"State": {"Status": "running"}},  # stop reconcile check
        {"State": {"Status": "exited"}},
    ]
    adapter.container_logs.return_value = "haproxy started"

    from app.plugins.haproxy import validator as validator_mod

    monkeypatch.setattr(
        validator_mod.HaproxyConfigValidator,
        "validate_config_dict",
        lambda self, configuration, cert_files=None, map_files=None: ValidationResult(ok=True, output="ok"),
    )
    monkeypatch.setattr(
        validator_mod.HaproxyConfigValidator,
        "validate_rendered",
        lambda self, rendered: ValidationResult(ok=True, output="ok"),
    )
    return adapter


@pytest.fixture()
def client(db_session: Session, docker_adapter: MagicMock) -> Generator[TestClient, None, None]:
    app = create_app(enable_lifespan=False)

    def _override_db() -> Generator[Session, None, None]:
        yield db_session

    app.dependency_overrides[get_db] = _override_db
    app.dependency_overrides[instances_routes.get_docker_adapter] = lambda: docker_adapter
    app.dependency_overrides[system_routes.get_docker_adapter] = lambda: docker_adapter
    app.dependency_overrides[enforce_auth] = lambda: None

    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


def test_create_start_stop_instance(client: TestClient, docker_adapter: MagicMock) -> None:
    created = client.post(
        "/api/v1/instances",
        json={
            "name": "edge-1",
            "service_type": "haproxy",
            "desired_state": "stopped",
            "networks": [{"network_id": "net-1", "ip_address": "172.30.50.10"}],
        },
    )
    assert created.status_code == 201, created.text
    body = created.json()
    assert body["actual_state"] == "stopped"
    assert body["container_id"] == "container-1"
    assert body["networks"][0]["ip_address"] == "172.30.50.10"
    docker_adapter.create_managed_container.assert_called_once()
    kwargs = docker_adapter.create_managed_container.call_args.kwargs
    assert kwargs["network_endpoints"][0]["ipv4_address"] == "172.30.50.10"

    started = client.post(f"/api/v1/instances/{body['id']}/start")
    assert started.status_code == 200, started.text
    assert started.json()["desired_state"] == "running"
    docker_adapter.start_container.assert_called()

    logs = client.get(f"/api/v1/instances/{body['id']}/logs")
    assert logs.status_code == 200
    assert "haproxy" in logs.json()["logs"]

    stopped = client.post(f"/api/v1/instances/{body['id']}/stop")
    assert stopped.status_code == 200
    docker_adapter.stop_container.assert_called()


def test_reload_sends_sigusr2(client: TestClient, docker_adapter: MagicMock) -> None:
    created = client.post(
        "/api/v1/instances",
        json={
            "name": "edge-reload",
            "service_type": "haproxy",
            "desired_state": "stopped",
            "networks": [{"network_id": "net-1", "ip_address": "172.30.50.20"}],
        },
    )
    assert created.status_code == 201, created.text
    instance_id = created.json()["id"]

    docker_adapter.inspect_container.side_effect = None
    docker_adapter.inspect_container.return_value = {"State": {"Status": "running"}}
    docker_adapter.signal_container.reset_mock()
    docker_adapter.restart_container.reset_mock()

    reloaded = client.post(f"/api/v1/instances/{instance_id}/reload")
    assert reloaded.status_code == 200, reloaded.text
    assert reloaded.json()["desired_state"] == "running"
    docker_adapter.signal_container.assert_called_once_with("container-1", "SIGUSR2")
    docker_adapter.restart_container.assert_not_called()


def test_reload_falls_back_to_restart(client: TestClient, docker_adapter: MagicMock) -> None:
    from docker.errors import DockerException

    created = client.post(
        "/api/v1/instances",
        json={
            "name": "edge-reload-fb",
            "desired_state": "stopped",
            "networks": [{"network_id": "net-1", "ip_address": "172.30.50.21"}],
        },
    )
    assert created.status_code == 201, created.text
    instance_id = created.json()["id"]

    docker_adapter.inspect_container.side_effect = None
    docker_adapter.inspect_container.return_value = {"State": {"Status": "running"}}
    docker_adapter.signal_container.side_effect = DockerException("signal failed")
    docker_adapter.restart_container.reset_mock()

    reloaded = client.post(f"/api/v1/instances/{instance_id}/reload")
    assert reloaded.status_code == 200, reloaded.text
    docker_adapter.restart_container.assert_called_once_with("container-1")


def test_create_two_instances_same_port_different_ips(client: TestClient, docker_adapter: MagicMock) -> None:
    first = client.post(
        "/api/v1/instances",
        json={
            "name": "edge-a",
            "desired_state": "stopped",
            "networks": [{"network_id": "net-1", "ip_address": "172.30.50.11"}],
            "configuration": {
                "mode": "http",
                "stats_port": 8404,
                "frontends": [
                    {
                        "name": "web",
                        "bind_address": "*",
                        "bind_port": 8080,
                        "mode": "http",
                        "default_backend": "app",
                    }
                ],
                "backends": [
                    {
                        "name": "app",
                        "balance": "roundrobin",
                        "mode": "http",
                        "servers": [
                            {
                                "name": "s1",
                                "address": "10.0.0.10",
                                "port": 80,
                                "check": True,
                                "weight": 100,
                                "inter_ms": 2000,
                                "rise": 2,
                                "fall": 3,
                            }
                        ],
                    }
                ],
            },
        },
    )
    assert first.status_code == 201, first.text

    second = client.post(
        "/api/v1/instances",
        json={
            "name": "edge-b",
            "desired_state": "stopped",
            "networks": [{"network_id": "net-1", "ip_address": "172.30.50.12"}],
            "configuration": first.json()["configuration"],
        },
    )
    assert second.status_code == 201, second.text

    listed = client.get("/api/v1/instances")
    assert listed.status_code == 200
    names = {item["name"] for item in listed.json()}
    assert names == {"edge-a", "edge-b"}
    assert docker_adapter.create_managed_container.call_count == 2

    conflict = client.post(
        "/api/v1/instances",
        json={
            "name": "edge-c",
            "desired_state": "stopped",
            "networks": [{"network_id": "net-1", "ip_address": "172.30.50.11"}],
        },
    )
    assert conflict.status_code == 400
    assert "already assigned" in conflict.json()["detail"]


def test_service_definitions(client: TestClient) -> None:
    response = client.get("/api/v1/service-definitions")
    assert response.status_code == 200
    types = [item["service_type"] for item in response.json()]
    assert types[0] == "haproxy"
    assert response.json()[0]["enabled"] is True
    assert "varnish" in types
    assert "nginx" in types
    assert "frr" in types
    assert "prometheus" in types
    assert "grafana" in types
    assert all(
        item["enabled"] is False for item in response.json() if item["service_type"] != "haproxy"
    )


def test_validate_config_draft(client: TestClient) -> None:
    response = client.post(
        "/api/v1/instances/validate-config",
        json={"service_type": "haproxy", "image_version": "3.2.6", "configuration": None},
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["ok"] is True
    assert body["rendered_preview"]
    assert "frontend" in body["rendered_preview"]


def test_attach_update_detach_networks(client: TestClient, docker_adapter: MagicMock) -> None:
    created = client.post(
        "/api/v1/instances",
        json={
            "name": "edge-net",
            "desired_state": "stopped",
            "networks": [{"network_id": "net-1", "ip_address": "172.30.50.40"}],
        },
    )
    assert created.status_code == 201, created.text
    instance_id = created.json()["id"]
    first_attachment = created.json()["networks"][0]["id"]

    docker_adapter.inspect_container.side_effect = None
    docker_adapter.inspect_container.return_value = {
        "State": {"Status": "running"},
        "NetworkSettings": {
            "Networks": {
                "ax-net-net-1": {
                    "NetworkID": "docker-net-1",
                    "IPAddress": "172.30.50.40",
                }
            }
        },
    }

    attached = client.post(
        f"/api/v1/instances/{instance_id}/networks",
        json={"network_id": "net-2", "ip_address": "172.30.60.10"},
    )
    assert attached.status_code == 201, attached.text
    networks = attached.json()["networks"]
    assert len(networks) == 2
    second = next(item for item in networks if item["network_id"] == "net-2")
    docker_adapter.connect_container_network.assert_called()

    updated = client.patch(
        f"/api/v1/instances/{instance_id}/networks/{first_attachment}",
        json={"ip_address": "172.30.50.41"},
    )
    assert updated.status_code == 200, updated.text
    assert any(
        item["id"] == first_attachment and item["ip_address"] == "172.30.50.41"
        for item in updated.json()["networks"]
    )
    docker_adapter.disconnect_container_network.assert_called()

    listed = client.get(f"/api/v1/instances/{instance_id}/networks")
    assert listed.status_code == 200
    assert len(listed.json()) == 2

    detached = client.delete(f"/api/v1/instances/{instance_id}/networks/{second['id']}")
    assert detached.status_code == 200, detached.text
    assert len(detached.json()["networks"]) == 1
    assert detached.json()["networks"][0]["network_id"] == "net-1"

    duplicate = client.post(
        f"/api/v1/instances/{instance_id}/networks",
        json={"network_id": "net-1", "ip_address": "172.30.50.42"},
    )
    assert duplicate.status_code == 400
