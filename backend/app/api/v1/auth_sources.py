from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.core.security import require_roles
from app.db.session import get_db
from app.models.user import User
from app.schemas.auth_sources import (
    AppIdentityProviderCreate,
    AppIdentityProviderRead,
    AppIdentityProviderUpdate,
    AuthSourceCreate,
    AuthSourceRead,
    AuthSourceUpdate,
    UpnSuffixCreate,
    UpnSuffixRead,
    UpnSuffixUpdate,
)
from app.services.audit.service import AuditService
from app.services.auth_sources.service import AuthSourceError, AuthSourceService

router = APIRouter(
    prefix="/auth-sources",
    tags=["auth-sources"],
    dependencies=[Depends(require_roles("admin"))],
)


def get_service(db: Session = Depends(get_db)) -> AuthSourceService:
    return AuthSourceService(db)


def _source_read(source) -> AuthSourceRead:
    return AuthSourceRead(
        id=source.id,
        name=source.name,
        kind=source.kind,
        enabled=source.enabled,
        description=source.description,
        issuer_url=source.issuer_url,
        client_id=source.client_id,
        has_client_secret=bool(source.client_secret),
        scopes=source.scopes,
        claim_username=source.claim_username,
        claim_groups=source.claim_groups,
        created_at=source.created_at,
        updated_at=source.updated_at,
    )


def _suffix_read(row) -> UpnSuffixRead:
    source = row.auth_source
    return UpnSuffixRead(
        id=row.id,
        suffix=row.suffix,
        auth_source_id=row.auth_source_id,
        auth_source_name=source.name if source else "",
        auth_source_kind=source.kind if source else "",
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


@router.get("", response_model=list[AuthSourceRead])
def list_sources(service: AuthSourceService = Depends(get_service)) -> list[AuthSourceRead]:
    service.ensure_local_source()
    return [_source_read(s) for s in service.list_sources()]


@router.post("", response_model=AuthSourceRead, status_code=status.HTTP_201_CREATED)
def create_source(
    payload: AuthSourceCreate,
    db: Session = Depends(get_db),
    actor: User = Depends(require_roles("admin")),
    service: AuthSourceService = Depends(get_service),
) -> AuthSourceRead:
    try:
        source = service.create_source(payload)
    except AuthSourceError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    AuditService(db).record(
        event_type="auth_sources.create",
        resource_type="auth_source",
        resource_id=source.id,
        actor=actor.username,
        payload={"name": source.name, "kind": source.kind},
        result="ok",
        commit=True,
    )
    return _source_read(source)


@router.get("/upn-suffixes", response_model=list[UpnSuffixRead])
def list_suffixes(service: AuthSourceService = Depends(get_service)) -> list[UpnSuffixRead]:
    service.ensure_local_source()
    return [_suffix_read(s) for s in service.list_suffixes()]


@router.post("/upn-suffixes", response_model=UpnSuffixRead, status_code=status.HTTP_201_CREATED)
def create_suffix(
    payload: UpnSuffixCreate,
    db: Session = Depends(get_db),
    actor: User = Depends(require_roles("admin")),
    service: AuthSourceService = Depends(get_service),
) -> UpnSuffixRead:
    try:
        row = service.create_suffix(payload)
    except AuthSourceError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    AuditService(db).record(
        event_type="auth_upn_suffixes.create",
        resource_type="auth_upn_suffix",
        resource_id=row.id,
        actor=actor.username,
        payload={"suffix": row.suffix, "auth_source_id": row.auth_source_id},
        result="ok",
        commit=True,
    )
    return _suffix_read(row)


@router.patch("/upn-suffixes/{suffix_id}", response_model=UpnSuffixRead)
def update_suffix(
    suffix_id: str,
    payload: UpnSuffixUpdate,
    db: Session = Depends(get_db),
    actor: User = Depends(require_roles("admin")),
    service: AuthSourceService = Depends(get_service),
) -> UpnSuffixRead:
    row = service.get_suffix(suffix_id)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="UPN suffix not found")
    try:
        updated = service.update_suffix(row, payload)
    except AuthSourceError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    AuditService(db).record(
        event_type="auth_upn_suffixes.update",
        resource_type="auth_upn_suffix",
        resource_id=updated.id,
        actor=actor.username,
        payload=payload.model_dump(exclude_unset=True),
        result="ok",
        commit=True,
    )
    return _suffix_read(updated)


