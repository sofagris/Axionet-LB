"""App Store index + install into the local package directory."""

from __future__ import annotations

import io
import json
import os
import shutil
import tarfile
import tempfile
import zipfile
from pathlib import Path
from typing import Any, Literal
from urllib.parse import urlparse

from app.app_packages.contract import repo_root_from_backend, validate_app_package
from app.app_packages.loader import (
    get_loaded_package,
    list_loaded_packages,
    resolve_package_paths,
)
from app.app_packages.sources import enabled_sources_sorted
from app.app_packages.trust import enforce_archive_trust


def resolve_store_index_path(
    *,
    store_index: str | None = None,
    repo_root: Path | None = None,
) -> Path:
    env = store_index or os.environ.get("AXIONET_STORE_INDEX")
    if env:
        return Path(env)
    root = repo_root or repo_root_from_backend()
    return root / "packages" / "store" / "index.v1.json"


def resolve_seed_dir(*, seed_dir: str | None = None, repo_root: Path | None = None) -> Path:
    env = seed_dir or os.environ.get("AXIONET_APPS_SEED_DIR")
    if env:
        return Path(env)
    root = repo_root or repo_root_from_backend()
    return root / "packages" / "apps"


def ensure_apps_seeded(apps_dir: Path, seed_dir: Path) -> None:
    """Copy bundled packages into the writable apps dir when missing."""
    if not seed_dir.is_dir():
        return
    if apps_dir.resolve() == seed_dir.resolve():
        return
    apps_dir.mkdir(parents=True, exist_ok=True)
    for package_dir in seed_dir.iterdir():
        if not package_dir.is_dir():
            continue
        if not (package_dir / "axionet-app.json").is_file():
            continue
        dest = apps_dir / package_dir.name
        if dest.exists():
            continue
        shutil.copytree(package_dir, dest)


def load_store_index_data(data: dict[str, Any]) -> dict[str, Any]:
    if data.get("apiVersion") != "axionet.store/v1":
        raise ValueError("Unsupported store apiVersion")
    if not isinstance(data.get("packages"), list):
        raise ValueError("Store index packages must be a list")
    return data


def load_store_index(index_path: Path) -> dict[str, Any]:
    with index_path.open(encoding="utf-8") as handle:
        data = json.load(handle)
    return load_store_index_data(data)


def _safe_https_url(url: str) -> str:
    parsed = urlparse(url)
    if parsed.scheme != "https" or not parsed.netloc:
        raise ValueError("archiveUrl must be an https URL")
    return url


def fetch_store_index_url(url: str) -> dict[str, Any]:
    import httpx

    safe = _safe_https_url(url)
    with httpx.Client(timeout=15.0, follow_redirects=True) as client:
        response = client.get(safe)
        response.raise_for_status()
        data = response.json()
    if not isinstance(data, dict):
        raise ValueError("Store index URL must return a JSON object")
    return load_store_index_data(data)


def resolve_store_document(
    *,
    store_index: str | None = None,
    store_index_url: str | None = None,
    repo_root: Path | None = None,
) -> tuple[dict[str, Any], Literal["remote", "bundled"], str | None]:
    """
    Prefer explicit / env AXIONET_STORE_INDEX_URL. Fall back to bundled file.
    Returns (index, source, url_or_none).
    """
    url = (store_index_url or os.environ.get("AXIONET_STORE_INDEX_URL") or "").strip()
    if url:
        try:
            return fetch_store_index_url(url), "remote", url
        except Exception:
            pass

    index_path = resolve_store_index_path(store_index=store_index, repo_root=repo_root)
    if not index_path.is_file():
        return (
            {"apiVersion": "axionet.store/v1", "name": "Axionet App Store", "packages": []},
            "bundled",
            None,
        )
    return load_store_index(index_path), "bundled", None


