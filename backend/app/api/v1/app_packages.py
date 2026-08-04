"""Publish axionet.app/v1 packages to Catalog / Designer clients."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query, status

from app.app_packages.loader import (
    LoadedAppPackage,
    derive_flow_from_designer,
    get_loaded_package,
    list_loaded_packages,
)
from app.core.config import get_settings
from app.schemas.app_packages import AppPackageRead, AppPackageSummary, DesignerManifestRead

router = APIRouter(prefix="/app-packages", tags=["app-packages"])


def _path_kwargs() -> dict[str, str | None]:
    settings = get_settings()
    return {
        "apps_dir": settings.axionet_apps_dir or None,
        "schemas_dir": settings.axionet_schemas_dir or None,
    }


def _to_summary(package: LoadedAppPackage) -> AppPackageSummary:
    caps = package.root.get("capabilities") or {}
    return AppPackageSummary(
        id=package.id,
        serviceType=package.service_type,
        version=package.version,
        name=str(package.catalog.get("name") or package.id),
        summary=str(package.catalog.get("summary") or ""),
        reference=package.reference,
        hydrate=caps.get("hydrate") or "none",
        actions=list(caps.get("actions") or []),
    )


def _to_read(package: LoadedAppPackage) -> AppPackageRead:
    flow_nodes, flow_edges = derive_flow_from_designer(package.designer)
    return AppPackageRead(
        id=package.id,
        serviceType=package.service_type,
        version=package.version,
        reference=package.reference,
        capabilities=dict(package.root.get("capabilities") or {}),
        catalog=package.catalog,
        designer=package.designer,
        instanceSchema=package.instance_schema,
        desiredStateExample=package.desired_state_example,
        flowNodes=flow_nodes,
        flowEdges=flow_edges,
    )


@router.get("", response_model=list[AppPackageSummary])
def list_app_packages(
    include_reference: bool = Query(False, alias="includeReference"),
) -> list[AppPackageSummary]:
    packages = list_loaded_packages(include_reference=include_reference, **_path_kwargs())
    return [_to_summary(package) for package in packages]


@router.get("/designer-manifests", response_model=list[DesignerManifestRead])
def list_designer_manifests(
    include_reference: bool = Query(False, alias="includeReference"),
) -> list[DesignerManifestRead]:
    packages = list_loaded_packages(include_reference=include_reference, **_path_kwargs())
    return [DesignerManifestRead.model_validate(package.designer) for package in packages]


@router.get("/{package_id}", response_model=AppPackageRead)
def get_app_package(
    package_id: str,
    include_reference: bool = Query(True, alias="includeReference"),
) -> AppPackageRead:
    package = get_loaded_package(
        package_id,
        include_reference=include_reference,
        **_path_kwargs(),
    )
    if package is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="App package not found")
    return _to_read(package)
