from __future__ import annotations

import logging
import re
import subprocess
from dataclasses import dataclass

logger = logging.getLogger(__name__)

IPV4_RE = re.compile(r"inet\s+(\d+\.\d+\.\d+\.\d+)(?:/\d+)?")


class HostNetworkError(RuntimeError):
    pass


@dataclass(frozen=True, slots=True)
class VlanEnsureResult:
    device_name: str
    created: bool


class HostNetworkAdapter:
    """Manage host L2 devices. Prefer direct netns; fall back to nsenter into PID 1."""

    def __init__(self, *, use_host_nsenter: bool = False) -> None:
        self._use_host_nsenter = use_host_nsenter

    def ensure_vlan_subinterface(self, parent: str, vlan_id: int) -> VlanEnsureResult:
        if not self._safe_name(parent):
            raise HostNetworkError(f"Invalid parent interface name: {parent}")
        if not (1 <= vlan_id <= 4094):
            raise HostNetworkError(f"Invalid VLAN id: {vlan_id}")

        device = f"{parent}.{vlan_id}"
        if self.device_exists(device):
            return VlanEnsureResult(device_name=device, created=False)

        if not self.device_exists(parent):
            raise HostNetworkError(f"Parent interface does not exist on host: {parent}")

        self._run(["ip", "link", "add", "link", parent, "name", device, "type", "vlan", "id", str(vlan_id)])
        self._run(["ip", "link", "set", "dev", device, "up"])
        return VlanEnsureResult(device_name=device, created=True)

    def device_exists(self, name: str) -> bool:
        result = self._run(["ip", "link", "show", "dev", name], check=False)
        return result.returncode == 0

    def set_mtu(self, name: str, mtu: int) -> None:
        self._require_name(name)
        if not (68 <= mtu <= 9216):
            raise HostNetworkError(f"Invalid MTU: {mtu}")
        self._run(["ip", "link", "set", "dev", name, "mtu", str(mtu)])

    def set_admin_state(self, name: str, *, up: bool) -> None:
        self._require_name(name)
        self._run(["ip", "link", "set", "dev", name, "up" if up else "down"])

    def set_speed_mbps(self, name: str, speed_mbps: int | None) -> None:
        """Set fixed speed, or None to restore autonegotiation."""
        self._require_name(name)
        if speed_mbps is None:
            self._run(["ethtool", "-s", name, "autoneg", "on"])
            return
        self._run(
            [
                "ethtool",
                "-s",
                name,
                "speed",
                str(speed_mbps),
                "duplex",
                "full",
                "autoneg",
                "off",
            ]
        )

    def list_ipv4_addresses(self, name: str) -> list[str]:
        self._require_name(name)
        result = self._run(["ip", "-4", "-o", "addr", "show", "dev", name], check=False)
        if result.returncode != 0:
            return []
        addresses: list[str] = []
        for line in result.stdout.splitlines():
            match = IPV4_RE.search(line)
            if match:
                addresses.append(match.group(1))
        return addresses

    def default_route_interface(self) -> str | None:
        result = self._run(["ip", "route", "show", "default"], check=False)
        if result.returncode != 0 or not result.stdout.strip():
            return None
        parts = result.stdout.split()
        if "dev" in parts:
            idx = parts.index("dev")
            if idx + 1 < len(parts):
                name = parts[idx + 1]
                return name if self._safe_name(name) else None
        return None

    def _require_name(self, name: str) -> None:
        if not self._safe_name(name):
            raise HostNetworkError(f"Invalid interface name: {name}")

    def _run(self, args: list[str], *, check: bool = True) -> subprocess.CompletedProcess[str]:
        command = ["nsenter", "--target", "1", "--net", "--"] + args if self._use_host_nsenter else args
        logger.debug("host-net: %s", " ".join(command))
        completed = subprocess.run(
            command,
            check=False,
            capture_output=True,
            text=True,
            timeout=15,
        )
        if check and completed.returncode != 0:
            detail = (completed.stderr or completed.stdout or "").strip()
            raise HostNetworkError(detail or f"Command failed: {' '.join(command)}")
        return completed

    @staticmethod
    def _safe_name(name: str) -> bool:
        if not name or len(name) > 64:
            return False
        return all(ch.isalnum() or ch in ".-_" for ch in name)