def merge_store_indexes(
    *,
    data_dir: str | None = None,
    store_index: str | None = None,
    store_index_url: str | None = None,
    repo_root: Path | None = None,
) -> dict[str, Any]:
    """
    Merge enabled operator sources (higher priority wins on package id).
    Always includes bundled fallback packages for ids not covered by remotes,
    using lower priority than configured sources.
    """
    by_id: dict[str, dict[str, Any]] = {}
    sources_meta: list[dict[str, Any]] = []

    configured = enabled_sources_sorted(data_dir=data_dir)
    if configured:
        for source in configured:
            url = str(source.get("indexUrl") or "")
            try:
                index = fetch_store_index_url(url)
                index_source: Literal["remote", "bundled"] = "remote"
            except Exception:
                # Fall back to bundled file for this source slot when remote fails.
                index, index_source, _ = resolve_store_document(
                    store_index=store_index,
                    store_index_url="",
                    repo_root=repo_root,
                )
            sources_meta.append(
                {
                    "id": source["id"],
                    "name": source["name"],
                    "indexUrl": url,
                    "indexSource": index_source,
                    "priority": source.get("priority", 0),
                }
            )
            for entry in index.get("packages") or []:
                if not isinstance(entry, dict):
                    continue
                pkg_id = str(entry.get("id") or "")
                if not pkg_id or pkg_id in by_id:
                    continue
                by_id[pkg_id] = {
                    **entry,
                    "storeId": source["id"],
                    "storeName": source["name"],
                    "signatureUrl": entry.get("signatureUrl"),
                }
    else:
        index, index_source, index_url = resolve_store_document(
            store_index=store_index,
            store_index_url=store_index_url,
            repo_root=repo_root,
        )
        sources_meta.append(
            {
                "id": "default",
                "name": index.get("name", "Axionet App Store"),
                "indexUrl": index_url,
                "indexSource": index_source,
                "priority": 0,
            }
        )
        for entry in index.get("packages") or []:
            if not isinstance(entry, dict):
                continue
            pkg_id = str(entry.get("id") or "")
            if not pkg_id:
                continue
            by_id[pkg_id] = {
                **entry,
                "storeId": "default",
                "storeName": index.get("name", "Axionet App Store"),
                "signatureUrl": entry.get("signatureUrl"),
            }

    # Bundled fill-in for ids missing from remotes (lowest priority).
    bundled, _, _ = resolve_store_document(
        store_index=store_index,
        store_index_url="",
        repo_root=repo_root,
    )
    for entry in bundled.get("packages") or []:
        if not isinstance(entry, dict):
            continue
        pkg_id = str(entry.get("id") or "")
        if not pkg_id or pkg_id in by_id:
            continue
        by_id[pkg_id] = {
            **entry,
            "storeId": "bundled",
            "storeName": bundled.get("name", "Bundled"),
            "signatureUrl": entry.get("signatureUrl"),
        }

    return {
        "apiVersion": "axionet.store/v1",
        "name": "Axionet App Store",
        "indexSource": "remote" if any(s.get("indexSource") == "remote" for s in sources_meta) else "bundled",
        "indexUrl": next((s.get("indexUrl") for s in sources_meta if s.get("indexUrl")), None),
        "sources": sources_meta,
        "packages": list(by_id.values()),
    }


