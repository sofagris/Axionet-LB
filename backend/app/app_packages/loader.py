"""Load published axionet.app/v1 packages from disk."""

from __future__ import annotations

import json
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from app.app_packages.contract import (
    PackagePaths,
    iter_app_packages,
    repo_root_from_backend,
    resolve_package_files,
    validate_app_package,
)


@dataclass(frozen=True)
class LoadedAppPackage:
    """Validated package ready for Catalog / Designer APIs."""

    directory_name: str
    reference: bool
    root: dict[str, Any]
    catalog: dict[str, Any]
    designer: dict[str, Any]
    instance_schema: dict[str, Any]
    desired_state_example: dict[str, Any]
    icon_relpath: str

    @property
    def id(self) -> str:
        return str(self.root["id"])

    @property
    def service_type(self) -> str:
        return str(self.root["serviceType"])

    @property
    def version(self) -> str:
        return str(self.root["version"])


def resolve_package_paths(
    *,
    apps_dir: str | None = None,
    schemas_dir: str | None = None,
    repo_root: Path | None = None,
) -> PackagePaths:
    env_apps = apps_dir or os.environ.get("AXIONET_APPS_DIR")
    env_schemas = schemas_dir or os.environ.get("AXIONET_SCHEMAS_DIR")
    if env_apps and env_schemas:
        return PackagePaths(root=Path(env_apps), schemas_dir=Path(env_schemas))
    root = repo_root or repo_root_from_backend()
    return PackagePaths.from_repo(root)


def _load_json(path: Path) -> Any:
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


def load_app_package(package_dir: Path, schemas_dir: Path) -> LoadedAppPackage:
    errors = validate_app_package(package_dir, schemas_dir)
    if errors:
        raise ValueError("; ".join(errors))

    root = _load_json(package_dir / "axionet-app.json")
    files = resolve_package_files(root)
    return LoadedAppPackage(
        directory_name=package_dir.name,
        reference=package_dir.name.startswith("_"),
        root=root,
        catalog=_load_json(package_dir / files["catalog"]),
        designer=_load_json(package_dir / files["designer"]),
        instance_schema=_load_json(package_dir / files["instanceSchema"]),
        desired_state_example=_load_json(package_dir / files["desiredStateExample"]),
        icon_relpath=files["icon"],
    )


def list_loaded_packages(
    *,
    include_reference: bool = False,
    apps_dir: str | None = None,
    schemas_dir: str | None = None,
    repo_root: Path | None = None,
) -> list[LoadedAppPackage]:
    paths = resolve_package_paths(apps_dir=apps_dir, schemas_dir=schemas_dir, repo_root=repo_root)
    if not paths.root.is_dir():
        return []

    loaded: list[LoadedAppPackage] = []
    for package_dir in iter_app_packages(paths.root):
        is_reference = package_dir.name.startswith("_")
        if is_reference and not include_reference:
            continue
        try:
            loaded.append(load_app_package(package_dir, paths.schemas_dir))
        except ValueError:
            # Skip invalid packages at publish time; CI validates separately.
            continue
    return loaded


def get_loaded_package(
    package_id: str,
    *,
    include_reference: bool = True,
    apps_dir: str | None = None,
    schemas_dir: str | None = None,
    repo_root: Path | None = None,
) -> LoadedAppPackage | None:
    for package in list_loaded_packages(
        include_reference=include_reference,
        apps_dir=apps_dir,
        schemas_dir=schemas_dir,
        repo_root=repo_root,
    ):
        if package.id == package_id:
            return package
    return None


def derive_flow_from_designer(designer: dict[str, Any]) -> tuple[list[dict[str, str]], list[dict[str, str]]]:
    """Derive Catalog flowNodes / flowEdges from designer.json."""
    nodes = [
        {
            "id": str(component["id"]),
            "label": str(component["label"]),
            "role": str(component["role"]),
        }
        for component in designer.get("components") or []
    ]
    edges = [
        {
            "from": str(edge["from"]),
            "to": str(edge["to"]),
            **({"label": str(edge["label"])} if edge.get("label") else {}),
        }
        for edge in designer.get("chain") or []
    ]
    return nodes, edges
