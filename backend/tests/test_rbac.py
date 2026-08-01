from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.rbac import required_mutation_role, role_satisfies
from app.core.security import hash_password
from app.models.user import User


def test_required_mutation_role_matrix() -> None:
    assert required_mutation_role("GET", "/api/v1/instances") is None
    assert required_mutation_role("POST", "/api/v1/auth/login") is None
    assert required_mutation_role("POST", "/api/v1/auth/logout") is None
    assert required_mutation_role("POST", "/api/v1/instances") == "operator"
    assert required_mutation_role("DELETE", "/api/v1/vips/abc") == "operator"
    assert required_mutation_role("POST", "/api/v1/users") == "admin"
    assert required_mutation_role("PATCH", "/api/v1/groups/x") == "admin"
    assert required_mutation_role("POST", "/api/v1/auth-sources") == "admin"
    assert required_mutation_role("POST", "/api/v1/system/orphans/prune") == "admin"
    assert (
        required_mutation_role("POST", "/api/v1/interfaces/eth0/promote-management") == "admin"
    )
    assert role_satisfies("admin", "operator")
    assert role_satisfies("operator", "operator")
    assert not role_satisfies("viewer", "operator")


def _login(client: TestClient, username: str, password: str) -> str:
    response = client.post(
        "/api/v1/auth/login",
        json={"username": username, "password": password},
    )
    assert response.status_code == 200, response.text
    return response.json()["access_token"]


def _seed_user(db: Session, username: str, role: str, password: str = "password1") -> User:
    user = User(
        username=username,
        password_hash=hash_password(password),
        role=role,
        auth_source="local",
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def test_viewer_can_read_but_not_mutate_dataplane(
    auth_client: TestClient, db_session: Session
) -> None:
    _seed_user(db_session, "viewer1", "viewer")
    token = _login(auth_client, "viewer1", "password1")
    headers = {"Authorization": f"Bearer {token}"}

    listed = auth_client.get("/api/v1/instances", headers=headers)
    assert listed.status_code == 200

    created = auth_client.post(
        "/api/v1/instances",
        headers=headers,
        json={
            "name": "blocked",
            "service_type": "haproxy",
            "desired_state": "stopped",
        },
    )
    assert created.status_code == 403

    logout = auth_client.post("/api/v1/auth/logout", headers=headers)
    assert logout.status_code == 204


def test_operator_can_mutate_dataplane_but_not_identity(
    auth_client: TestClient, db_session: Session
) -> None:
    _seed_user(db_session, "ops1", "operator")
    token = _login(auth_client, "ops1", "password1")
    headers = {"Authorization": f"Bearer {token}"}

    created = auth_client.post(
        "/api/v1/instances",
        headers=headers,
        json={
            "name": "ops-inst",
            "service_type": "haproxy",
            "desired_state": "stopped",
        },
    )
    assert created.status_code != 403, created.text

    users = auth_client.get("/api/v1/users", headers=headers)
    assert users.status_code == 403

    create_user = auth_client.post(
        "/api/v1/users",
        headers=headers,
        json={"username": "x", "password": "password1", "role": "viewer"},
    )
    assert create_user.status_code == 403

    prune = auth_client.post(
        "/api/v1/system/orphans/prune",
        headers=headers,
        json={"container_ids": [], "network_ids": []},
    )
    assert prune.status_code == 403


def test_admin_can_prune_orphans(auth_client: TestClient) -> None:
    token = _login(auth_client, "Admin", "Password")
    headers = {"Authorization": f"Bearer {token}"}
    prune = auth_client.post(
        "/api/v1/system/orphans/prune",
        headers=headers,
        json={"container_ids": [], "network_ids": []},
    )
    assert prune.status_code != 403, prune.text