def store_entries_with_status(
    *,
    include_reference: bool = False,
    apps_dir: str | None = None,
    schemas_dir: str | None = None,
    store_index: str | None = None,
    store_index_url: str | None = None,
    seed_dir: str | None = None,
    repo_root: Path | None = None,
    data_dir: str | None = None,
) -> dict[str, Any]:
    paths = resolve_package_paths(apps_dir=apps_dir, schemas_dir=schemas_dir, repo_root=repo_root)
    seed = resolve_seed_dir(seed_dir=seed_dir, repo_root=repo_root)
    ensure_apps_seeded(paths.root, seed)

    merged = merge_store_indexes(
        data_dir=data_dir,
        store_index=store_index,
        store_index_url=store_index_url,
        repo_root=repo_root,
    )
    installed = {
        package.id: package
        for package in list_loaded_packages(
            include_reference=include_reference,
            apps_dir=str(paths.root),
            schemas_dir=str(paths.schemas_dir),
        )
    }

    packages_out: list[dict[str, Any]] = []
    for entry in merged.get("packages") or []:
        if not isinstance(entry, dict):
            continue
        pkg_id = str(entry.get("id") or "")
        loaded = installed.get(pkg_id)
        has_archive = bool(entry.get("archiveUrl"))
        packages_out.append(
            {
                **entry,
                "installed": loaded is not None,
                "installedVersion": loaded.version if loaded else None,
                "signing": "required" if has_archive else "not_applicable",
            }
        )
    return {
        "apiVersion": merged.get("apiVersion", "axionet.store/v1"),
        "name": merged.get("name", "Axionet App Store"),
        "indexSource": merged.get("indexSource", "bundled"),
        "indexUrl": merged.get("indexUrl"),
        "sources": merged.get("sources") or [],
        "packages": packages_out,
    }


def _find_package_root(extract_root: Path) -> Path:
    if (extract_root / "axionet-app.json").is_file():
        return extract_root
    candidates = [path.parent for path in extract_root.rglob("axionet-app.json") if path.is_file()]
    if not candidates:
        raise ValueError("Archive does not contain axionet-app.json")
    candidates.sort(key=lambda path: len(path.parts))
    return candidates[0]


def _assert_within(base: Path, target: Path) -> None:
    base_resolved = base.resolve()
    target_resolved = target.resolve()
    if base_resolved != target_resolved and base_resolved not in target_resolved.parents:
        raise ValueError("Archive contains paths outside the extract directory")


def _extract_archive(payload: bytes, suffix: str, dest: Path) -> Path:
    dest.mkdir(parents=True, exist_ok=True)
    buffer = io.BytesIO(payload)
    if suffix == ".zip":
        with zipfile.ZipFile(buffer) as archive:
            for info in archive.infolist():
                target = dest / info.filename
                _assert_within(dest, target if not info.is_dir() else target)
            archive.extractall(dest)
    else:
        buffer.seek(0)
        with tarfile.open(fileobj=buffer, mode="r:*") as archive:
            for member in archive.getmembers():
                target = dest / member.name
                _assert_within(dest, target)
            extract_kwargs: dict[str, Any] = {}
            if hasattr(tarfile, "data_filter"):
                extract_kwargs["filter"] = "data"
            archive.extractall(dest, **extract_kwargs)
    return _find_package_root(dest)


def _archive_suffix(url: str) -> str:
    path_lower = urlparse(url).path.lower()
    if path_lower.endswith(".tar.gz") or path_lower.endswith(".tgz"):
        return ".tar.gz"
    if path_lower.endswith(".tar"):
        return ".tar"
    return ".zip"


def _fetch_optional_signature(client: Any, archive_url: str, signature_url: str | None) -> bytes | None:
    candidates: list[str] = []
    if signature_url:
        candidates.append(str(signature_url))
    candidates.append(archive_url + ".sig")
    for candidate in candidates:
        try:
            safe = _safe_https_url(candidate)
        except ValueError:
            continue
        try:
            response = client.get(safe)
            if response.status_code == 404:
                continue
            response.raise_for_status()
            if response.content:
                return response.content
        except Exception:
            continue
    return None


