from collections.abc import Generator
from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient

from app.api.v1 import networks as networks_routes
from app.core.security import enforce_auth
from app.db.session import get_db
from app.main import create_app
from app.services.docker.client import DockerClientAdapter
from app.services.networking.host import HostNetworkAdapter
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.db.base import Base
from app.models.physical_interface import PhysicalInterface


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
        PhysicalInterface(
            id="ifc-eth0",
            name="eth0",
            mac_address="aa:bb:cc:dd:ee:ff",
            link_state="up",
            administrative_state="enabled",
            exclusive_use=False,
        )
    )
    session.commit()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture()
def docker_adapter() -> MagicMock:
    adapter = MagicMock(spec=DockerClientAdapter)
    adapter.ping.return_value = None
    adapter.network_exists.return_value = True
    adapter.create_managed_network.return_value = "docker-net-1"
    return adapter


@pytest.fixture()
def host_adapter() -> MagicMock:
    adapter = MagicMock(spec=HostNetworkAdapter)
    adapter.ensure_vlan_subinterface.return_value = MagicMock(
        device_name="eth0.100",
        created=True,
    )
    return adapter


@pytest.fixture()
def client(
    db_session: Session,
    docker_adapter: MagicMock,
    host_adapter: MagicMock,
) -> Generator[TestClient, None, None]:
    app = create_app(enable_lifespan=False)

    def _override_db() -> Generator[Session, None, None]:
        yield db_session

    app.dependency_overrides[get_db] = _override_db
    app.dependency_overrides[networks_routes.get_docker_adapter] = lambda: docker_adapter
    app.dependency_overrides[networks_routes.get_host_net_adapter] = lambda: host_adapter

    # system health still needs docker override from system routes
    from app.api.v1 import system as system_routes

    app.dependency_overrides[system_routes.get_docker_adapter] = lambda: docker_adapter
    app.dependency_overrides[enforce_auth] = lambda: None

    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


def test_create_list_delete_ipvlan_network(client: TestClient, docker_adapter: MagicMock) -> None:
    payload = {
        "name": "vlan100",
        "network_type": "ipvlan-l2",
        "parent_interface_id": "ifc-eth0",
        "vlan_id": 100,
        "subnet": "10.100.0.0/24",
        "gateway": "10.100.0.1",
    }
    created = client.post("/api/v1/networks", json=payload)
    assert created.status_code == 201, created.text
    body = created.json()
    assert body["name"] == "vlan100"
    assert body["docker_network_id"] == "docker-net-1"
    assert body["parent_device"] == "eth0.100"
    docker_adapter.create_managed_network.assert_called_once()

    listed = client.get("/api/v1/networks")
    assert listed.status_code == 200
    assert len(listed.json()) == 1

    deleted = client.delete(f"/api/v1/networks/{body['id']}")
    assert deleted.status_code == 204
    docker_adapter.remove_managed_network.assert_called_once_with("docker-net-1")


def test_validate_endpoint(client: TestClient) -> None:
    response = client.post(
        "/api/v1/networks/validate",
        json={
            "name": "bad",
            "network_type": "ipvlan-l2",
            "subnet": "10.0.0.0/24",
            "gateway": "10.0.0.1",
        },
    )
    assert response.status_code == 200
    assert response.json()["valid"] is False
