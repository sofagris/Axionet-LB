from collections.abc import Generator
from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.v1 import instances as instances_routes
from app.api.v1 import system as system_routes
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
        lambda self, configuration: ValidationResult(ok=True, output="ok"),
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
    assert response.json()[0]["service_type"] == "haproxy"
