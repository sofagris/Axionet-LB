from __future__ import annotations

from app.models.network import Network, NetworkType
from app.schemas.instances import NetworkAttachmentCreate

KEYCLOAK_SERVICE_TYPES = frozenset({"keycloak-mgmt", "keycloak-apps"})


def validate_keycloak_networks(
    service_type: str,
    networks: list[Network],
    attachments: list[NetworkAttachmentCreate],
) -> None:
    if service_type not in KEYCLOAK_SERVICE_TYPES:
        return
    if not attachments:
        raise ValueError(f"{service_type} requires at least one network attachment")
    if service_type != "keycloak-mgmt":
        return
    for network in networks:
        if network.network_type != NetworkType.MANAGEMENT.value:
            raise ValueError(
                "keycloak-mgmt may only attach to management networks "
                f"(got {network.name!r} type={network.network_type!r})"
            )
