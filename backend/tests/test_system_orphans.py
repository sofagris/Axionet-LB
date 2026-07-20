from unittest.mock import MagicMock

from fastapi.testclient import TestClient


def test_orphans_scan_empty(client: TestClient, docker_adapter: MagicMock) -> None:
    docker_adapter.list_managed_containers.return_value = []
    docker_adapter.list_managed_networks.return_value = []

    response = client.get("/api/v1/system/orphans")
    assert response.status_code == 200
    body = response.json()
    assert body["docker_ok"] is True
    assert body["orphan_containers"] == []
    assert body["orphan_networks"] == []
    assert body["missing_containers"] == []
    assert body["missing_networks"] == []
    assert "collected_at" in body


def test_orphans_scan_detects_orphan_container(
    client: TestClient,
    docker_adapter: MagicMock,
) -> None:
    docker_adapter.list_managed_containers.return_value = [
        {
            "id": "ctr-orphan-1",
            "name": "axionet-orphan",
            "status": "exited",
            "image": "haproxy:2.9",
            "labels": {
                "axionet.managed": "true",
                "axionet.instance_id": "missing-instance",
                "axionet.service_type": "haproxy",
            },
        }
    ]
    docker_adapter.list_managed_networks.return_value = []

    response = client.get("/api/v1/system/orphans")
    assert response.status_code == 200
    body = response.json()
    assert len(body["orphan_containers"]) == 1
    orphan = body["orphan_containers"][0]
    assert orphan["id"] == "ctr-orphan-1"
    assert orphan["prunable"] is True
    assert orphan["reason"] == "unknown_instance_id"


def test_orphans_prune_removes_prunable(
    client: TestClient,
    docker_adapter: MagicMock,
) -> None:
    docker_adapter.list_managed_containers.return_value = [
        {
            "id": "ctr-orphan-2",
            "name": "axionet-orphan-2",
            "status": "exited",
            "image": "haproxy:2.9",
            "labels": {"axionet.managed": "true"},
        }
    ]
    docker_adapter.list_managed_networks.return_value = [
        {
            "id": "net-orphan-1",
            "name": "axionet-net-orphan",
            "driver": "bridge",
            "labels": {"axionet.managed": "true"},
        }
    ]
    docker_adapter.remove_container.return_value = None
    docker_adapter.remove_managed_network.return_value = None

    response = client.post(
        "/api/v1/system/orphans/prune",
        json={"container_ids": ["ctr-orphan-2"], "network_ids": ["net-orphan-1"]},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["removed_containers"] == ["ctr-orphan-2"]
    assert body["removed_networks"] == ["net-orphan-1"]
    assert body["errors"] == []
    docker_adapter.remove_container.assert_called_once_with("ctr-orphan-2")
    docker_adapter.remove_managed_network.assert_called_once_with("net-orphan-1")


def test_orphans_prune_rejects_unknown_ids(
    client: TestClient,
    docker_adapter: MagicMock,
) -> None:
    docker_adapter.list_managed_containers.return_value = []
    docker_adapter.list_managed_networks.return_value = []

    response = client.post(
        "/api/v1/system/orphans/prune",
        json={"container_ids": ["not-an-orphan"], "network_ids": []},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["removed_containers"] == []
    assert any("not prunable" in err for err in body["errors"])
