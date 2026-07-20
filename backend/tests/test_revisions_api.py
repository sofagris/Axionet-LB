from collections.abc import Generator
from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.v1 import instances as instances_routes
from app.api.v1 import revisions as revisions_routes
from app.api.v1 import system as system_routes
from app.db.base import Base
from app.db.session import get_db
from app.main import create_app
from app.models.network import Network, NetworkType
from app.plugins.haproxy.validator import ValidationResult
from app.services.docker.client import DockerClientAdapter


BASE_CONFIG = {
    "mode": "http",
    "stats_port": 8404,
    "timeout_connect": "5s",
    "timeout_client": "50s",
    "timeout_server": "50s",
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
                    "name": "web1",
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
}


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
    adapter.inspect_container.return_value = {"State": {"Status": "running"}}
    adapter.restart_container.return_value = None

    from app.plugins.haproxy import validator as validator_mod

    monkeypatch.setattr(
        validator_mod.HaproxyConfigValidator,
        "validate_config_dict",
        lambda self, configuration: ValidationResult(ok=True, output="Configuration file is valid"),
    )
    monkeypatch.setattr(
        validator_mod.HaproxyConfigValidator,
        "validate_rendered",
        lambda self, rendered: ValidationResult(ok=True, output="Configuration file is valid"),
    )
    return adapter


@pytest.fixture()
def client(db_session: Session, docker_adapter: MagicMock) -> Generator[TestClient, None, None]:
    app = create_app(enable_lifespan=False)

    def _override_db() -> Generator[Session, None, None]:
        yield db_session

    def _override_docker() -> MagicMock:
        return docker_adapter

    app.dependency_overrides[get_db] = _override_db
    app.dependency_overrides[system_routes.get_docker_adapter] = _override_docker
    app.dependency_overrides[instances_routes.get_docker_adapter] = _override_docker
    app.dependency_overrides[revisions_routes.get_docker_adapter] = _override_docker

    with TestClient(app) as test_client:
        yield test_client

    app.dependency_overrides.clear()


def _create_instance(client: TestClient) -> str:
    response = client.post(
        "/api/v1/instances",
        json={
            "name": "edge-rev",
            "desired_state": "running",
            "networks": [{"network_id": "net-1"}],
            "configuration": BASE_CONFIG,
        },
    )
    assert response.status_code == 201, response.text
    return response.json()["id"]


def test_revisions_created_on_instance_and_config_change(client: TestClient) -> None:
    instance_id = _create_instance(client)

    listed = client.get(f"/api/v1/instances/{instance_id}/revisions")
    assert listed.status_code == 200
    revisions = listed.json()
    assert len(revisions) == 1
    assert revisions[0]["revision_number"] == 1
    assert revisions[0]["deployment_status"] == "deployed"

    detail = client.get(f"/api/v1/instances/{instance_id}/revisions/{revisions[0]['id']}")
    assert detail.status_code == 200
    body = detail.json()
    assert "frontend web" in body["rendered_configuration"]
    assert body["diff_from_previous"] is None

    updated = {
        **BASE_CONFIG,
        "stats_port": 8500,
        "frontends": [
            {
                "name": "web",
                "bind_address": "*",
                "bind_port": 9090,
                "mode": "http",
                "default_backend": "app",
            }
        ],
        "backends": BASE_CONFIG["backends"],
    }
    patched = client.patch(f"/api/v1/instances/{instance_id}", json={"configuration": updated})
    assert patched.status_code == 200, patched.text

    listed2 = client.get(f"/api/v1/instances/{instance_id}/revisions")
    revisions2 = listed2.json()
    assert len(revisions2) == 2
    assert revisions2[0]["revision_number"] == 2
    assert revisions2[0]["deployment_status"] == "deployed"
    assert revisions2[1]["deployment_status"] == "superseded"

    newest = client.get(f"/api/v1/instances/{instance_id}/revisions/{revisions2[0]['id']}")
    assert newest.status_code == 200
    diff = newest.json()["diff_from_previous"]
    assert diff is not None
    assert "9090" in diff


def test_restore_revision_creates_new_deployed_revision(client: TestClient) -> None:
    instance_id = _create_instance(client)
    first_id = client.get(f"/api/v1/instances/{instance_id}/revisions").json()[0]["id"]

    updated = {
        **BASE_CONFIG,
        "stats_port": 8600,
        "frontends": BASE_CONFIG["frontends"],
        "backends": BASE_CONFIG["backends"],
    }
    client.patch(f"/api/v1/instances/{instance_id}", json={"configuration": updated})

    restored = client.post(f"/api/v1/instances/{instance_id}/revisions/{first_id}/restore")
    assert restored.status_code == 200, restored.text
    body = restored.json()
    assert body["revision_number"] == 3
    assert body["deployment_status"] == "deployed"
    assert body["configuration"]["stats_port"] == 8404

    instance = client.get(f"/api/v1/instances/{instance_id}")
    assert instance.json()["configuration"]["stats_port"] == 8404
