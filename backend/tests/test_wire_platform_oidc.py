"""wire_platform_oidc rebinds existing UPN suffixes."""

from __future__ import annotations

from sqlalchemy.orm import Session

from app.models.auth_source import AuthSource, AuthUpnSuffix
from app.models.network import Network, NetworkType
from app.models.network_attachment import NetworkAttachment
from app.models.service_instance import ServiceInstance
from app.services.auth_sources.service import AuthSourceService
from app.services.keycloak.wire_oidc import wire_platform_oidc


def test_wire_platform_oidc_rebinds_existing_suffix(db_session: Session) -> None:
    auth = AuthSourceService(db_session)
    auth.ensure_local_source()

    legacy = AuthSource(
        name="Lab Keycloak",
        kind="oidc",
        enabled=True,
        issuer_url="http://192.168.50.195:8080/realms/axionet",
        client_id="axionet-gui",
        client_secret="old-secret",
    )
    db_session.add(legacy)
    db_session.flush()
    db_session.add(AuthUpnSuffix(suffix="lab.local", auth_source_id=legacy.id))

    network = Network(
        name="management",
        network_type=NetworkType.MANAGEMENT.value,
        subnet="192.168.50.0/24",
        gateway="192.168.50.1",
        enabled=True,
    )
    db_session.add(network)
    db_session.flush()

    instance = ServiceInstance(
        name="keycloak-management",
        service_type="keycloak-mgmt",
        desired_state="running",
        actual_state="running",
        image="quay.io/keycloak/keycloak:26.2.4",
        image_version="26.2.4",
        restart_policy="unless-stopped",
        configuration={
            "realm": "axionet",
            "hostname": "192.168.50.50",
            "http_port": 8080,
            "gui_client_id": "axionet-gui",
            "gui_client_secret": "axionet-gui-lab-secret",
        },
    )
    db_session.add(instance)
    db_session.flush()
    attachment = NetworkAttachment(
        service_instance_id=instance.id,
        network_id=network.id,
        ip_address="192.168.50.50",
        attachment_order=0,
    )
    db_session.add(attachment)
    db_session.commit()

    result = wire_platform_oidc(db_session, instance, [attachment], upn_suffix="lab.local")

    assert result["issuer_url"] == "http://192.168.50.50:8080/realms/axionet"
    suffix = auth.get_suffix_by_value("lab.local")
    assert suffix is not None
    assert suffix.auth_source_id == result["auth_source_id"]

    legacy_reloaded = db_session.get(AuthSource, legacy.id)
    assert legacy_reloaded is not None
    assert legacy_reloaded.enabled is False
