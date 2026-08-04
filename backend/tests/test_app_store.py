from pathlib import Path

from app.app_packages.contract import repo_root_from_backend
from app.app_packages.store import (
    ensure_apps_seeded,
    install_from_store,
    resolve_store_index_path,
    store_entries_with_status,
)


def test_store_index_lists_varnish_installed() -> None:
    root = repo_root_from_backend()
    payload = store_entries_with_status(repo_root=root)
    assert payload["apiVersion"] == "axionet.store/v1"
    by_id = {item["id"]: item for item in payload["packages"]}
    assert "varnish" in by_id
    assert by_id["varnish"]["installed"] is True
    assert by_id["varnish"]["installedVersion"] == "0.1.0"


def test_install_bundled_already_installed() -> None:
    root = repo_root_from_backend()
    result = install_from_store("varnish", repo_root=root)
    assert result["id"] == "varnish"
    assert result["status"] == "already_installed"


def test_ensure_seed_copies_into_writable_dir(tmp_path: Path) -> None:
    root = repo_root_from_backend()
    seed = root / "packages" / "apps"
    dest = tmp_path / "apps"
    ensure_apps_seeded(dest, seed)
    assert (dest / "varnish" / "axionet-app.json").is_file()
    # Idempotent
    ensure_apps_seeded(dest, seed)
    assert resolve_store_index_path(repo_root=root).is_file()
