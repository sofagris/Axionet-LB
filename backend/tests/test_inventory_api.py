from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.services.inventory.service import InventoryService


def _login(client: TestClient, username: str = "Admin", password: str = "Password") -> str:
    response = client.post("/api/v1/auth/login", json={"username": username, "password": password})
    assert response.status_code == 200, response.text
    return response.json()["access_token"]


def test_sites_placement_and_lb_inventory(auth_client: TestClient) -> None:
    token = _login(auth_client)
    headers = {"Authorization": f"Bearer {token}"}

    site = auth_client.post(
        "/api/v1/sites",
        headers=headers,
        json={"name": "Oslo", "description": "Primary DC"},
    )
    assert site.status_code == 201, site.text
    site_id = site.json()["id"]

    dup = auth_client.post("/api/v1/sites", headers=headers, json={"name": "Oslo"})
    assert dup.status_code == 400

    domain = auth_client.post(
        "/api/v1/placement-domains",
        headers=headers,
        json={
            "name": "Oslo",
            "kind": "site",
            "site_id": site_id,
            "description": "Site domain Oslo",
        },
    )
    assert domain.status_code == 201, domain.text
    assert domain.json()["site_id"] == site_id

    shared = auth_client.post(
        "/api/v1/placement-domains",
        headers=headers,
        json={"name": "Shared Services", "kind": "shared"},
    )
    assert shared.status_code == 201, shared.text
    assert shared.json()["site_id"] is None

    lbs = auth_client.get("/api/v1/load-balancers", headers=headers)
    assert lbs.status_code == 200
    body = lbs.json()
    assert len(body) >= 1
    local = next(item for item in body if item["is_local"])
    assert local["name"]

    patched = auth_client.patch(
        f"/api/v1/load-balancers/{local['id']}",
        headers=headers,
        json={"site_id": site_id, "description": "Lab Netscaler"},
    )
    assert patched.status_code == 200, patched.text
    assert patched.json()["site_id"] == site_id

    remote = auth_client.post(
        "/api/v1/load-balancers",
        headers=headers,
        json={
            "name": "Trondheim LB",
            "description": "Future box",
            "ip_address": "10.0.0.50",
            "site_id": site_id,
        },
    )
    assert remote.status_code == 201, remote.text
    assert remote.json()["is_local"] is False

    forbidden_local = auth_client.post(
        "/api/v1/load-balancers",
        headers=headers,
        json={"name": "Another local", "is_local": True},
    )
    assert forbidden_local.status_code == 400

    delete_local = auth_client.delete(
        f"/api/v1/load-balancers/{local['id']}",
        headers=headers,
    )
    assert delete_local.status_code == 400

    delete_remote = auth_client.delete(
        f"/api/v1/load-balancers/{remote.json()['id']}",
        headers=headers,
    )
    assert delete_remote.status_code == 204


def test_ensure_local_load_balancer_once(db_session: Session) -> None:
    svc = InventoryService(db_session)
    first = svc.ensure_local_load_balancer()
    second = svc.ensure_local_load_balancer()
    assert first.id == second.id
    assert first.is_local is True
    listed = svc.list_load_balancers()
    assert sum(1 for lb in listed if lb.is_local) == 1
