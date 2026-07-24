from collections.abc import Generator
from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.v1 import instances as instances_routes
from app.api.v1 import system as system_routes
from app.api.v1 import vips as vips_routes
from app.core.security import enforce_auth
from app.db.base import Base
from app.db.session import get_db
from app.main import create_app
from app.models.network import Network, NetworkType
from app.models.service_instance import ActualState, DesiredState, HealthStatus, ServiceInstance
from app.plugins.base import ValidationResult
from app.plugins.frr.plugin import FrrPlugin
from app.plugins.haproxy.plugin import HaproxyPlugin
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
            id="net-sonic",
            name="BGP-SONIC-01",
            network_type=NetworkType.MACVLAN.value,
            subnet="192.168.22.0/24",
            gateway="192.168.22.1",
            docker_network_id="docker-net-sonic",
            docker_network_name="ax-net-sonic",
            enabled=True,
        )
    )
    session.add(
        ServiceInstance(
            id="hap-1",
            name="haproxy-lab",
            service_type="haproxy",
            desired_state=DesiredState.RUNNING.value,
            actual_state=ActualState.RUNNING.value,
            image="haproxy:3.2.6",
            image_version="3.2.6",
            restart_policy="unless-stopped",
            configuration={
                "frontends": [
                    {
                        "name": "main",
                        "bind_address": "*",
                        "bind_port": 80,
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
                            {"name": "s1", "address": "127.0.0.1", "port": 8080, "check": True}
                        ],
                    }
                ],
            },
            container_id="hap-container-1",
            health_status=HealthStatus.HEALTHY.value,
        )
    )
    session.add(
        ServiceInstance(
            id="frr-1",
            name="edge-sonic-a",
            service_type="frr",
            desired_state=DesiredState.RUNNING.value,
            actual_state=ActualState.RUNNING.value,
            image="quay.io/frrouting/frr:10.2.6",
            image_version="10.2.6",
            restart_policy="unless-stopped",
            configuration={
                "hostname": "edge-sonic-a",
                "router_id": "192.168.22.2",
                "local_as": 65001,
                "neighbors": [
                    {"name": "sonic", "address": "192.168.22.1", "remote_as": 65100},
                ],
                "networks": ["203.0.113.0/24"],
                "log_stdout": True,
            },
            container_id="frr-container-1",
            health_status=HealthStatus.HEALTHY.value,
        )
    )
    session.add(
        ServiceInstance(
            id="frr-2",
            name="edge-sonic-b",
            service_type="frr",
            desired_state=DesiredState.RUNNING.value,
            actual_state=ActualState.RUNNING.value,
            image="quay.io/frrouting/frr:10.2.6",
            image_version="10.2.6",
            restart_policy="unless-stopped",
            configuration={
                "hostname": "edge-sonic-b",
                "router_id": "192.168.22.3",
                "local_as": 65001,
                "neighbors": [
                    {"name": "sonic", "address": "192.168.22.1", "remote_as": 65100},
                ],
                "networks": ["203.0.113.0/24"],
                "log_stdout": True,
            },
            container_id="frr-container-2",
            health_status=HealthStatus.HEALTHY.value,
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
    adapter.connect_container_network.return_value = None
    adapter.disconnect_container_network.return_value = None
    adapter.inspect_container.return_value = {"State": {"Status": "running"}}

    def _exec(_container_id: str, command: list[str]) -> str:
        from docker.errors import DockerException

        if command == ["iptables", "-V"]:
            return "iptables v1.8.7"
        if command[:1] == ["iptables"] and "-C" in command:
            raise DockerException("iptables: Bad rule (does a matching rule exist in that chain?)")
        if command[:3] == ["ip", "addr", "add"]:
            return ""
        if command[:3] == ["ip", "addr", "del"]:
            return ""
        if len(command) >= 5 and command[0] == "iptables" and command[3] == "-S":
            return ""
        return "ok"

    adapter.exec_in_container.side_effect = _exec

    monkeypatch.setattr(
        FrrPlugin,
        "validate",
        lambda self, docker, *, image, configuration, extra_files=None: ValidationResult(
            ok=True, output="ok"
        ),
    )
    monkeypatch.setattr(
        HaproxyPlugin,
        "validate",
        lambda self, docker, *, image, configuration, extra_files=None: ValidationResult(
            ok=True, output="ok"
        ),
    )
    return adapter


@pytest.fixture()
def client(db_session: Session, docker_adapter: MagicMock) -> Generator[TestClient, None, None]:
    app = create_app(enable_lifespan=False)

    def _override_db() -> Generator[Session, None, None]:
        yield db_session

    app.dependency_overrides[get_db] = _override_db
    app.dependency_overrides[instances_routes.get_docker_adapter] = lambda: docker_adapter
    app.dependency_overrides[vips_routes.get_docker_adapter] = lambda: docker_adapter
    app.dependency_overrides[system_routes.get_docker_adapter] = lambda: docker_adapter
    app.dependency_overrides[enforce_auth] = lambda: None

    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


def test_create_enable_disable_delete_vip(client: TestClient, db_session: Session) -> None:
    created = client.post(
        "/api/v1/vips",
        json={
            "name": "vip-lab-10",
            "address": "192.168.22.10",
            "haproxy_instance_id": "hap-1",
            "frr_instance_id": "frr-1",
            "network_id": "net-sonic",
            "enabled": True,
            "advertise": True,
        },
    )
    assert created.status_code == 201, created.text
    body = created.json()
    assert body["address"] == "192.168.22.10"
    assert body["announce_prefix"] == "192.168.22.10/32"
    assert body["attached"] is True
    assert body["advertised"] is True
    assert body["last_error"] is None

    listed = client.get("/api/v1/vips")
    assert listed.status_code == 200
    assert len(listed.json()) == 1

    attachments = client.get("/api/v1/instances/hap-1")
    assert attachments.status_code == 200
    nets = attachments.json()["networks"]
    assert any(item["ip_address"] == "192.168.22.10" for item in nets)

    frr = client.get("/api/v1/instances/frr-1")
    assert "192.168.22.10/32" in frr.json()["configuration"]["networks"]

    disabled = client.post(f"/api/v1/vips/{body['id']}/disable")
    assert disabled.status_code == 200, disabled.text
    assert disabled.json()["enabled"] is False
    assert disabled.json()["advertised"] is False

    frr_after = client.get("/api/v1/instances/frr-1")
    assert "192.168.22.10/32" not in frr_after.json()["configuration"]["networks"]
    assert "203.0.113.0/24" in frr_after.json()["configuration"]["networks"]

    enabled = client.post(f"/api/v1/vips/{body['id']}/enable")
    assert enabled.status_code == 200
    assert enabled.json()["advertised"] is True

    deleted = client.delete(f"/api/v1/vips/{body['id']}")
    assert deleted.status_code == 204

    assert client.get("/api/v1/vips").json() == []
    frr_final = client.get("/api/v1/instances/frr-1")
    assert "192.168.22.10/32" not in frr_final.json()["configuration"]["networks"]


def test_create_vip_rejects_wrong_service_type(client: TestClient) -> None:
    response = client.post(
        "/api/v1/vips",
        json={
            "name": "bad-vip",
            "address": "192.168.22.11",
            "haproxy_instance_id": "frr-1",
            "frr_instance_id": "hap-1",
            "network_id": "net-sonic",
        },
    )
    assert response.status_code == 400


def test_health_gate_withdraws_and_reannounces(
    client: TestClient,
    db_session: Session,
    docker_adapter: MagicMock,
) -> None:
    from app.core.config import get_settings
    from app.services.instances.service import InstanceService
    from app.services.vips.service import VipService

    created = client.post(
        "/api/v1/vips",
        json={
            "name": "vip-health",
            "address": "192.168.22.12",
            "haproxy_instance_id": "hap-1",
            "frr_instance_id": "frr-1",
            "network_id": "net-sonic",
        },
    )
    assert created.status_code == 201, created.text
    assert created.json()["advertised"] is True
    vip_id = created.json()["id"]

    hap = db_session.get(ServiceInstance, "hap-1")
    assert hap is not None
    hap.desired_state = DesiredState.STOPPED.value
    hap.actual_state = ActualState.STOPPED.value
    db_session.commit()

    instances = InstanceService(db=db_session, docker=docker_adapter, settings=get_settings())
    VipService(db=db_session, instances=instances).sync_for_haproxy_instance("hap-1")

    withdrawn = client.get(f"/api/v1/vips/{vip_id}")
    assert withdrawn.status_code == 200
    assert withdrawn.json()["enabled"] is True
    assert withdrawn.json()["advertise"] is True
    assert withdrawn.json()["advertised"] is False
    frr = client.get("/api/v1/instances/frr-1")
    assert "192.168.22.12/32" not in frr.json()["configuration"]["networks"]

    hap = db_session.get(ServiceInstance, "hap-1")
    assert hap is not None
    hap.desired_state = DesiredState.RUNNING.value
    hap.actual_state = ActualState.RUNNING.value
    hap.health_status = HealthStatus.HEALTHY.value
    db_session.commit()

    VipService(db=db_session, instances=instances).sync_for_haproxy_instance("hap-1")

    restored = client.get(f"/api/v1/vips/{vip_id}")
    assert restored.json()["advertised"] is True
    frr_back = client.get("/api/v1/instances/frr-1")
    assert "192.168.22.12/32" in frr_back.json()["configuration"]["networks"]


def test_routed_vip_dnat_and_announce(client: TestClient, docker_adapter: MagicMock) -> None:
    # Give HAProxy a backend IP on the peer network (DNAT target).
    attached = client.post(
        "/api/v1/instances/hap-1/networks",
        json={"network_id": "net-sonic", "ip_address": "192.168.22.20"},
    )
    assert attached.status_code == 201, attached.text

    created = client.post(
        "/api/v1/vips",
        json={
            "name": "vip-routed-10",
            "address": "203.0.113.10",
            "mode": "routed",
            "haproxy_instance_id": "hap-1",
            "frr_instance_id": "frr-1",
            "network_id": "net-sonic",
            "enabled": True,
            "advertise": True,
        },
    )
    assert created.status_code == 201, created.text
    body = created.json()
    assert body["mode"] == "routed"
    assert body["backend_ip"] == "192.168.22.20"
    assert body["attached"] is False
    assert body["dataplane_ready"] is True
    assert body["advertised"] is True
    assert body["announce_prefix"] == "203.0.113.10/32"

    # HAProxy should keep .20, not take VIP .10
    hap = client.get("/api/v1/instances/hap-1")
    ips = [item["ip_address"] for item in hap.json()["networks"]]
    assert "192.168.22.20" in ips
    assert "203.0.113.10" not in ips

    frr = client.get("/api/v1/instances/frr-1")
    assert "203.0.113.10/32" in frr.json()["configuration"]["networks"]
    assert docker_adapter.exec_in_container.call_count >= 3

    disabled = client.post(f"/api/v1/vips/{body['id']}/disable")
    assert disabled.status_code == 200
    assert disabled.json()["advertised"] is False
    assert disabled.json()["dataplane_ready"] is False


def test_vip_multi_link_ecmp_announce_and_remove(
    client: TestClient,
    docker_adapter: MagicMock,
) -> None:
    attached = client.post(
        "/api/v1/instances/hap-1/networks",
        json={"network_id": "net-sonic", "ip_address": "192.168.22.20"},
    )
    assert attached.status_code == 201, attached.text

    created = client.post(
        "/api/v1/vips",
        json={
            "name": "vip-ecmp",
            "address": "203.0.113.50",
            "mode": "routed",
            "haproxy_instance_id": "hap-1",
            "frr_instance_id": "frr-1",
            "network_id": "net-sonic",
            "links": [{"frr_instance_id": "frr-2", "network_id": "net-sonic"}],
            "enabled": True,
            "advertise": True,
        },
    )
    assert created.status_code == 201, created.text
    body = created.json()
    assert len(body["links"]) == 2
    assert body["advertised"] is True
    assert all(link["advertised"] for link in body["links"])
    assert all(link["dataplane_ready"] for link in body["links"])

    frr1 = client.get("/api/v1/instances/frr-1").json()
    frr2 = client.get("/api/v1/instances/frr-2").json()
    assert "203.0.113.50/32" in frr1["configuration"]["networks"]
    assert "203.0.113.50/32" in frr2["configuration"]["networks"]

    second = next(link for link in body["links"] if link["frr_instance_id"] == "frr-2")
    removed = client.delete(f"/api/v1/vips/{body['id']}/links/{second['id']}")
    assert removed.status_code == 200, removed.text
    assert len(removed.json()["links"]) == 1
    frr2_after = client.get("/api/v1/instances/frr-2").json()
    assert "203.0.113.50/32" not in frr2_after["configuration"]["networks"]
    frr1_after = client.get("/api/v1/instances/frr-1").json()
    assert "203.0.113.50/32" in frr1_after["configuration"]["networks"]

    disabled = client.post(f"/api/v1/vips/{body['id']}/disable")
    assert disabled.status_code == 200
    assert disabled.json()["advertised"] is False
    assert all(not link["advertised"] for link in disabled.json()["links"])
