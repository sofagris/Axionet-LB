from unittest.mock import MagicMock

from docker.errors import DockerException
from fastapi.testclient import TestClient


def test_health_ok(client: TestClient) -> None:
    response = client.get("/api/v1/system/health")
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "ok"
    assert payload["components"]["api"]["status"] == "ok"
    assert payload["components"]["database"]["status"] == "ok"
    assert payload["components"]["docker"]["status"] == "ok"


def test_health_degraded_when_docker_fails(
    client: TestClient,
    docker_adapter: MagicMock,
) -> None:
    docker_adapter.ping.side_effect = DockerException("daemon down")
    response = client.get("/api/v1/system/health")
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "degraded"
    assert payload["components"]["docker"]["status"] == "error"
    assert payload["components"]["database"]["status"] == "ok"


def test_system_info(client: TestClient) -> None:
    response = client.get("/api/v1/system")
    assert response.status_code == 200
    payload = response.json()
    assert payload["name"] == "AxioNet LB"
    assert payload["api_prefix"] == "/api/v1"


def test_capabilities(client: TestClient) -> None:
    response = client.get("/api/v1/system/capabilities")
    assert response.status_code == 200
    payload = response.json()
    assert "system.health" in payload["features"]
    assert "haproxy" in payload["dataplane_services"]
    assert "system.logs" in payload["features"]
    assert "instances.reconcile_loop" in payload["features"]
    assert "haproxy.runtime_control" in payload["features"]


def test_system_logs_overview(client: TestClient) -> None:
    response = client.get("/api/v1/system/logs")
    assert response.status_code == 200
    payload = response.json()
    assert "errors" in payload
    assert "instances" in payload
    assert "collected_at" in payload
