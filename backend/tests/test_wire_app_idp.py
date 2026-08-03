"""Tests for wire_app_idp and apps realm."""

from __future__ import annotations

from sqlalchemy.orm import Session

from app.models.network import Network, NetworkType
from app.models.network_attachment import NetworkAttachment
from app.models.service_instance import ServiceInstance
from app.plugins.keycloak.realm import build_apps_realm
from app.plugins.keycloak.schemas import KeycloakConfig
from app.services.auth_sources.service import AuthSourceService
from app.services.keycloak.wire_app_idp import wire_app_idp


def test_apps_realm_has_lab_user_and_groups() -> None:
    realm = build_apps_realm(KeycloakConfig())
    assert any(g["name"] == "appusers" for g in realm["groups"])
    assert any(u["username"] == "appuser" for u in realm["users"])
    client = realm["clients"][0]
    assert any("/oauth2/callback" in uri for uri in client["redirectUris"] if uri != "*")


def test_wire_app_idp_creates_provider_and_binding(db_session: Session) -> None:
    AuthSourceService(db_session).ensure_local_source()
    network = Network(
        name="app-net",
        network_type=NetworkType.BRIDGE.value,
        subnet="10.50.0.0/24",
        enabled=True,
    )
    db_session.add(network)
    db_session.flush()
    instance = ServiceInstance(
        name="keycloak-apps-1",
        service_type="keycloak-apps",
        desired_state="running",
        actual_state="running",
        image="quay.io/keycloak/keycloak:26.2.4",
        image_version="26.2.4",
        restart_policy="unless-stopped",
        configuration={
            "realm": "axionet",
            "hostname": "10.50.0.40",
            "http_port": 8080,
            "app_client_id": "axionet-app",
            "app_client_secret": "axionet-app-lab-secret",
        },
    )
    db_session.add(instance)
    db_session.flush()
    attachment = NetworkAttachment(
        service_instance_id=instance.id,
        network_id=network.id,
        ip_address="10.50.0.40",
        attachment_order=0,
    )
    db_session.add(attachment)
    db_session.commit()

    result = wire_app_idp(
        db_session,
        instance,
        [attachment],
        idp_name="Keycloak Apps",
        customer_id="kunde-a",
        application_id="app-web",
    )
    assert result["issuer_url"] == "http://10.50.0.40:8080/realms/axionet"
    assert result["binding_id"]
    auth = AuthSourceService(db_session)
    providers = auth.list_app_idps()
    assert any(p.name == "Keycloak Apps" for p in providers)
