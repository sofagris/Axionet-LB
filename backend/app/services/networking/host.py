from __future__ import annotations

import logging
import subprocess
from dataclasses import dataclass

logger = logging.getLogger(__name__)


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
