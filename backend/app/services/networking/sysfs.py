from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path


VIRTUAL_NAME_PREFIXES = (
    "docker",
    "br-",
    "veth",
    "virbr",
    "tun",
    "tap",
    "vxlan",
    "wg",
    "tailscale",
    "cni",
    "flannel",
    "cali",
    "kube",
)


@dataclass(frozen=True, slots=True)
class DiscoveredInterface:
    name: str
    mac_address: str | None
    pci_address: str | None
    numa_node: int | None
    speed_mbps: int | None
    driver: str | None
    mtu: int | None
    link_state: str


class SysfsInterfaceScanner:
    """Discover host NICs via sysfs (supports a bind-mounted host /sys path)."""

    def __init__(self, sysfs_root: str | Path = "/sys") -> None:
        self._sysfs_root = Path(sysfs_root)

    @property
    def class_net(self) -> Path:
        return self._sysfs_root / "class" / "net"

    def scan(self) -> list[DiscoveredInterface]:
        if not self.class_net.is_dir():
            return []

        results: list[DiscoveredInterface] = []
        for entry in sorted(self.class_net.iterdir(), key=lambda p: p.name):
            if not entry.is_dir() and not entry.is_symlink():
                continue
            name = entry.name
            if self._is_virtual(name, entry):
                continue
            results.append(self._read_interface(name, entry))
        return results

    def _is_virtual(self, name: str, entry: Path) -> bool:
        if name == "lo":
            return True
        lowered = name.lower()
        for prefix in VIRTUAL_NAME_PREFIXES:
            prefix = prefix.strip()
            if lowered == prefix or lowered.startswith(prefix):
                return True
        # Prefer devices backed by a real device node (PCI/USB/etc.)
        device = entry / "device"
        if not device.exists():
            return True
        return False

    def _read_interface(self, name: str, entry: Path) -> DiscoveredInterface:
        return DiscoveredInterface(
            name=name,
            mac_address=self._read_text(entry / "address"),
            pci_address=self._pci_address(entry),
            numa_node=self._read_int(entry / "device" / "numa_node", allow_negative=False),
            speed_mbps=self._read_speed(entry / "speed"),
            driver=self._driver(entry),
            mtu=self._read_int(entry / "mtu"),
            link_state=self._link_state(entry),
        )

    def _pci_address(self, entry: Path) -> str | None:
        device = entry / "device"
        if not device.exists():
            return None
        try:
            resolved = device.resolve()
        except OSError:
            return None
        # Typical: .../devices/pci0000:00/0000:00:1c.0/0000:03:00.0
        name = resolved.name
        if ":" in name and "." in name:
            return name
        return None

    def _driver(self, entry: Path) -> str | None:
        driver_link = entry / "device" / "driver"
        if not driver_link.exists():
            return None
        try:
            return driver_link.resolve().name
        except OSError:
            return driver_link.name if driver_link.is_symlink() else None

    def _link_state(self, entry: Path) -> str:
        operstate = (self._read_text(entry / "operstate") or "unknown").lower()
        if operstate in {"up", "down"}:
            return operstate
        carrier = self._read_text(entry / "carrier")
        if carrier == "1":
            return "up"
        if carrier == "0":
            return "down"
        return "unknown"

    def _read_speed(self, path: Path) -> int | None:
        value = self._read_int(path, allow_negative=True)
        if value is None or value < 0:
            return None
        return value

    def _read_int(self, path: Path, *, allow_negative: bool = True) -> int | None:
        text = self._read_text(path)
        if text is None:
            return None
        try:
            value = int(text)
        except ValueError:
            return None
        if not allow_negative and value < 0:
            return None
        return value

    def _read_text(self, path: Path) -> str | None:
        try:
            text = path.read_text(encoding="utf-8").strip()
        except (OSError, UnicodeError):
            return None
        return text or None
