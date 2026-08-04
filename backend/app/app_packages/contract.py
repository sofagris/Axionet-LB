"""Validate axionet.app/v1 packages against frozen schemas."""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from jsonschema import Draft202012Validator

DEFAULT_FILES = {
    "catalog": "catalog.json",
    "designer": "designer.json",
    "instanceSchema": "config/instance-schema.json",
    "desiredStateExample": "config/desired-state.example.json",
    "icon": "assets/icon.svg",
}

SCHEMA_FILES = {
    "root": "axionet-app-v1.schema.json",
    "catalog": "axionet-app-catalog-v1.schema.json",
    "designer": "axionet-app-designer-v1.schema.json",
}


@dataclass(frozen=True)
class PackagePaths:
    root: Path
    schemas_dir: Path

    @classmethod
    def from_repo(cls, repo_root: Path) -> PackagePaths:
        return cls(
            root=repo_root / "packages" / "apps",
            schemas_dir=repo_root / "docs" / "schemas",
        )


def repo_root_from_backend() -> Path:
    """backend/app/app_packages/contract.py → repo root."""
    return Path(__file__).resolve().parents[3]


def _load_json(path: Path) -> Any:
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


def _load_schema(schemas_dir: Path, name: str) -> dict[str, Any]:
    return _load_json(schemas_dir / name)


def _validate(instance: Any, schema: dict[str, Any], *, label: str) -> list[str]:
    validator = Draft202012Validator(schema)
    return [f"{label}: {error.message}" for error in sorted(validator.iter_errors(instance), key=str)]


def resolve_package_files(root_manifest: dict[str, Any]) -> dict[str, str]:
    overrides = root_manifest.get("files") or {}
    return {key: str(overrides.get(key) or default) for key, default in DEFAULT_FILES.items()}


_FORBIDDEN_SUFFIXES = {".py", ".pyc", ".pyo", ".exe", ".bat", ".cmd", ".ps1", ".sh", ".so", ".dll"}


def _find_forbidden_executables(package_dir: Path) -> list[str]:
    found: list[str] = []
    for path in package_dir.rglob("*"):
        if not path.is_file():
            continue
        if path.suffix.lower() in _FORBIDDEN_SUFFIXES:
            found.append(str(path.relative_to(package_dir)).replace("\\", "/"))
    return found


def validate_app_package(package_dir: Path, schemas_dir: Path) -> list[str]:
    """Return a list of validation errors (empty means OK)."""
    errors: list[str] = []
    root_path = package_dir / "axionet-app.json"
    if not root_path.is_file():
        return [f"missing required file: {root_path.name}"]

    try:
        root = _load_json(root_path)
    except json.JSONDecodeError as exc:
        return [f"axionet-app.json: invalid JSON ({exc})"]

    for rel in _find_forbidden_executables(package_dir):
        errors.append(f"executable payload forbidden in v1 package: {rel}")

    schemas = {key: _load_schema(schemas_dir, filename) for key, filename in SCHEMA_FILES.items()}
    errors.extend(_validate(root, schemas["root"], label="axionet-app.json"))

    files = resolve_package_files(root if isinstance(root, dict) else {})
    loaded: dict[str, Any] = {"root": root}

    for key, rel in files.items():
        path = package_dir / rel
        if not path.is_file():
            errors.append(f"missing required file: {rel}")
            continue
        if key == "icon":
            if path.stat().st_size == 0:
                errors.append(f"{rel}: icon file is empty")
            continue
        try:
            loaded[key] = _load_json(path)
        except json.JSONDecodeError as exc:
            errors.append(f"{rel}: invalid JSON ({exc})")
            continue

    if "catalog" in loaded:
        errors.extend(_validate(loaded["catalog"], schemas["catalog"], label=files["catalog"]))
    if "designer" in loaded:
        errors.extend(_validate(loaded["designer"], schemas["designer"], label=files["designer"]))

    if isinstance(root, dict) and "designer" in loaded and isinstance(loaded["designer"], dict):
        designer = loaded["designer"]
        pkg_id = root.get("id")
        service_type = root.get("serviceType")
        hydrate = (root.get("capabilities") or {}).get("hydrate")
        if designer.get("catalogId") != pkg_id:
            errors.append("designer.catalogId must match axionet-app.json id")
        if designer.get("serviceType") != service_type:
            errors.append("designer.serviceType must match axionet-app.json serviceType")
        designer_hydrate = designer.get("hydrate")
        if designer_hydrate is not None and designer_hydrate != hydrate:
            errors.append("designer.hydrate must match capabilities.hydrate when set")

    if "instanceSchema" in loaded and "desiredStateExample" in loaded:
        errors.extend(
            _validate(
                loaded["desiredStateExample"],
                loaded["instanceSchema"],
                label=files["desiredStateExample"],
            )
        )

    return errors


def iter_app_packages(apps_dir: Path) -> list[Path]:
    if not apps_dir.is_dir():
        return []
    return sorted(
        path for path in apps_dir.iterdir() if path.is_dir() and (path / "axionet-app.json").is_file()
    )


def validate_all_app_packages(repo_root: Path | None = None) -> dict[str, list[str]]:
    root = repo_root or repo_root_from_backend()
    paths = PackagePaths.from_repo(root)
    return {
        package.name: validate_app_package(package, paths.schemas_dir)
        for package in iter_app_packages(paths.root)
    }
