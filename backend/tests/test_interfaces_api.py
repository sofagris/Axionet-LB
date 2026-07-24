from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.core.config import get_settings


@pytest.fixture()
def fake_sysfs(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    sysfs = tmp_path / "sys"
    iface = sysfs / "class" / "net" / "eth0"
    iface.mkdir(parents=True)
    (iface / "address").write_text("11:22:33:44:55:66\n", encoding="utf-8")
    (iface / "operstate").write_text("up\n", encoding="utf-8")
    (iface / "mtu").write_text("1500\n", encoding="utf-8")
    (iface / "speed").write_text("1000\n", encoding="utf-8")
    (iface / "carrier").write_text("1\n", encoding="utf-8")

    pci_dir = sysfs / "devices" / "pci0000:00" / "0000:01:00.0"
    pci_dir.mkdir(parents=True)
    (pci_dir / "numa_node").write_text("1\n", encoding="utf-8")
    driver_dir = sysfs / "bus" / "pci" / "drivers" / "igb"
    driver_dir.mkdir(parents=True)
    (pci_dir / "driver").symlink_to(driver_dir)
    (iface / "device").symlink_to(pci_dir)

    monkeypatch.setenv("HOST_SYSFS_ROOT", str(sysfs))
    get_settings.cache_clear()
    yield sysfs
    get_settings.cache_clear()


def test_interface_rescan_and_list(fake_sysfs: Path, client: TestClient) -> None:
    assert fake_sysfs.exists()
    response = client.post("/api/v1/interfaces/rescan")
    assert response.status_code == 200
    payload = response.json()
    assert payload["discovered"] == 1
    assert payload["created"] == 1
    assert payload["interfaces"][0]["name"] == "eth0"
    assert payload["interfaces"][0]["driver"] == "igb"
    assert payload["interfaces"][0]["pci_address"] == "0000:01:00.0"

    listed = client.get("/api/v1/interfaces")
    assert listed.status_code == 200
    assert len(listed.json()) == 1

    interface_id = listed.json()[0]["id"]
    detail = client.get(f"/api/v1/interfaces/{interface_id}")
    assert detail.status_code == 200
    assert detail.json()["mac_address"] == "11:22:33:44:55:66"

    patched = client.patch(
        f"/api/v1/interfaces/{interface_id}",
        json={"description": "Uplink A", "exclusive_use": True},
    )
    assert patched.status_code == 200
    assert patched.json()["interface"]["description"] == "Uplink A"
    assert patched.json()["interface"]["exclusive_use"] is True


def test_lldp_status_and_enable(fake_sysfs: Path, client: TestClient) -> None:
    from app.api.v1 import interfaces as interfaces_routes
    from app.services.networking.host import LldpDaemonStatus, LldpNeighbor

    class FakeHost:
        def __init__(self) -> None:
            self.enabled = False

        def lldp_daemon_status(self) -> LldpDaemonStatus:
            return LldpDaemonStatus(
                installed=True,
                enabled=self.enabled,
                active=self.enabled,
            )

        def set_lldp_daemon(self, *, enabled: bool) -> LldpDaemonStatus:
            self.enabled = enabled
            return self.lldp_daemon_status()

        def list_lldp_neighbors(self) -> list[LldpNeighbor]:
            if not self.enabled:
                return []
            return [
                LldpNeighbor(
                    local_port="eth0",
                    chassis_name="ax-sw-core02",
                    chassis_id="00:11:22:33:44:55",
                    port_id="Ethernet0",
                    port_description="Eth1/1",
                    system_description="SONiC",
                    mgmt_ips=("192.168.50.199",),
                )
            ]

        def get_lldp_port_modes(self) -> dict:
            return {"eth0": "rx-and-tx"} if self.enabled else {}

    fake = FakeHost()
    client.app.dependency_overrides[interfaces_routes.get_host_net] = lambda: fake
    try:
        status = client.get("/api/v1/interfaces/lldp")
        assert status.status_code == 200, status.text
        body = status.json()
        assert body["installed"] is True
        assert body["active"] is False
        assert body["neighbors"] == []

        enabled = client.put("/api/v1/interfaces/lldp", json={"enabled": True})
        assert enabled.status_code == 200, enabled.text
        assert enabled.json()["active"] is True
        assert enabled.json()["neighbors"][0]["chassis_name"] == "ax-sw-core02"
        assert enabled.json()["neighbors"][0]["port_id"] == "Ethernet0"
    finally:
        client.app.dependency_overrides.pop(interfaces_routes.get_host_net, None)
