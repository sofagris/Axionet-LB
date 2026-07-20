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
    assert patched.json()["description"] == "Uplink A"
    assert patched.json()["exclusive_use"] is True
