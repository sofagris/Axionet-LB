from __future__ import annotations

import ipaddress

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.network import Network
from app.models.network_attachment import NetworkAttachment
from app.schemas.instances import NetworkAttachmentCreate


def validate_network_attachments(
    db: Session,
    attachments: list[NetworkAttachmentCreate],
    *,
    networks: list[Network],
    exclude_instance_id: str | None = None,
) -> None:
    """Validate IPAM rules for instance network attachments.

    Raises ValueError with a human-readable message on failure.
    """
    if not attachments:
        return

    network_by_id = {net.id: net for net in networks}
    seen_ips: set[tuple[str, str]] = set()

    for item in attachments:
        network = network_by_id.get(item.network_id)
        if network is None:
            raise ValueError(f"Network not found: {item.network_id}")
        if not network.enabled:
            raise ValueError(f"Network is disabled: {network.name}")
        if not network.docker_network_id:
            raise ValueError(f"Network has no Docker network: {network.name}")

        if not item.ip_address:
            continue

        try:
            address = ipaddress.ip_address(item.ip_address)
        except ValueError as exc:
            raise ValueError(f"Invalid IP address: {item.ip_address}") from exc

        if network.subnet:
            try:
                subnet = ipaddress.ip_network(network.subnet, strict=False)
            except ValueError as exc:
                raise ValueError(f"Network {network.name} has invalid subnet") from exc
            if address not in subnet:
                raise ValueError(
                    f"IP {item.ip_address} is outside subnet {network.subnet} for network {network.name}"
                )
            if address == subnet.network_address or address == subnet.broadcast_address:
                raise ValueError(f"IP {item.ip_address} cannot be network or broadcast address")

        if network.ip_range:
            try:
                ip_range = ipaddress.ip_network(network.ip_range, strict=False)
            except ValueError as exc:
                raise ValueError(f"Network {network.name} has invalid ip_range") from exc
            if address not in ip_range:
                raise ValueError(
                    f"IP {item.ip_address} is outside ip_range {network.ip_range} for network {network.name}"
                )

        if network.gateway and item.ip_address == network.gateway:
            raise ValueError(f"IP {item.ip_address} is reserved as gateway for network {network.name}")

        key = (network.id, str(address))
        if key in seen_ips:
            raise ValueError(f"Duplicate IP {item.ip_address} in request for network {network.name}")
        seen_ips.add(key)

        stmt = select(NetworkAttachment).where(
            NetworkAttachment.network_id == network.id,
            NetworkAttachment.ip_address == str(address),
        )
        if exclude_instance_id:
            stmt = stmt.where(NetworkAttachment.service_instance_id != exclude_instance_id)
        existing = db.scalars(stmt).first()
        if existing is not None:
            raise ValueError(
                f"IP {item.ip_address} is already assigned on network {network.name}"
            )
