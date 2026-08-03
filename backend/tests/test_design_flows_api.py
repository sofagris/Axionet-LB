from fastapi.testclient import TestClient


def test_design_flow_crud(client: TestClient) -> None:
    created = client.post(
        "/api/v1/design-flows",
        json={"name": "Legacy front door", "description": "VIP → AG → app"},
    )
    assert created.status_code == 201
    body = created.json()
    assert body["name"] == "Legacy front door"
    assert body["graph_json"]["nodes"] == []
    assert body["graph_json"]["edges"] == []
    flow_id = body["id"]

    listed = client.get("/api/v1/design-flows")
    assert listed.status_code == 200
    assert len(listed.json()) == 1

    graph = {
        "nodes": [
            {
                "id": "n1",
                "type": "designer",
                "position": {"x": 0, "y": 0},
                "data": {
                    "kind": "catalog.service",
                    "label": "HAProxy",
                    "catalogSlug": "haproxy",
                    "serviceType": "haproxy",
                },
            }
        ],
        "edges": [],
        "viewport": {"x": 0, "y": 0, "zoom": 1},
    }
    patched = client.patch(
        f"/api/v1/design-flows/{flow_id}",
        json={"graph_json": graph, "name": "Front door v2"},
    )
    assert patched.status_code == 200
    assert patched.json()["name"] == "Front door v2"
    assert len(patched.json()["graph_json"]["nodes"]) == 1

    fetched = client.get(f"/api/v1/design-flows/{flow_id}")
    assert fetched.status_code == 200
    assert fetched.json()["graph_json"]["nodes"][0]["id"] == "n1"

    deleted = client.delete(f"/api/v1/design-flows/{flow_id}")
    assert deleted.status_code == 204
    assert client.get(f"/api/v1/design-flows/{flow_id}").status_code == 404


def test_create_design_flow_rejects_duplicate_name(client: TestClient) -> None:
    assert client.post("/api/v1/design-flows", json={"name": "Dup"}).status_code == 201
    again = client.post("/api/v1/design-flows", json={"name": "Dup"})
    assert again.status_code == 400
