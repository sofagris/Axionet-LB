from pathlib import Path

from app.services.system.metrics import HostMetricsCollector
from app.services.system.network_metrics import NetworkMetricsCollector


def _fake_iface(root: Path, name: str, *, rx: int, tx: int, operstate: str = "up") -> None:
    base = root / "class" / "net" / name
    (base / "device").mkdir(parents=True)
    (base / "statistics").mkdir(parents=True)
    (base / "operstate").write_text(operstate, encoding="utf-8")
    (base / "statistics" / "rx_bytes").write_text(str(rx), encoding="utf-8")
    (base / "statistics" / "tx_bytes").write_text(str(tx), encoding="utf-8")
    (base / "statistics" / "rx_packets").write_text("10", encoding="utf-8")
    (base / "statistics" / "tx_packets").write_text("20", encoding="utf-8")
    (base / "statistics" / "rx_errors").write_text("0", encoding="utf-8")
    (base / "statistics" / "tx_errors").write_text("1", encoding="utf-8")
    (base / "statistics" / "rx_dropped").write_text("0", encoding="utf-8")
    (base / "statistics" / "tx_dropped").write_text("0", encoding="utf-8")


def test_network_metrics_sums_physical_interfaces(tmp_path: Path) -> None:
    _fake_iface(tmp_path, "eth0", rx=1000, tx=2000)
    _fake_iface(tmp_path, "eth1", rx=500, tx=700)
    # virtual without device node should be ignored
    veth = tmp_path / "class" / "net" / "veth0"
    (veth / "statistics").mkdir(parents=True)
    (veth / "statistics" / "rx_bytes").write_text("999999", encoding="utf-8")
    (veth / "statistics" / "tx_bytes").write_text("999999", encoding="utf-8")

    totals, interfaces = NetworkMetricsCollector(sysfs_root=str(tmp_path)).collect()
    assert {item.name for item in interfaces} == {"eth0", "eth1"}
    assert totals.rx_bytes == 1500
    assert totals.tx_bytes == 2700
    assert totals.tx_errors == 2


def test_host_metrics_includes_network(tmp_path: Path) -> None:
    proc = tmp_path / "proc"
    sysfs = tmp_path / "sys"
    proc.mkdir()
    (proc / "stat").write_text("cpu  100 0 100 800 0 0 0 0 0 0\n", encoding="utf-8")
    (proc / "meminfo").write_text(
        "MemTotal:       2048000 kB\nMemAvailable:   1024000 kB\n",
        encoding="utf-8",
    )
    (proc / "loadavg").write_text("0.10 0.20 0.30 1/100 1\n", encoding="utf-8")
    _fake_iface(sysfs, "ens3", rx=4096, tx=8192)

    metrics = HostMetricsCollector(proc_root=str(proc), sysfs_root=str(sysfs)).collect()
    assert metrics.network is not None
    assert metrics.network.rx_bytes == 4096
    assert metrics.network.tx_bytes == 8192
    assert len(metrics.interfaces) == 1
    assert metrics.interfaces[0].name == "ens3"
