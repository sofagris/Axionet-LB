from fastapi.testclient import TestClient


def test_health_is_public(auth_client: TestClient) -> None:
    response = auth_client.get("/api/v1/system/health")
    assert response.status_code == 200


def test_protected_endpoint_requires_auth(auth_client: TestClient) -> None:
    response = auth_client.get("/api/v1/system")
    assert response.status_code == 401


def test_login_and_me(auth_client: TestClient) -> None:
    bad = auth_client.post(
        "/api/v1/auth/login",
        json={"username": "Admin", "password": "wrong"},
    )
    assert bad.status_code == 401

    login = auth_client.post(
        "/api/v1/auth/login",
        json={"username": "Admin", "password": "Password"},
    )
    assert login.status_code == 200, login.text
    body = login.json()
    assert body["token_type"] == "bearer"
    assert body["user"]["username"] == "Admin"
    token = body["access_token"]

    me = auth_client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert me.status_code == 200
    assert me.json()["username"] == "Admin"
    assert me.json()["role"] == "admin"

    info = auth_client.get(
        "/api/v1/system",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert info.status_code == 200


def test_logout_audits(auth_client: TestClient) -> None:
    login = auth_client.post(
        "/api/v1/auth/login",
        json={"username": "Admin", "password": "Password"},
    )
    token = login.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    logout = auth_client.post("/api/v1/auth/logout", headers=headers)
    assert logout.status_code == 204

    audit = auth_client.get("/api/v1/system/audit?limit=20", headers=headers)
    assert audit.status_code == 200
    types = {item["event_type"] for item in audit.json()["events"]}
    assert "auth.login" in types
    assert "auth.logout" in types
