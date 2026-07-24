from __future__ import annotations

import json
import logging
import re
import subprocess
from dataclasses import dataclass
from typing import Any, Literal

logger = logging.getLogger(__name__)

IPV4_RE = re.compile(r"inet\s+(\d+\.\d+\.\d+\.\d+)(?:/\d+)?")

LldpMode = Literal["rx-and-tx", "rx-only", "tx-only", "disabled", "unknown"]
LLDP_MODES: frozenset[str] = frozenset({"rx-and-tx", "rx-only", "tx-only", "disabled"})


class HostNetworkError(RuntimeError):
    pass


@dataclass(frozen=True, slots=True)
class VlanEnsureResult:
    device_name: str
    created: bool


@dataclass(frozen=True, slots=True)
class LldpNeighbor:
    local_port: str
    chassis_name: str | None
    chassis_id: str | None
    port_id: str | None
    port_description: str | None
    system_description: str | None
    mgmt_ips: tuple[str, ...] = ()


@dataclass(frozen=True, slots=True)
class LldpDaemonStatus:
    installed: bool
    enabled: bool
    active: bool
    detail: str | None = None


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

    def set_promiscuous(self, name: str, *, enabled: bool = True) -> None:
        """Enable/disable promiscuous mode (required for macvlan RX of foreign MACs)."""
        self._require_name(name)
        self._run(["ip", "link", "set", "dev", name, "promisc", "on" if enabled else "off"])

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

    def lldp_daemon_status(self) -> LldpDaemonStatus:
        which = self._run_host(["sh", "-c", "command -v lldpcli && command -v lldpd"], check=False)
        installed = which.returncode == 0 and bool(which.stdout.strip())
        if not installed:
            return LldpDaemonStatus(
                installed=False,
                enabled=False,
                active=False,
                detail="lldpd is not installed on the host",
            )
        active_result = self._run_host(["systemctl", "is-active", "lldpd"], check=False)
        enabled_result = self._run_host(["systemctl", "is-enabled", "lldpd"], check=False)
        active = active_result.stdout.strip() == "active"
        enabled = enabled_result.stdout.strip() in {"enabled", "static", "indirect"}
        return LldpDaemonStatus(installed=True, enabled=enabled, active=active)

    def set_lldp_daemon(self, *, enabled: bool) -> LldpDaemonStatus:
        status = self.lldp_daemon_status()
        if not status.installed:
            raise HostNetworkError(
                "lldpd is not installed on the host (apt install lldpd)"
            )
        if enabled:
            self._run_host(["systemctl", "enable", "--now", "lldpd"])
        else:
            self._run_host(["systemctl", "disable", "--now", "lldpd"], check=False)
            self._run_host(["systemctl", "stop", "lldpd"], check=False)
        return self.lldp_daemon_status()

    def set_lldp_port(self, name: str, mode: str) -> None:
        self._require_name(name)
        if mode not in LLDP_MODES:
            raise HostNetworkError(f"Invalid LLDP mode: {mode}")
        status = self.lldp_daemon_status()
        if not status.active:
            raise HostNetworkError("lldpd is not active; enable LLDP first")
        self._run_host(
            ["lldpcli", "configure", "ports", name, "lldp", "status", mode],
        )

    def get_lldp_port_modes(self) -> dict[str, LldpMode]:
        """Return local interface name → LLDP status when daemon is active."""
        status = self.lldp_daemon_status()
        if not status.active:
            return {}
        result = self._run_host(["lldpcli", "-f", "json", "show", "interfaces"], check=False)
        if result.returncode != 0 or not result.stdout.strip():
            return {}
        try:
            payload = json.loads(result.stdout)
        except json.JSONDecodeError:
            return {}
        modes: dict[str, LldpMode] = {}
        for entry in self._iter_lldp_interface_entries(payload):
            name = str(entry.get("name") or entry.get("port") or "").strip()
            if not name or not self._safe_name(name):
                continue
            raw = str(
                entry.get("status")
                or (entry.get("port") or {}).get("status")
                or entry.get("lldp")
                or "unknown"
            ).lower()
            if raw in LLDP_MODES:
                modes[name] = raw  # type: ignore[assignment]
            elif "rx" in raw and "tx" in raw:
                modes[name] = "rx-and-tx"
            elif "rx" in raw:
                modes[name] = "rx-only"
            elif "tx" in raw:
                modes[name] = "tx-only"
            elif "disable" in raw:
                modes[name] = "disabled"
            else:
                modes[name] = "unknown"
        return modes

    def list_lldp_neighbors(self) -> list[LldpNeighbor]:
        status = self.lldp_daemon_status()
        if not status.active:
            return []
        result = self._run_host(["lldpcli", "-f", "json", "show", "neighbors"], check=False)
        if result.returncode != 0 or not result.stdout.strip():
            return []
        try:
            payload = json.loads(result.stdout)
        except json.JSONDecodeError:
            return []
        neighbors: list[LldpNeighbor] = []
        for local_port, neighbor in self._iter_lldp_neighbors(payload):
            if not local_port or not self._safe_name(local_port):
                continue
            chassis = neighbor.get("chassis") or {}
            if isinstance(chassis, list):
                chassis = chassis[0] if chassis else {}
            chassis_name: str | None = None
            if isinstance(chassis, dict) and "id" not in chassis and "name" not in chassis:
                # lldpcli nests SysName as the dict key: {"ax-sw-core02": {"id": ...}}
                for key, value in chassis.items():
                    if isinstance(value, dict):
                        chassis_name = str(key)
                        chassis = value
                        break
            port = neighbor.get("port") or {}
            if isinstance(port, list):
                port = port[0] if port else {}
            if chassis_name is None:
                chassis_name = self._lldp_scalar(chassis.get("name"))
            chassis_id = self._lldp_scalar(chassis.get("id") or chassis.get("chid"))
            port_id = self._lldp_scalar(port.get("id") or port.get("local"))
            port_description = self._lldp_scalar(port.get("descr") or port.get("description"))
            system_description = self._lldp_scalar(chassis.get("descr") or chassis.get("description"))
            mgmt_raw = chassis.get("mgmt-ip") or chassis.get("mgmt_ip") or []
            if isinstance(mgmt_raw, str):
                mgmt_ips = (mgmt_raw,)
            elif isinstance(mgmt_raw, list):
                mgmt_ips = tuple(str(item) for item in mgmt_raw if item)
            else:
                mgmt_ips = ()
            neighbors.append(
                LldpNeighbor(
                    local_port=local_port,
                    chassis_name=chassis_name,
                    chassis_id=chassis_id,
                    port_id=port_id,
                    port_description=port_description,
                    system_description=system_description,
                    mgmt_ips=mgmt_ips,
                )
            )
        return neighbors

    def _require_name(self, name: str) -> None:
        if not self._safe_name(name):
            raise HostNetworkError(f"Invalid interface name: {name}")

    def _run(self, args: list[str], *, check: bool = True) -> subprocess.CompletedProcess[str]:
        return self._run_nsenter(args, namespaces=("net",), check=check)

    def _run_host(self, args: list[str], *, check: bool = True) -> subprocess.CompletedProcess[str]:
        """Run against host PID 1 with mount+net (systemd / lldpcli sockets)."""
        if self._use_host_nsenter:
            return self._run_nsenter(args, namespaces=("mount", "uts", "ipc", "net", "pid"), check=check)
        return self._run_nsenter(args, namespaces=(), check=check)

    def _run_nsenter(
        self,
        args: list[str],
        *,
        namespaces: tuple[str, ...],
        check: bool = True,
    ) -> subprocess.CompletedProcess[str]:
        if namespaces:
            flags: list[str] = []
            for ns in namespaces:
                flags.extend([f"--{ns}"])
            command = ["nsenter", "--target", "1", *flags, "--", *args]
        else:
            command = list(args)
        logger.debug("host-net: %s", " ".join(command))
        completed = subprocess.run(
            command,
            check=False,
            capture_output=True,
            text=True,
            timeout=20,
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

    @staticmethod
    def _lldp_scalar(value: Any) -> str | None:
        if value is None:
            return None
        if isinstance(value, dict):
            for key in ("value", "data", "#text"):
                if key in value and value[key] is not None:
                    return str(value[key])
            return str(next(iter(value.values()), "")) or None
        if isinstance(value, list):
            return HostNetworkAdapter._lldp_scalar(value[0]) if value else None
        text = str(value).strip()
        return text or None

    @staticmethod
    def _iter_lldp_interface_entries(payload: Any) -> list[dict[str, Any]]:
        entries: list[dict[str, Any]] = []
        if isinstance(payload, dict):
            raw = payload.get("lldp") or payload.get("interface") or payload.get("interfaces") or payload
            if isinstance(raw, dict):
                nested = raw.get("interface") or raw.get("interfaces") or raw
                if isinstance(nested, list):
                    entries.extend(item for item in nested if isinstance(item, dict))
                elif isinstance(nested, dict):
                    # { "eth0": {...}, "eth1": {...} } or single interface object
                    if "name" in nested or "port" in nested:
                        entries.append(nested)
                    else:
                        for name, item in nested.items():
                            if isinstance(item, dict):
                                entries.append({"name": name, **item})
            elif isinstance(raw, list):
                entries.extend(item for item in raw if isinstance(item, dict))
        return entries

    @staticmethod
    def _iter_lldp_neighbors(payload: Any) -> list[tuple[str, dict[str, Any]]]:
        pairs: list[tuple[str, dict[str, Any]]] = []
        if not isinstance(payload, dict):
            return pairs
        root = payload.get("lldp") or payload
        if not isinstance(root, dict):
            return pairs
        # Common lldpcli JSON: {"lldp":{"interface":[{"name":"eth0","chassis":...,"port":...}]}}
        interfaces = root.get("interface") or root.get("interfaces") or []
        if isinstance(interfaces, dict):
            # {"eth0": {"chassis":..., "port":...}, ...}
            for name, item in interfaces.items():
                if isinstance(item, dict):
                    # May contain nested neighbor list under "chassis"/"via" or be the neighbor itself
                    if "chassis" in item or "port" in item:
                        pairs.append((str(name), item))
                    else:
                        for _key, neighbor in item.items():
                            if isinstance(neighbor, dict):
                                pairs.append((str(name), neighbor))
            return pairs
        if isinstance(interfaces, list):
            for item in interfaces:
                if not isinstance(item, dict):
                    continue
                name = str(item.get("name") or item.get("port") or "").strip()
                # Single neighbor object on interface
                if "chassis" in item or "via" in item:
                    pairs.append((name, item))
                    continue
                # Nested neighbors keyed by chassis name
                for key, value in item.items():
                    if key in {"name", "via", "age", "rid"}:
                        continue
                    if isinstance(value, dict) and ("chassis" in value or "port" in value):
                        pairs.append((name or key, value))
        return pairs
