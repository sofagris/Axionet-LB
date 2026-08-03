from __future__ import annotations

from sqlalchemy.orm import Session

from app.models.network_attachment import NetworkAttachment
from app.models.service_instance import ServiceInstance
from app.plugins.keycloak.schemas import KeycloakConfig
from app.schemas.auth_sources import AuthSourceCreate, AuthSourceUpdate, UpnSuffixCreate, UpnSuffixUpdate
from app.services.auth_sources.service import AuthSourceError, AuthSourceService


class KeycloakWireError(Exception):
    """Failed to wire platform OIDC to a Keycloak instance."""


def wire_platform_oidc(
    db: Session,
    instance: ServiceInstance,
    attachments: list[NetworkAttachment],
    *,
    source_name: str = "Keycloak Management",
    upn_suffix: str = "lab.local",
) -> dict:
    if instance.service_type != "keycloak-mgmt":
        raise KeycloakWireError("Only keycloak-mgmt can wire platform OIDC")

    cfg = KeycloakConfig.from_dict(instance.configuration)
    ips = [item.ip_address for item in attachments if item.ip_address]
    hostname = cfg.hostname or (ips[0] if ips else None)
    if not hostname:
        raise KeycloakWireError("Instance has no hostname or attachment IP for issuer URL")

    issuer = f"http://{hostname}:{cfg.http_port}/realms/{cfg.realm}"
    auth = AuthSourceService(db)

    existing = next((row for row in auth.list_sources() if row.name == source_name), None)
    try:
        if existing is None:
            source = auth.create_source(
                AuthSourceCreate(
                    name=source_name,
                    kind="oidc",
                    enabled=True,
                    description=f"Wired from instance {instance.name}",
                    issuer_url=issuer,
                    client_id=cfg.gui_client_id,
                    client_secret=cfg.gui_client_secret,
                    scopes="openid profile email",
                    claim_username="preferred_username",
                    claim_groups="groups",
                )
            )
        else:
            source = auth.update_source(
                existing,
                AuthSourceUpdate(
                    enabled=True,
                    issuer_url=issuer,
                    client_id=cfg.gui_client_id,
                    client_secret=cfg.gui_client_secret,
                    scopes="openid profile email",
                    claim_username="preferred_username",
                    claim_groups="groups",
                    description=f"Wired from instance {instance.name}",
                ),
            )
    except AuthSourceError as exc:
        raise KeycloakWireError(str(exc)) from exc

    try:
        suffix_row = auth.get_suffix_by_value(upn_suffix)
        if suffix_row is None:
            auth.create_suffix(UpnSuffixCreate(suffix=upn_suffix, auth_source_id=source.id))
        elif suffix_row.auth_source_id != source.id:
            auth.update_suffix(suffix_row, UpnSuffixUpdate(auth_source_id=source.id))
    except AuthSourceError as exc:
        raise KeycloakWireError(str(exc)) from exc

    # Disable legacy compose IdP (host-published Keycloak profile).
    for row in auth.list_sources():
        if row.id == source.id or not row.enabled:
            continue
        if row.name == "Lab Keycloak":
            try:
                auth.update_source(row, AuthSourceUpdate(enabled=False))
            except AuthSourceError:
                pass

    # Ensure local Operators group exists for Keycloak claim mapping
    from app.models.group import Group
    from sqlalchemy import select

    ops = db.scalars(select(Group).where(Group.name == "Operators")).first()
    if ops is None:
        ops = db.scalars(select(Group).where(Group.name == "operators")).first()
    if ops is None:
        db.add(
            Group(
                name="Operators",
                description="Mapped from Keycloak group operators",
                role="operator",
            )
        )
        db.commit()

    return {
        "auth_source_id": source.id,
        "auth_source_name": source.name,
        "issuer_url": issuer,
        "upn_suffix": upn_suffix,
        "gui_client_id": cfg.gui_client_id,
    }
