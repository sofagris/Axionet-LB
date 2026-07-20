from pathlib import Path

from app.services.system.metrics import HostMetricsCollector


def test_host_metrics_from_fake_proc(tmp_path: Path) -> None:
    (tmp_path / "stat").write_text(
        "cpu  100 0 100 800 0 0 0 0 0 0\ncpu0 100 0 100 800 0 0 0 0 0 0\n",
        encoding="utf-8",
    )
    (tmp_path / "meminfo").write_text(
        "MemTotal:       2048000 kB\nMemAvailable:   1024000 kB\nMemFree:         512000 kB\n",
        encoding="utf-8",
    )
    (tmp_path / "loadavg").write_text("0.50 0.40 0.30 1/100 1\n", encoding="utf-8")

    collector = HostMetricsCollector(proc_root=str(tmp_path))
    first = collector.collect()
    assert first.mem_total_bytes == 2048000 * 1024
    assert first.mem_available_bytes == 1024000 * 1024
    assert 49.0 <= first.mem_used_percent <= 51.0
    assert first.load_avg_1 == 0.5
    assert first.load_avg_5 == 0.4
    assert first.load_avg_15 == 0.3

    (tmp_path / "stat").write_text(
        "cpu  200 0 200 900 0 0 0 0 0 0\ncpu0 200 0 200 900 0 0 0 0 0 0\n",
        encoding="utf-8",
    )
    second = collector.collect()
    assert 0.0 <= second.cpu_percent <= 100.0
