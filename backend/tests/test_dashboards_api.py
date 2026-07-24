from fastapi.testclient import TestClient


def test_dashboard_crud_and_publish(client: TestClient) -> None:
    created = client.post(
        "/api/v1/dashboards",
        json={"name": "Ops", "description": "Traffic overview"},
    )
    assert created.status_code == 201
    body = created.json()
    assert body["name"] == "Ops"
    assert body["widgets"] == []
    dashboard_id = body["id"]

    listed = client.get("/api/v1/dashboards")
    assert listed.status_code == 200
    assert len(listed.json()) == 1

    published = client.post(
        f"/api/v1/dashboards/{dashboard_id}/widgets",
        json={"type": "traffic_flow", "config": {}},
    )
    assert published.status_code == 201
    widgets = published.json()["widgets"]
    assert len(widgets) == 1
    assert widgets[0]["type"] == "traffic_flow"
    assert widgets[0]["id"]

    renamed = client.patch(
        f"/api/v1/dashboards/{dashboard_id}",
        json={"name": "Ops board"},
    )
    assert renamed.status_code == 200
    assert renamed.json()["name"] == "Ops board"

    replaced = client.patch(
        f"/api/v1/dashboards/{dashboard_id}",
        json={"widgets": []},
    )
    assert replaced.status_code == 200
    assert replaced.json()["widgets"] == []

    deleted = client.delete(f"/api/v1/dashboards/{dashboard_id}")
    assert deleted.status_code == 204
    assert client.get(f"/api/v1/dashboards/{dashboard_id}").status_code == 404


def test_create_dashboard_rejects_duplicate_name(client: TestClient) -> None:
    assert client.post("/api/v1/dashboards", json={"name": "Dup"}).status_code == 201
    again = client.post("/api/v1/dashboards", json={"name": "Dup"})
    assert again.status_code == 400


def test_append_widget_rejects_unknown_type(client: TestClient) -> None:
    created = client.post("/api/v1/dashboards", json={"name": "Typed"})
    dashboard_id = created.json()["id"]
    bad = client.post(
        f"/api/v1/dashboards/{dashboard_id}/widgets",
        json={"type": "unknown_widget", "config": {}},
    )
    assert bad.status_code == 422