def install_from_archive_url(
    archive_url: str,
    *,
    apps_dir: str | None = None,
    schemas_dir: str | None = None,
    repo_root: Path | None = None,
    signature_url: str | None = None,
    data_dir: str | None = None,
    require_trust: bool = True,
) -> dict[str, Any]:
    import httpx

    url = _safe_https_url(archive_url)
    paths = resolve_package_paths(apps_dir=apps_dir, schemas_dir=schemas_dir, repo_root=repo_root)
    paths.root.mkdir(parents=True, exist_ok=True)

    with httpx.Client(timeout=60.0, follow_redirects=True) as client:
        response = client.get(url)
        response.raise_for_status()
        payload = response.content
        signature_bytes = (
            _fetch_optional_signature(client, url, signature_url) if require_trust else None
        )

    if require_trust:
        enforce_archive_trust(
            archive_bytes=payload,
            signature_bytes=signature_bytes,
            data_dir=data_dir,
        )

    suffix = _archive_suffix(url)
    with tempfile.TemporaryDirectory(prefix="axionet-app-") as tmp:
        package_root = _extract_archive(payload, suffix, Path(tmp) / "extract")
        errors = validate_app_package(package_root, paths.schemas_dir)
        if errors:
            raise ValueError("; ".join(errors))
        root_manifest = json.loads((package_root / "axionet-app.json").read_text(encoding="utf-8"))
        package_id = str(root_manifest["id"])
        dest = paths.root / package_id
        already = dest.is_dir() and (dest / "axionet-app.json").is_file()
        if dest.exists():
            shutil.rmtree(dest)
        shutil.copytree(package_root, dest)
        return {
            "id": package_id,
            "version": str(root_manifest.get("version") or ""),
            "status": "already_installed" if already else "installed",
        }


def install_from_store(
    package_id: str,
    *,
    apps_dir: str | None = None,
    schemas_dir: str | None = None,
    store_index: str | None = None,
    store_index_url: str | None = None,
    seed_dir: str | None = None,
    repo_root: Path | None = None,
    data_dir: str | None = None,
) -> dict[str, Any]:
    paths = resolve_package_paths(apps_dir=apps_dir, schemas_dir=schemas_dir, repo_root=repo_root)
    seed = resolve_seed_dir(seed_dir=seed_dir, repo_root=repo_root)
    ensure_apps_seeded(paths.root, seed)

    merged = merge_store_indexes(
        data_dir=data_dir,
        store_index=store_index,
        store_index_url=store_index_url,
        repo_root=repo_root,
    )
    entry = next(
        (
            item
            for item in merged.get("packages") or []
            if isinstance(item, dict) and item.get("id") == package_id
        ),
        None,
    )
    if entry is None:
        raise KeyError(f"Package not found in store index: {package_id}")

    existing = get_loaded_package(
        package_id,
        include_reference=True,
        apps_dir=str(paths.root),
        schemas_dir=str(paths.schemas_dir),
    )
    if existing is not None:
        return {
            "id": existing.id,
            "version": existing.version,
            "status": "already_installed",
        }

    archive_url = entry.get("archiveUrl")
    if archive_url:
        return install_from_archive_url(
            str(archive_url),
            apps_dir=str(paths.root),
            schemas_dir=str(paths.schemas_dir),
            signature_url=str(entry["signatureUrl"]) if entry.get("signatureUrl") else None,
            data_dir=data_dir,
            require_trust=True,
        )

    if entry.get("source") == "bundled":
        rel = str(entry.get("path") or package_id)
        if "/" in rel or "\\" in rel or rel.startswith(".") or rel != Path(rel).name:
            raise ValueError("Invalid bundled package path")
        source = seed / rel
        if not (source / "axionet-app.json").is_file():
            raise ValueError(f"Bundled package missing from seed: {rel}")
        dest = paths.root / package_id
        if dest.exists():
            shutil.rmtree(dest)
        shutil.copytree(source, dest)
        loaded = get_loaded_package(
            package_id,
            include_reference=True,
            apps_dir=str(paths.root),
            schemas_dir=str(paths.schemas_dir),
        )
        if loaded is None:
            raise ValueError("Installed package failed validation")
        return {"id": loaded.id, "version": loaded.version, "status": "installed"}

    raise ValueError("Store entry has no installable source (bundled path or archiveUrl)")
