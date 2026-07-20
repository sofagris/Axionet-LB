from __future__ import annotations

import time
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path

from app.schemas.system import (
    InterfaceCountersRead,
    NetworkTotalsRead,
    SystemMetricsResponse,
)
from app.services.system.network_metrics import NetworkMetricsCollector


@dataclass
class _CpuSample:
    idle: int
    total: int


class HostMetricsCollector:
    """Read host CPU/memory/network metrics from bind-mounted host filesystems."""

    def __init__(self, proc_root: str = "/host/proc", sysfs_root: str = "/host/sys") -> None:
        self._proc_root = Path(proc_root)
        self._network = NetworkMetricsCollector(sysfs_root=sysfs_root)
        self._last_cpu: _CpuSample | None = None

    def collect(self) -> SystemMetricsResponse:
        root = self._resolve_root()
        cpu_percent = self._cpu_percent(root)
        mem_total, mem_available = self._memory(root)
        mem_used = max(mem_total - mem_available, 0)
        mem_used_percent = (mem_used / mem_total * 100.0) if mem_total else 0.0
        load1, load5, load15 = self._loadavg(root)
        totals, interfaces = self._network.collect()
        return SystemMetricsResponse(
            cpu_percent=round(cpu_percent, 2),
            mem_total_bytes=mem_total,
            mem_available_bytes=mem_available,
            mem_used_percent=round(mem_used_percent, 2),
            load_avg_1=load1,
            load_avg_5=load5,
            load_avg_15=load15,
            network=NetworkTotalsRead(
                rx_bytes=totals.rx_bytes,
                tx_bytes=totals.tx_bytes,
                rx_packets=totals.rx_packets,
                tx_packets=totals.tx_packets,
                rx_errors=totals.rx_errors,
                tx_errors=totals.tx_errors,
                rx_dropped=totals.rx_dropped,
                tx_dropped=totals.tx_dropped,
            ),
            interfaces=[
                InterfaceCountersRead(
                    name=item.name,
                    link_state=item.link_state,
                    rx_bytes=item.rx_bytes,
                    tx_bytes=item.tx_bytes,
                    rx_packets=item.rx_packets,
                    tx_packets=item.tx_packets,
                    rx_errors=item.rx_errors,
                    tx_errors=item.tx_errors,
                    rx_dropped=item.rx_dropped,
                    tx_dropped=item.tx_dropped,
                )
                for item in interfaces
            ],
            collected_at=datetime.now(UTC),
        )

    def _resolve_root(self) -> Path:
        if (self._proc_root / "stat").exists():
            return self._proc_root
        fallback = Path("/proc")
        if (fallback / "stat").exists():
            return fallback
        raise FileNotFoundError(f"proc filesystem not found at {self._proc_root} or /proc")

    def _read_cpu_sample(self, root: Path) -> _CpuSample:
        line = (root / "stat").read_text(encoding="utf-8").splitlines()[0]
        parts = line.split()
        if parts[0] != "cpu":
            raise ValueError("unexpected /proc/stat format")
        values = [int(item) for item in parts[1:]]
        idle = values[3] + (values[4] if len(values) > 4 else 0)
        total = sum(values)
        return _CpuSample(idle=idle, total=total)

    def _cpu_percent(self, root: Path) -> float:
        current = self._read_cpu_sample(root)
        previous = self._last_cpu
        if previous is None:
            self._last_cpu = current
            time.sleep(0.05)
            current = self._read_cpu_sample(root)
            previous = self._last_cpu
        self._last_cpu = current
        total_delta = current.total - previous.total
        idle_delta = current.idle - previous.idle
        if total_delta <= 0:
            return 0.0
        busy = total_delta - idle_delta
        return max(0.0, min(100.0, busy / total_delta * 100.0))

    def _memory(self, root: Path) -> tuple[int, int]:
        meminfo: dict[str, int] = {}
        for line in (root / "meminfo").read_text(encoding="utf-8").splitlines():
            if ":" not in line:
                continue
            key, raw = line.split(":", 1)
            number = raw.strip().split()[0]
            meminfo[key] = int(number) * 1024
        total = meminfo.get("MemTotal", 0)
        available = meminfo.get("MemAvailable")
        if available is None:
            free = meminfo.get("MemFree", 0)
            buffers = meminfo.get("Buffers", 0)
            cached = meminfo.get("Cached", 0)
            available = free + buffers + cached
        return total, available

    def _loadavg(self, root: Path) -> tuple[float | None, float | None, float | None]:
        path = root / "loadavg"
        if not path.exists():
            return None, None, None
        parts = path.read_text(encoding="utf-8").split()
        if len(parts) < 3:
            return None, None, None
        return float(parts[0]), float(parts[1]), float(parts[2])
