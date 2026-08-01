from fastapi.testclient import TestClient

from app.core.security import hash_password
from app.models.user import User
from sqlalchemy.orm import Session


def _login(client: TestClient, username: str = "Admin", password: str = "Password") -> str:
    response = client.post("/api/v1/auth/login", json={"username": username, "password": password})
    assert response.status_code == 200, response.text
    return response.json()["access_token"]


def test_bind_app_idp_to_customer_application(auth_client: TestClient) -> None:
    token = _login(auth_client)
    headers = {"Authorization": f"Bearer {token}"}

    idp = auth_client.post(
        "/api/v1/auth-sources/app-identity-providers",
        headers=headers,
        json={
            "name": "Kunde A IdP",
            "kind": "oidc",
            "customer_id": "kunde-a",
            "config": {"issuer_url": "https://idp.example/realms/kunde-a"},
        },
    )
    assert idp.status_code == 201, idp.text
    idp_id = idp.json()["id"]

    bound = auth_client.post(
        "/api/v1/app-idp-bindings",
        headers=headers,
        json={
            "app_identity_provider_id": idp_id,
            "customer_id": "kunde-a",
            "application_id": "app-web",
        },
    )
    assert bound.status_code == 201, bound.text
    body = bound.json()
    assert body["customer_id"] == "kunde-a"
    assert body["application_id"] == "app-web"
    assert body["app_identity_provider_name"] == "Kunde A IdP"

    listed = auth_client.get(
        "/api/v1/app-idp-bindings",
        headers=headers,
        params={"customer_id": "kunde-a", "application_id": "app-web"},
    )
    assert listed.status_code == 200
    assert len(listed.json()) == 1

    clash = auth_client.post(
        "/api/v1/app-idp-bindings",
        headers=headers,
        json={
            "app_identity_provider_id": idp_id,
            "customer_id": "kunde-a",
            "application_id": "app-web",
        },
    )
    assert clash.status_code == 400

    deleted = auth_client.delete(
        f"/api/v1/app-idp-bindings/{body['id']}",
        headers=headers,
    )
    assert deleted.status_code == 204


def test_operator_can_list_bindings_but_not_mutate(
    auth_client: TestClient, db_session: Session
) -> None:
    admin_token = _login(auth_client)
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    idp = auth_client.post(
        "/api/v1/auth-sources/app-identity-providers",
        headers=admin_headers,
        json={"name": "Shared IdP", "kind": "oidc", "config": {}},
    )
    assert idp.status_code == 201
    idp_id = idp.json()["id"]

    binding = auth_client.post(
        "/api/v1/app-idp-bindings",
        headers=admin_headers,
        json={
            "app_identity_provider_id": idp_id,
            "customer_id": "kunde-b",
            "application_id": "horizon",
        },
    )
    assert binding.status_code == 201

    ops = User(
        username="ops1",
        password_hash=hash_password("password1"),
        role="operator",
        auth_source="local",
        is_active=True,
    )
    db_session.add(ops)
    db_session.commit()

    ops_token = _login(auth_client, "ops1", "password1")
    ops_headers = {"Authorization": f"Bearer {ops_token}"}

    listed = auth_client.get(
        "/api/v1/app-idp-bindings",
        headers=ops_headers,
        params={"customer_id": "kunde-b"},
    )
    assert listed.status_code == 200
    assert len(listed.json()) == 1

    create = auth_client.post(
        "/api/v1/app-idp-bindings",
        headers=ops_headers,
        json={
            "app_identity_provider_id": idp_id,
            "customer_id": "kunde-a",
            "application_id": "app-web",
        },
    )
    assert create.status_code == 403
