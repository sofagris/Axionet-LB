from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.models.user import User


def _login(client: TestClient, username: str = "Admin", password: str = "Password") -> str:
    response = client.post("/api/v1/auth/login", json={"username": username, "password": password})
    assert response.status_code == 200, response.text
    return response.json()["access_token"]


def test_me_includes_groups_and_effective_role(auth_client: TestClient, db_session: Session) -> None:
    token = _login(auth_client)
    headers = {"Authorization": f"Bearer {token}"}

    group = auth_client.post(
        "/api/v1/groups",
        headers=headers,
        json={"name": "ops", "description": "Operators", "role": "operator"},
    )
    assert group.status_code == 201, group.text
    group_id = group.json()["id"]

    me_before = auth_client.get("/api/v1/auth/me", headers=headers)
    assert me_before.status_code == 200
    assert me_before.json()["effective_role"] == "admin"
    assert me_before.json()["groups"] == []

    viewer = User(
        username="viewer1",
        password_hash=hash_password("password1"),
        role="viewer",
        auth_source="local",
        is_active=True,
    )
    db_session.add(viewer)
    db_session.commit()

    members = auth_client.put(
        f"/api/v1/groups/{group_id}/members",
        headers=headers,
        json={"user_ids": [viewer.id]},
    )
    assert members.status_code == 200

    viewer_token = _login(auth_client, "viewer1", "password1")
    me = auth_client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {viewer_token}"},
    )
    assert me.status_code == 200
    body = me.json()
    assert body["role"] == "viewer"
    assert body["groups"] == ["ops"]
    assert body["effective_role"] == "operator"


def test_users_crud_and_last_admin_protection(auth_client: TestClient) -> None:
    token = _login(auth_client)
    headers = {"Authorization": f"Bearer {token}"}

    created = auth_client.post(
        "/api/v1/users",
        headers=headers,
        json={
            "username": "alice",
            "password": "password1",
            "role": "operator",
            "display_name": "Alice",
        },
    )
    assert created.status_code == 201, created.text
    alice_id = created.json()["id"]
    assert created.json()["effective_role"] == "operator"

    listed = auth_client.get("/api/v1/users", headers=headers)
    assert listed.status_code == 200
    names = {u["username"] for u in listed.json()}
    assert "Admin" in names and "alice" in names

    # Non-admin cannot access users API
    alice_token = _login(auth_client, "alice", "password1")
    forbidden = auth_client.get(
        "/api/v1/users",
        headers={"Authorization": f"Bearer {alice_token}"},
    )
    assert forbidden.status_code == 403

    # Cannot deactivate last local admin (bootstrap)
    bad = auth_client.post(f"/api/v1/users/{_admin_id(auth_client, headers)}/deactivate", headers=headers)
    assert bad.status_code == 400

    admin_id = _admin_id(auth_client, headers)

    # Promote alice, then demote Admin (allowed when another local admin exists)
    promote = auth_client.patch(
        f"/api/v1/users/{alice_id}",
        headers=headers,
        json={"role": "admin"},
    )
    assert promote.status_code == 200

    demote_admin = auth_client.patch(
        f"/api/v1/users/{admin_id}",
        headers=headers,
        json={"role": "viewer"},
    )
    assert demote_admin.status_code == 200

    alice_headers = {"Authorization": f"Bearer {_login(auth_client, 'alice', 'password1')}"}

    # Cannot deactivate bootstrap Admin even when another admin exists
    deactivate_bootstrap = auth_client.post(
        f"/api/v1/users/{admin_id}/deactivate",
        headers=alice_headers,
    )
    assert deactivate_bootstrap.status_code == 400

    # Cannot demote the last remaining local admin (alice)
    demote_alice = auth_client.patch(
        f"/api/v1/users/{alice_id}",
        headers=alice_headers,
        json={"role": "viewer"},
    )
    assert demote_alice.status_code == 400


def test_groups_crud(auth_client: TestClient) -> None:
    token = _login(auth_client)
    headers = {"Authorization": f"Bearer {token}"}

    created = auth_client.post(
        "/api/v1/groups",
        headers=headers,
        json={"name": "viewers", "description": "Read only", "role": "viewer"},
    )
    assert created.status_code == 201, created.text
    group_id = created.json()["id"]

    updated = auth_client.patch(
        f"/api/v1/groups/{group_id}",
        headers=headers,
        json={"role": "operator", "description": "Ops"},
    )
    assert updated.status_code == 200
    assert updated.json()["role"] == "operator"

    deleted = auth_client.delete(f"/api/v1/groups/{group_id}", headers=headers)
    assert deleted.status_code == 204


def _admin_id(client: TestClient, headers: dict[str, str]) -> str:
    listed = client.get("/api/v1/users", headers=headers)
    assert listed.status_code == 200
    for user in listed.json():
        if user["username"] == "Admin":
            return user["id"]
    raise AssertionError("Admin user not found")
