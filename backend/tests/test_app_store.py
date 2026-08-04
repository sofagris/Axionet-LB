from pathlib import Path

from app.app_packages.contract import repo_root_from_backend
from app.app_packages.store import (
    ensure_apps_seeded,
    install_from_store,
    resolve_store_index_path,
    store_entries_with_status,
)


def test_store_index_lists_varnish_installed(monkeypatch) -> None:
    monkeypatch.delenv("AXIONET_STORE_INDEX_URL", raising=False)
    monkeypatch.delenv("AXIONET_APPS_DIR", raising=False)
    monkeypatch.delenv("AXIONET_APPS_SEED_DIR", raising=False)
    root = repo_root_from_backend()
    payload = store_entries_with_status(repo_root=root)
    assert payload["apiVersion"] == "axionet.store/v1"
    assert payload["indexSource"] == "bundled"
    by_id = {item["id"]: item for item in payload["packages"]}
    assert "varnish" in by_id
    assert by_id["varnish"]["installed"] is True
    assert by_id["varnish"]["installedVersion"] == "0.2.0"


def test_store_prefers_remote_index(monkeypatch) -> None:
    from app.app_packages import store as store_mod

    remote = {
        "apiVersion": "axionet.store/v1",
        "name": "Remote Store",
        "packages": [
            {
                "id": "varnish",
                "version": "9.9.9",
                "name": "Varnish Remote",
                "summary": "from url",
                "source": "bundled",
                "path": "varnish",
            }
        ],
    }
    monkeypatch.setattr(store_mod, "fetch_store_index_url", lambda _url: remote)
    root = repo_root_from_backend()
    payload = store_entries_with_status(
        repo_root=root,
        store_index_url="https://example.com/index.v1.json",
    )
    assert payload["indexSource"] == "remote"
    assert payload["indexUrl"] == "https://example.com/index.v1.json"
    assert payload["packages"][0]["version"] == "9.9.9"


def test_store_falls_back_when_remote_fails(monkeypatch) -> None:
    from app.app_packages import store as store_mod

    def _boom(_url: str):
        raise RuntimeError("network down")

    monkeypatch.setattr(store_mod, "fetch_store_index_url", _boom)
    root = repo_root_from_backend()
    payload = store_entries_with_status(
        repo_root=root,
        store_index_url="https://example.com/down.json",
    )
    assert payload["indexSource"] == "bundled"
    assert any(item["id"] == "varnish" for item in payload["packages"])


def test_install_bundled_already_installed(monkeypatch) -> None:
    monkeypatch.delenv("AXIONET_STORE_INDEX_URL", raising=False)
    monkeypatch.delenv("AXIONET_APPS_DIR", raising=False)
    monkeypatch.delenv("AXIONET_APPS_SEED_DIR", raising=False)
    root = repo_root_from_backend()
    result = install_from_store("varnish", repo_root=root)
    assert result["id"] == "varnish"
    assert result["status"] == "already_installed"


def test_ensure_seed_copies_into_writable_dir(tmp_path: Path, monkeypatch) -> None:
    monkeypatch.delenv("AXIONET_APPS_DIR", raising=False)
    monkeypatch.delenv("AXIONET_APPS_SEED_DIR", raising=False)
    root = repo_root_from_backend()
    seed = root / "packages" / "apps"
    dest = tmp_path / "apps"
    ensure_apps_seeded(dest, seed)
    assert (dest / "varnish" / "axionet-app.json").is_file()
    # Idempotent
    ensure_apps_seeded(dest, seed)
    assert resolve_store_index_path(repo_root=root).is_file()
