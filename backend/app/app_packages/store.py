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
from typing import Any
from urllib.parse import urlparse

from app.app_packages.contract import repo_root_from_backend, validate_app_package
from app.app_packages.loader import (
    get_loaded_package,
    list_loaded_packages,
    resolve_package_paths,
)


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


def load_store_index(index_path: Path) -> dict[str, Any]:
    with index_path.open(encoding="utf-8") as handle:
        data = json.load(handle)
    if data.get("apiVersion") != "axionet.store/v1":
        raise ValueError("Unsupported store apiVersion")
    if not isinstance(data.get("packages"), list):
        raise ValueError("Store index packages must be a list")
    return data


def store_entries_with_status(
    *,
    include_reference: bool = False,
    apps_dir: str | None = None,
    schemas_dir: str | None = None,
    store_index: str | None = None,
    seed_dir: str | None = None,
    repo_root: Path | None = None,
) -> dict[str, Any]:
    paths = resolve_package_paths(apps_dir=apps_dir, schemas_dir=schemas_dir, repo_root=repo_root)
    seed = resolve_seed_dir(seed_dir=seed_dir, repo_root=repo_root)
    ensure_apps_seeded(paths.root, seed)

    index_path = resolve_store_index_path(store_index=store_index, repo_root=repo_root)
    if not index_path.is_file():
        return {"apiVersion": "axionet.store/v1", "name": "Axionet App Store", "packages": []}

    index = load_store_index(index_path)
    installed = {
        package.id: package
        for package in list_loaded_packages(
            include_reference=include_reference,
            apps_dir=str(paths.root),
            schemas_dir=str(paths.schemas_dir),
        )
    }

    packages_out: list[dict[str, Any]] = []
    for entry in index.get("packages") or []:
        if not isinstance(entry, dict):
            continue
        pkg_id = str(entry.get("id") or "")
        loaded = installed.get(pkg_id)
        packages_out.append(
            {
                **entry,
                "installed": loaded is not None,
                "installedVersion": loaded.version if loaded else None,
            }
        )
    return {
        "apiVersion": index.get("apiVersion", "axionet.store/v1"),
        "name": index.get("name", "Axionet App Store"),
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
            # PEP 706 filter when available (3.12+)
            extract_kwargs: dict[str, Any] = {}
            if hasattr(tarfile, "data_filter"):
                extract_kwargs["filter"] = "data"
            archive.extractall(dest, **extract_kwargs)
    return _find_package_root(dest)


def _safe_https_url(url: str) -> str:
    parsed = urlparse(url)
    if parsed.scheme != "https" or not parsed.netloc:
        raise ValueError("archiveUrl must be an https URL")
    return url


def install_from_archive_url(
    archive_url: str,
    *,
    apps_dir: str | None = None,
    schemas_dir: str | None = None,
    repo_root: Path | None = None,
) -> dict[str, Any]:
    import httpx

    url = _safe_https_url(archive_url)
    paths = resolve_package_paths(apps_dir=apps_dir, schemas_dir=schemas_dir, repo_root=repo_root)
    paths.root.mkdir(parents=True, exist_ok=True)

    with httpx.Client(timeout=60.0, follow_redirects=True) as client:
        response = client.get(url)
        response.raise_for_status()
        payload = response.content

    path_lower = urlparse(url).path.lower()
    if path_lower.endswith(".tar.gz") or path_lower.endswith(".tgz"):
        suffix = ".tar.gz"
    elif path_lower.endswith(".tar"):
        suffix = ".tar"
    else:
        suffix = ".zip"

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
    seed_dir: str | None = None,
    repo_root: Path | None = None,
) -> dict[str, Any]:
    paths = resolve_package_paths(apps_dir=apps_dir, schemas_dir=schemas_dir, repo_root=repo_root)
    seed = resolve_seed_dir(seed_dir=seed_dir, repo_root=repo_root)
    ensure_apps_seeded(paths.root, seed)

    index_path = resolve_store_index_path(store_index=store_index, repo_root=repo_root)
    if not index_path.is_file():
        raise KeyError("Store index not found")
    index = load_store_index(index_path)
    entry = next(
        (
            item
            for item in index.get("packages") or []
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