@router.delete("/upn-suffixes/{suffix_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_suffix(
    suffix_id: str,
    db: Session = Depends(get_db),
    actor: User = Depends(require_roles("admin")),
    service: AuthSourceService = Depends(get_service),
) -> Response:
    row = service.get_suffix(suffix_id)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="UPN suffix not found")
    try:
        service.delete_suffix(row)
    except AuthSourceError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    AuditService(db).record(
        event_type="auth_upn_suffixes.delete",
        resource_type="auth_upn_suffix",
        resource_id=suffix_id,
        actor=actor.username,
        payload={},
        result="ok",
        commit=True,
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/app-identity-providers", response_model=list[AppIdentityProviderRead])
def list_app_idps(
    customer_id: str | None = None,
    service: AuthSourceService = Depends(get_service),
) -> list[AppIdentityProviderRead]:
    return [
        AppIdentityProviderRead.model_validate(row, from_attributes=True)
        for row in service.list_app_idps(customer_id=customer_id)
    ]


@router.post(
    "/app-identity-providers",
    response_model=AppIdentityProviderRead,
    status_code=status.HTTP_201_CREATED,
)
def create_app_idp(
    payload: AppIdentityProviderCreate,
    db: Session = Depends(get_db),
    actor: User = Depends(require_roles("admin")),
    service: AuthSourceService = Depends(get_service),
) -> AppIdentityProviderRead:
    try:
        row = service.create_app_idp(payload)
    except AuthSourceError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    AuditService(db).record(
        event_type="app_identity_providers.create",
        resource_type="app_identity_provider",
        resource_id=row.id,
        actor=actor.username,
        payload={"name": row.name, "kind": row.kind},
        result="ok",
        commit=True,
    )
    return AppIdentityProviderRead.model_validate(row, from_attributes=True)


@router.patch("/app-identity-providers/{idp_id}", response_model=AppIdentityProviderRead)
def update_app_idp(
    idp_id: str,
    payload: AppIdentityProviderUpdate,
    db: Session = Depends(get_db),
    actor: User = Depends(require_roles("admin")),
    service: AuthSourceService = Depends(get_service),
) -> AppIdentityProviderRead:
    row = service.get_app_idp(idp_id)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="App IdP not found")
    try:
        updated = service.update_app_idp(row, payload)
    except AuthSourceError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    AuditService(db).record(
        event_type="app_identity_providers.update",
        resource_type="app_identity_provider",
        resource_id=updated.id,
        actor=actor.username,
        payload=payload.model_dump(exclude_unset=True),
        result="ok",
        commit=True,
    )
    return AppIdentityProviderRead.model_validate(updated, from_attributes=True)


@router.delete("/app-identity-providers/{idp_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_app_idp(
    idp_id: str,
    db: Session = Depends(get_db),
    actor: User = Depends(require_roles("admin")),
    service: AuthSourceService = Depends(get_service),
) -> Response:
    row = service.get_app_idp(idp_id)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="App IdP not found")
    service.delete_app_idp(row)
    AuditService(db).record(
        event_type="app_identity_providers.delete",
        resource_type="app_identity_provider",
        resource_id=idp_id,
        actor=actor.username,
        payload={},
        result="ok",
        commit=True,
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.patch("/{source_id}", response_model=AuthSourceRead)
def update_source(
    source_id: str,
    payload: AuthSourceUpdate,
    db: Session = Depends(get_db),
    actor: User = Depends(require_roles("admin")),
    service: AuthSourceService = Depends(get_service),
) -> AuthSourceRead:
    source = service.get_source(source_id)
    if source is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Auth source not found")
    try:
        updated = service.update_source(source, payload)
    except AuthSourceError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    AuditService(db).record(
        event_type="auth_sources.update",
        resource_type="auth_source",
        resource_id=updated.id,
        actor=actor.username,
        payload=payload.model_dump(exclude_unset=True, exclude={"client_secret"}),
        result="ok",
        commit=True,
    )
    return _source_read(updated)


@router.delete("/{source_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_source(
    source_id: str,
    db: Session = Depends(get_db),
    actor: User = Depends(require_roles("admin")),
    service: AuthSourceService = Depends(get_service),
) -> Response:
    source = service.get_source(source_id)
    if source is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Auth source not found")
    try:
        service.delete_source(source)
    except AuthSourceError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    AuditService(db).record(
        event_type="auth_sources.delete",
        resource_type="auth_source",
        resource_id=source_id,
        actor=actor.username,
        payload={},
        result="ok",
        commit=True,
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)
