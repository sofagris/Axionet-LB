from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.auth_source import LOCAL_AUTH_SOURCE_ID, AuthSource
from app.services.auth_sources.service import AuthSourceService


def _token(client: TestClient) -> str:
    login = client.post(
        "/api/v1/auth/login",
        json={"username": "Admin", "password": "Password"},
    )
    assert login.status_code == 200, login.text
    return login.json()["access_token"]


def test_login_options_public(auth_client: TestClient, db_session: Session) -> None:
    AuthSourceService(db_session).ensure_local_source()
    response = auth_client.get("/api/v1/auth/login-options")
    assert response.status_code == 200
    body = response.json()
    assert body["local_suffix"] == "internal"
    suffixes = {item["suffix"] for item in body["suffixes"]}
    assert "internal" in suffixes


def test_local_login_with_internal_upn(auth_client: TestClient) -> None:
    response = auth_client.post(
        "/api/v1/auth/login",
        json={"username": "Admin@internal", "password": "Password"},
    )
    assert response.status_code == 200, response.text
    assert response.json()["user"]["username"] == "Admin"


def test_password_login_rejected_for_oidc_suffix(
    auth_client: TestClient, db_session: Session
) -> None:
    AuthSourceService(db_session).ensure_local_source()
    token = _token(auth_client)
    headers = {"Authorization": f"Bearer {token}"}

    created = auth_client.post(
        "/api/v1/auth-sources",
        headers=headers,
        json={
            "name": "Contoso Entra",
            "kind": "oidc",
            "issuer_url": "https://login.microsoftonline.com/example/v2.0",
            "client_id": "client-1",
            "client_secret": "secret",
        },
    )
    assert created.status_code == 201, created.text
    source_id = created.json()["id"]

    suffix = auth_client.post(
        "/api/v1/auth-sources/upn-suffixes",
        headers=headers,
        json={"suffix": "contoso.com", "auth_source_id": source_id},
    )
    assert suffix.status_code == 201, suffix.text

    denied = auth_client.post(
        "/api/v1/auth/login",
        json={"username": "roy@contoso.com", "password": "anything"},
    )
    assert denied.status_code == 400
    assert "SSO" in denied.json()["detail"]


def test_cannot_delete_local_source_or_internal_suffix(
    auth_client: TestClient, db_session: Session
) -> None:
    AuthSourceService(db_session).ensure_local_source()
    token = _token(auth_client)
    headers = {"Authorization": f"Bearer {token}"}

    delete_source = auth_client.delete(
        f"/api/v1/auth-sources/{LOCAL_AUTH_SOURCE_ID}",
        headers=headers,
    )
    assert delete_source.status_code == 400

    suffixes = auth_client.get("/api/v1/auth-sources/upn-suffixes", headers=headers)
    internal = next(s for s in suffixes.json() if s["suffix"] == "internal")
    delete_suffix = auth_client.delete(
        f"/api/v1/auth-sources/upn-suffixes/{internal['id']}",
        headers=headers,
    )
    assert delete_suffix.status_code == 400


def test_app_identity_provider_crud(auth_client: TestClient) -> None:
    token = _token(auth_client)
    headers = {"Authorization": f"Bearer {token}"}
    created = auth_client.post(
        "/api/v1/auth-sources/app-identity-providers",
        headers=headers,
        json={
            "name": "Customer MFA",
            "kind": "oidc",
            "customer_id": "kunde-a",
            "config": {"issuer_url": "https://idp.example/realms/apps"},
        },
    )
    assert created.status_code == 201, created.text
    idp_id = created.json()["id"]
    listed = auth_client.get("/api/v1/auth-sources/app-identity-providers", headers=headers)
    assert listed.status_code == 200
    assert any(item["id"] == idp_id for item in listed.json())
    deleted = auth_client.delete(
        f"/api/v1/auth-sources/app-identity-providers/{idp_id}",
        headers=headers,
    )
    assert deleted.status_code == 204


def test_ensure_local_source_idempotent(db_session: Session) -> None:
    service = AuthSourceService(db_session)
    a = service.ensure_local_source()
    b = service.ensure_local_source()
    assert a.id == b.id == LOCAL_AUTH_SOURCE_ID
    assert db_session.get(AuthSource, LOCAL_AUTH_SOURCE_ID) is not None
