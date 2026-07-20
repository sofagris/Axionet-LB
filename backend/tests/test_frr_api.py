from collections.abc import Generator
from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.v1 import frr as frr_routes
from app.api.v1 import instances as instances_routes
from app.api.v1 import system as system_routes
from app.core.security import enforce_auth
from app.db.base import Base
from app.db.session import get_db
from app.main import create_app
from app.models.network import Network, NetworkType
from app.plugins.base import ValidationResult
from app.plugins.frr.plugin import FrrPlugin
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
            name="lab-bgp",
            network_type=NetworkType.BRIDGE.value,
            subnet="10.50.10.0/24",
            gateway="10.50.10.1",
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
    adapter.create_managed_container.return_value = "frr-container-1"
    adapter.inspect_container.return_value = {"State": {"Status": "running"}}
    adapter.container_logs.return_value = "bgpd started"
    adapter.exec_in_container.side_effect = [
        "BGP router identifier 10.50.10.10, local AS number 65001",
        "BGP neighbor is 10.50.10.1, remote AS 65000, local AS 65001",
    ]

    monkeypatch.setattr(
        FrrPlugin,
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
    app.dependency_overrides[frr_routes.get_docker_adapter] = lambda: docker_adapter
    app.dependency_overrides[system_routes.get_docker_adapter] = lambda: docker_adapter
    app.dependency_overrides[enforce_auth] = lambda: None

    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


def test_create_frr_instance(client: TestClient, docker_adapter: MagicMock) -> None:
    created = client.post(
        "/api/v1/instances",
        json={
            "name": "bgp-edge-1",
            "service_type": "frr",
            "image_version": "10.2.6",
            "desired_state": "stopped",
            "networks": [{"network_id": "net-1", "ip_address": "10.50.10.10"}],
            "configuration": {
                "hostname": "bgp-edge-1",
                "router_id": "10.50.10.10",
                "local_as": 65001,
                "neighbors": [
                    {
                        "name": "peer1",
                        "address": "10.50.10.1",
                        "remote_as": 65000,
                    }
                ],
                "networks": ["203.0.113.0/24"],
            },
        },
    )
    assert created.status_code == 201, created.text
    body = created.json()
    assert body["service_type"] == "frr"
    assert body["image"] == "quay.io/frrouting/frr:10.2.6"
    assert body["container_name"].startswith("ax-frr-")
    assert body["configuration"]["local_as"] == 65001

    create_kwargs = docker_adapter.create_managed_container.call_args.kwargs
    assert create_kwargs["config_bind"] == "/etc/frr"
    assert "NET_ADMIN" in create_kwargs["cap_add"]
    assert create_kwargs["command"] is None

    preview = client.get(f"/api/v1/instances/{body['id']}/frr/config")
    assert preview.status_code == 200
    assert "router bgp 65001" in preview.json()["rendered"]

    bgp = client.get(f"/api/v1/instances/{body['id']}/frr/bgp")
    assert bgp.status_code == 200
    assert "65001" in bgp.json()["summary"]
