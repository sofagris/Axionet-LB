from pathlib import Path

from app.services.networking.sysfs import SysfsInterfaceScanner


def _make_iface(
    root: Path,
    name: str,
    *,
    mac: str,
    operstate: str,
    mtu: str = "1500",
    speed: str = "10000",
    pci: str = "0000:03:00.0",
    driver: str = "ixgbe",
    numa: str = "0",
) -> None:
    iface = root / "class" / "net" / name
    iface.mkdir(parents=True)
    (iface / "address").write_text(f"{mac}\n", encoding="utf-8")
    (iface / "operstate").write_text(f"{operstate}\n", encoding="utf-8")
    (iface / "mtu").write_text(f"{mtu}\n", encoding="utf-8")
    (iface / "speed").write_text(f"{speed}\n", encoding="utf-8")
    (iface / "carrier").write_text("1\n" if operstate == "up" else "0\n", encoding="utf-8")

    pci_dir = root / "devices" / "pci0000:00" / pci
    pci_dir.mkdir(parents=True)
    (pci_dir / "numa_node").write_text(f"{numa}\n", encoding="utf-8")
    driver_dir = root / "bus" / "pci" / "drivers" / driver
    driver_dir.mkdir(parents=True)
    (pci_dir / "driver").symlink_to(driver_dir)
    (iface / "device").symlink_to(pci_dir)


def test_sysfs_scanner_discovers_physical_only(tmp_path: Path) -> None:
    sysfs = tmp_path / "sys"
    _make_iface(sysfs, "eth0", mac="aa:bb:cc:dd:ee:01", operstate="up", pci="0000:03:00.0")
    _make_iface(
        sysfs,
        "eth1",
        mac="aa:bb:cc:dd:ee:02",
        operstate="down",
        speed="-1",
        numa="-1",
        pci="0000:03:00.1",
        driver="ixgbe",
    )

    # virtual / non-device interfaces
    lo = sysfs / "class" / "net" / "lo"
    lo.mkdir(parents=True)
    (lo / "address").write_text("00:00:00:00:00:00\n", encoding="utf-8")
    docker0 = sysfs / "class" / "net" / "docker0"
    docker0.mkdir(parents=True)
    (docker0 / "address").write_text("02:42:00:00:00:01\n", encoding="utf-8")
    veth = sysfs / "class" / "net" / "vethabc123"
    veth.mkdir(parents=True)

    scanner = SysfsInterfaceScanner(sysfs)
    found = {item.name: item for item in scanner.scan()}

    assert set(found) == {"eth0", "eth1"}
    assert found["eth0"].mac_address == "aa:bb:cc:dd:ee:01"
    assert found["eth0"].link_state == "up"
    assert found["eth0"].speed_mbps == 10000
    assert found["eth0"].driver == "ixgbe"
    assert found["eth0"].pci_address == "0000:03:00.0"
    assert found["eth0"].numa_node == 0
    assert found["eth1"].link_state == "down"
    assert found["eth1"].speed_mbps is None
    assert found["eth1"].numa_node is None
