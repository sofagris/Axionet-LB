from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from app.services.networking.sysfs import VIRTUAL_NAME_PREFIXES


@dataclass(frozen=True, slots=True)
class InterfaceCounters:
    name: str
    link_state: str
    rx_bytes: int
    tx_bytes: int
    rx_packets: int
    tx_packets: int
    rx_errors: int
    tx_errors: int
    rx_dropped: int
    tx_dropped: int


@dataclass(frozen=True, slots=True)
class NetworkTotals:
    rx_bytes: int
    tx_bytes: int
    rx_packets: int
    tx_packets: int
    rx_errors: int
    tx_errors: int
    rx_dropped: int
    tx_dropped: int


class NetworkMetricsCollector:
    """Read physical NIC counters from sysfs statistics."""

    def __init__(self, sysfs_root: str = "/host/sys") -> None:
        self._sysfs_root = Path(sysfs_root)

    def collect(self) -> tuple[NetworkTotals, list[InterfaceCounters]]:
        class_net = self._resolve_class_net()
        interfaces: list[InterfaceCounters] = []
        if class_net is None:
            empty = NetworkTotals(0, 0, 0, 0, 0, 0, 0, 0)
            return empty, interfaces

        for entry in sorted(class_net.iterdir(), key=lambda p: p.name):
            if not entry.is_dir() and not entry.is_symlink():
                continue
            name = entry.name
            if self._is_virtual(name, entry):
                continue
            stats = entry / "statistics"
            if not stats.is_dir():
                continue
            interfaces.append(
                InterfaceCounters(
                    name=name,
                    link_state=self._link_state(entry),
                    rx_bytes=self._read_counter(stats / "rx_bytes"),
                    tx_bytes=self._read_counter(stats / "tx_bytes"),
                    rx_packets=self._read_counter(stats / "rx_packets"),
                    tx_packets=self._read_counter(stats / "tx_packets"),
                    rx_errors=self._read_counter(stats / "rx_errors"),
                    tx_errors=self._read_counter(stats / "tx_errors"),
                    rx_dropped=self._read_counter(stats / "rx_dropped"),
                    tx_dropped=self._read_counter(stats / "tx_dropped"),
                )
            )

        totals = NetworkTotals(
            rx_bytes=sum(item.rx_bytes for item in interfaces),
            tx_bytes=sum(item.tx_bytes for item in interfaces),
            rx_packets=sum(item.rx_packets for item in interfaces),
            tx_packets=sum(item.tx_packets for item in interfaces),
            rx_errors=sum(item.rx_errors for item in interfaces),
            tx_errors=sum(item.tx_errors for item in interfaces),
            rx_dropped=sum(item.rx_dropped for item in interfaces),
            tx_dropped=sum(item.tx_dropped for item in interfaces),
        )
        return totals, interfaces

    def _resolve_class_net(self) -> Path | None:
        candidate = self._sysfs_root / "class" / "net"
        if candidate.is_dir():
            return candidate
        fallback = Path("/sys/class/net")
        if fallback.is_dir():
            return fallback
        return None

    def _is_virtual(self, name: str, entry: Path) -> bool:
        if name == "lo":
            return True
        lowered = name.lower()
        for prefix in VIRTUAL_NAME_PREFIXES:
            if lowered == prefix or lowered.startswith(prefix):
                return True
        device = entry / "device"
        return not device.exists()

    def _link_state(self, entry: Path) -> str:
        operstate = self._read_text(entry / "operstate") or "unknown"
        operstate = operstate.lower()
        if operstate in {"up", "down"}:
            return operstate
        carrier = self._read_text(entry / "carrier")
        if carrier == "1":
            return "up"
        if carrier == "0":
            return "down"
        return "unknown"

    def _read_counter(self, path: Path) -> int:
        raw = self._read_text(path)
        if raw is None:
            return 0
        try:
            return int(raw)
        except ValueError:
            return 0

    def _read_text(self, path: Path) -> str | None:
        try:
            return path.read_text(encoding="utf-8").strip()
        except OSError:
            return None
