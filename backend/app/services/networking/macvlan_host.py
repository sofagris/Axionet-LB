"""Host reachability helpers for Docker macvlan / management networks."""

from __future__ import annotations

import ipaddress
import logging

from app.services.networking.host import HostNetworkAdapter, HostNetworkError

logger = logging.getLogger(__name__)

MGMT_SHIM_NAME = "ax-mgmt-shim"


def pick_shim_address(
    subnet: str,
    *,
    reserved: set[str],
) -> ipaddress.IPv4Address:
    """Pick a host address in ``subnet`` from the high end, skipping ``reserved`` IPs."""
    network = ipaddress.ip_network(subnet, strict=False)
    if not isinstance(network, ipaddress.IPv4Network):
        raise HostNetworkError(f"Shim requires an IPv4 subnet, got {subnet}")
    reserved_addrs = {ipaddress.ip_address(item) for item in reserved if item}
    for candidate in reversed(list(network.hosts())):
        if candidate not in reserved_addrs:
            return candidate
    raise HostNetworkError(f"No free address for macvlan shim in {subnet}")


def ensure_management_host_access(
    host_net: HostNetworkAdapter,
    *,
    parent: str,
    subnet: str | None,
    gateway: str | None,
    host_ips: list[str],
    attachment_ips: list[str],
    shim_name: str = MGMT_SHIM_NAME,
) -> None:
    """Ensure macvlan shim + /32 host routes for management attachment IPs."""
    if not parent or not subnet:
        logger.warning("Skipping macvlan host access: missing parent or subnet")
        return

    reserved: set[str] = set(host_ips)
    if gateway:
        reserved.add(gateway)
    reserved.update(ip for ip in attachment_ips if ip)

    shim_ip = pick_shim_address(subnet, reserved=reserved)
    shim_cidr = f"{shim_ip}/32"
    host_net.ensure_macvlan_shim(parent, shim_name=shim_name, shim_cidr=shim_cidr)

    for ip in attachment_ips:
        if not ip:
            continue
        try:
            host_net.ensure_host_route(f"{ip}/32", device=shim_name)
        except HostNetworkError:
            logger.exception("Failed to install host route for %s via %s", ip, shim_name)
            raise


def remove_attachment_host_route(
    host_net: HostNetworkAdapter,
    ip_address: str | None,
) -> None:
    if not ip_address:
        return
    host_net.delete_host_route(f"{ip_address}/32")
