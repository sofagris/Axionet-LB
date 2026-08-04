"""Publish axionet.app/v1 packages to Catalog / Designer clients."""

from __future__ import annotations

import httpx
from fastapi import APIRouter, HTTPException, Query, status

from app.app_packages.loader import (
    LoadedAppPackage,
    derive_flow_from_designer,
    get_loaded_package,
    list_loaded_packages,
    resolve_package_paths,
)
from app.app_packages.store import (
    ensure_apps_seeded,
    install_from_archive_url,
    install_from_store,
    resolve_seed_dir,
    store_entries_with_status,
)
from app.core.config import get_settings
from app.schemas.app_packages import (
    AppPackageCatalogCard,
    AppPackageInstallRequest,
    AppPackageInstallResult,
    AppPackageRead,
    AppPackageSummary,
    AppStoreIndexRead,
    DesignerManifestRead,
)

router = APIRouter(prefix="/app-packages", tags=["app-packages"])


def _path_kwargs() -> dict[str, str | None]:
    settings = get_settings()
    return {
        "apps_dir": settings.axionet_apps_dir or None,
        "schemas_dir": settings.axionet_schemas_dir or None,
    }


def _store_kwargs() -> dict[str, str | None]:
    settings = get_settings()
    return {
        **_path_kwargs(),
        "store_index": settings.axionet_store_index or None,
        "store_index_url": settings.axionet_store_index_url or None,
        "seed_dir": settings.axionet_apps_seed_dir or None,
    }


def _ensure_seeded() -> None:
    settings = get_settings()
    paths = resolve_package_paths(**_path_kwargs())
    seed = resolve_seed_dir(seed_dir=settings.axionet_apps_seed_dir or None)
    ensure_apps_seeded(paths.root, seed)


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


def _to_catalog_card(package: LoadedAppPackage) -> AppPackageCatalogCard:
    catalog = package.catalog
    flow_nodes, flow_edges = derive_flow_from_designer(package.designer)
    return AppPackageCatalogCard(
        id=package.id,
        serviceType=package.service_type,
        version=package.version,
        reference=package.reference,
        name=str(catalog.get("name") or package.id),
        summary=str(catalog.get("summary") or ""),
        description=str(catalog.get("description") or catalog.get("summary") or ""),
        kind=str(catalog.get("kind") or "service"),
        category=str(catalog.get("category") or "traffic"),
        brand=dict(catalog.get("brand") or {"monogram": package.id[:2].upper(), "accent": "traffic"}),
        tags=list(catalog.get("tags") or []),
        capabilities=list(catalog.get("capabilities") or []),
        primaryAction=catalog.get("primaryAction"),
        implementationHint=catalog.get("implementationHint"),
        notes=list(catalog.get("notes") or []),
        flowNodes=flow_nodes,
        flowEdges=flow_edges,
    )


@router.get("", response_model=list[AppPackageSummary])
def list_app_packages(
    include_reference: bool = Query(False, alias="includeReference"),
) -> list[AppPackageSummary]:
    _ensure_seeded()
    packages = list_loaded_packages(include_reference=include_reference, **_path_kwargs())
    return [_to_summary(package) for package in packages]


@router.get("/catalog", response_model=list[AppPackageCatalogCard])
def list_app_package_catalog_cards(
    include_reference: bool = Query(False, alias="includeReference"),
) -> list[AppPackageCatalogCard]:
    _ensure_seeded()
    packages = list_loaded_packages(include_reference=include_reference, **_path_kwargs())
    return [_to_catalog_card(package) for package in packages]


@router.get("/designer-manifests", response_model=list[DesignerManifestRead])
def list_designer_manifests(
    include_reference: bool = Query(False, alias="includeReference"),
) -> list[DesignerManifestRead]:
    _ensure_seeded()
    packages = list_loaded_packages(include_reference=include_reference, **_path_kwargs())
    return [DesignerManifestRead.model_validate(package.designer) for package in packages]


@router.get("/store", response_model=AppStoreIndexRead)
def get_app_store(
    include_reference: bool = Query(False, alias="includeReference"),
) -> AppStoreIndexRead:
    payload = store_entries_with_status(include_reference=include_reference, **_store_kwargs())
    return AppStoreIndexRead.model_validate(payload)


@router.post("/install", response_model=AppPackageInstallResult)
def install_app_package(payload: AppPackageInstallRequest) -> AppPackageInstallResult:
    if bool(payload.packageId) == bool(payload.archiveUrl):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Provide exactly one of packageId or archiveUrl",
        )
    try:
        if payload.archiveUrl:
            result = install_from_archive_url(payload.archiveUrl, **_path_kwargs())
        else:
            assert payload.packageId is not None
            result = install_from_store(payload.packageId, **_store_kwargs())
    except KeyError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except httpx.HTTPError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to download archive: {exc}",
        ) from exc
    return AppPackageInstallResult.model_validate(result)


@router.get("/{package_id}", response_model=AppPackageRead)
def get_app_package(
    package_id: str,
    include_reference: bool = Query(True, alias="includeReference"),
) -> AppPackageRead:
    _ensure_seeded()
    package = get_loaded_package(
        package_id,
        include_reference=include_reference,
        **_path_kwargs(),
    )
    if package is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="App package not found")
    return _to_read(package)
