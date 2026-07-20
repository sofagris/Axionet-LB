from pathlib import Path
from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient

from app.api.v1 import interfaces as interfaces_routes
from app.core.config import get_settings
from app.models.physical_interface import AdministrativeState, LinkState, PhysicalInterface
from app.schemas.interfaces import PhysicalInterfaceUpdate
from app.services.networking.host import HostNetworkAdapter
from app.services.networking.pending import PendingChangeStore, PendingSnapshot
from app.services.networking.safety import InterfaceSafetyError, InterfaceSafetyService
from app.services.networking.pending_runtime import reset_pending_store_for_tests


@pytest.fixture(autouse=True)
def _reset_pending() -> None:
    reset_pending_store_for_tests()
    yield
    reset_pending_store_for_tests()


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

    data_dir = tmp_path / "data"
    data_dir.mkdir()
    monkeypatch.setenv("HOST_SYSFS_ROOT", str(sysfs))
    monkeypatch.setenv("AX_LB_DATA_DIR", str(data_dir))
    get_settings.cache_clear()
    yield sysfs
    get_settings.cache_clear()


def test_safety_blocks_mgmt_disable() -> None:
    iface = PhysicalInterface(
        id="1",
        name="eth0",
        link_state=LinkState.UP.value,
        administrative_state=AdministrativeState.ENABLED.value,
        is_management=True,
    )
    with pytest.raises(InterfaceSafetyError) as exc:
        InterfaceSafetyService().evaluate_update(
            iface,
            PhysicalInterfaceUpdate(administrative_state=AdministrativeState.DISABLED, confirm=True),
        )
    assert exc.value.code == "mgmt_admin_down_forbidden"


def test_safety_requires_confirm_for_disable() -> None:
    iface = PhysicalInterface(
        id="1",
        name="eth1",
        link_state=LinkState.UP.value,
        administrative_state=AdministrativeState.ENABLED.value,
        is_management=False,
    )
    with pytest.raises(InterfaceSafetyError) as exc:
        InterfaceSafetyService().evaluate_update(
            iface,
            PhysicalInterfaceUpdate(administrative_state=AdministrativeState.DISABLED),
        )
    assert exc.value.code == "confirm_required"


def test_promote_and_patch_metadata(fake_sysfs: Path, client: TestClient, tmp_path: Path) -> None:
    host = MagicMock(spec=HostNetworkAdapter)
    host.list_ipv4_addresses.return_value = ["192.168.50.195"]
    host.default_route_interface.return_value = "eth0"

    client.app.dependency_overrides[interfaces_routes.get_host_net] = lambda: host

    rescan = client.post("/api/v1/interfaces/rescan")
    assert rescan.status_code == 200
    interface_id = rescan.json()["interfaces"][0]["id"]

    patched = client.patch(
        f"/api/v1/interfaces/{interface_id}",
        json={"description": "Uplink A", "exclusive_use": True},
    )
    assert patched.status_code == 200
    assert patched.json()["interface"]["description"] == "Uplink A"
    assert patched.json()["interface"]["exclusive_use"] is True

    promoted = client.post(f"/api/v1/interfaces/{interface_id}/promote-management")
    assert promoted.status_code == 200, promoted.text
    body = promoted.json()
    assert body["management_bind_ip"] == "192.168.50.195"
    assert body["interface"]["is_management"] is True

    info = client.get("/api/v1/system")
    assert info.status_code == 200
    assert info.json()["management_interface"] == "eth0"
    assert info.json()["management_bind_ip"] == "192.168.50.195"

    # cannot disable management
    blocked = client.patch(
        f"/api/v1/interfaces/{interface_id}",
        json={"administrative_state": "disabled", "confirm": True},
    )
    assert blocked.status_code == 400

    client.app.dependency_overrides.pop(interfaces_routes.get_host_net, None)


def test_pending_store_confirm(tmp_path: Path) -> None:
    rolled: list[str] = []

    def on_rollback(change) -> None:
        rolled.append(change.id)

    store = PendingChangeStore(tmp_path / "pending.json", on_rollback=on_rollback)
    change = store.create(
        interface_id="i1",
        interface_name="eth1",
        previous=PendingSnapshot(mtu=1500, administrative_state="enabled", speed_mbps=1000),
        seconds=60,
    )
    confirmed = store.confirm(change.id)
    assert confirmed is not None
    assert confirmed.confirmed is True
    assert rolled == []
