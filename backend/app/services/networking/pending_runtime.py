from __future__ import annotations

from pathlib import Path

from app.core.config import get_settings
from app.db.session import SessionLocal
from app.services.networking.discovery import InterfaceDiscoveryService
from app.services.networking.host import HostNetworkAdapter
from app.services.networking.mutation import InterfaceMutationService
from app.services.networking.pending import PendingChange, PendingChangeStore
from app.services.networking.sysfs import SysfsInterfaceScanner

_pending_store: PendingChangeStore | None = None


def _handle_rollback(change: PendingChange) -> None:
    settings = get_settings()
    db = SessionLocal()
    try:
        discovery = InterfaceDiscoveryService(
            db=db,
            scanner=SysfsInterfaceScanner(settings.host_sysfs_root),
        )
        host = HostNetworkAdapter(use_host_nsenter=settings.host_net_nsenter)
        service = InterfaceMutationService(
            db=db,
            discovery=discovery,
            host_net=host,
            pending=get_pending_store(),
            data_dir=settings.data_dir,
        )
        service.rollback_change(change)
    finally:
        db.close()


def get_pending_store() -> PendingChangeStore:
    global _pending_store
    settings = get_settings()
    path = Path(settings.data_dir) / "pending-if-changes.json"
    if _pending_store is not None and _pending_store._path != path:  # noqa: SLF001
        _pending_store.stop()
        _pending_store = None
    if _pending_store is None:
        _pending_store = PendingChangeStore(path, on_rollback=_handle_rollback)
    return _pending_store


def reset_pending_store_for_tests() -> None:
    global _pending_store
    if _pending_store is not None:
        _pending_store.stop()
        _pending_store = None


def start_pending_store() -> PendingChangeStore:
    store = get_pending_store()
    store.start()
    return store


def stop_pending_store() -> None:
    global _pending_store
    if _pending_store is not None:
        _pending_store.stop()
