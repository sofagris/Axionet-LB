"""Operator App Store sources + trust policy API."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Response, status

from app.app_packages import sources as sources_mod
from app.app_packages import trust as trust_mod
from app.core.config import get_settings
from app.schemas.app_packages import (
    AppStoreSource,
    AppStoreSourceCreate,
    AppStoreSourcesReplace,
    AppStoreTrustKey,
    AppStoreTrustKeyCreate,
    AppStoreTrustRead,
    AppStoreTrustUpdate,
)

router = APIRouter(prefix="/app-store", tags=["app-store"])


def _data_dir() -> str:
    return get_settings().data_dir


@router.get("/sources", response_model=list[AppStoreSource])
def list_sources() -> list[AppStoreSource]:
    return [AppStoreSource.model_validate(item) for item in sources_mod.load_sources(data_dir=_data_dir())]


@router.put("/sources", response_model=list[AppStoreSource])
def replace_sources(payload: AppStoreSourcesReplace) -> list[AppStoreSource]:
    try:
        saved = sources_mod.replace_sources(
            [item.model_dump() for item in payload.sources],
            data_dir=_data_dir(),
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return [AppStoreSource.model_validate(item) for item in saved]


@router.post("/sources", response_model=AppStoreSource, status_code=status.HTTP_201_CREATED)
def create_source(payload: AppStoreSourceCreate) -> AppStoreSource:
    try:
        created = sources_mod.add_source(
            name=payload.name,
            index_url=payload.indexUrl,
            source_id=payload.id,
            enabled=payload.enabled,
            priority=payload.priority,
            data_dir=_data_dir(),
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return AppStoreSource.model_validate(created)


@router.delete("/sources/{source_id}", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
def remove_source(source_id: str) -> Response:
    try:
        sources_mod.delete_source(source_id, data_dir=_data_dir())
    except KeyError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/trust", response_model=AppStoreTrustRead)
def get_trust() -> AppStoreTrustRead:
    return AppStoreTrustRead.model_validate(trust_mod.load_trust(data_dir=_data_dir()))


@router.put("/trust", response_model=AppStoreTrustRead)
def put_trust(payload: AppStoreTrustUpdate) -> AppStoreTrustRead:
    current = trust_mod.load_trust(data_dir=_data_dir())
    next_payload = {
        "allowUnsignedPackages": payload.allowUnsignedPackages,
        "keys": [item.model_dump() for item in payload.keys]
        if payload.keys is not None
        else current.get("keys") or [],
    }
    try:
        for key in next_payload["keys"]:
            trust_mod.validate_public_key(str(key.get("publicKey") or ""))
        saved = trust_mod.save_trust(next_payload, data_dir=_data_dir())
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return AppStoreTrustRead.model_validate(saved)


@router.post("/trust/keys", response_model=AppStoreTrustKey, status_code=status.HTTP_201_CREATED)
def create_trust_key(payload: AppStoreTrustKeyCreate) -> AppStoreTrustKey:
    try:
        created = trust_mod.add_trust_key(
            name=payload.name,
            public_key=payload.publicKey,
            key_id=payload.id,
            data_dir=_data_dir(),
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return AppStoreTrustKey.model_validate(created)


@router.delete("/trust/keys/{key_id}", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
def remove_trust_key(key_id: str) -> Response:
    try:
        trust_mod.delete_trust_key(key_id, data_dir=_data_dir())
    except KeyError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return Response(status_code=status.HTTP_204_NO_CONTENT)
