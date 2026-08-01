from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.core.security import require_roles
from app.db.session import get_db
from app.models.auth_source import AppIdpBinding
from app.models.user import User
from app.schemas.auth_sources import AppIdpBindingCreate, AppIdpBindingRead
from app.services.audit.service import AuditService
from app.services.auth_sources.service import AuthSourceError, AuthSourceService

router = APIRouter(prefix="/app-idp-bindings", tags=["app-idp-bindings"])


def get_service(db: Session = Depends(get_db)) -> AuthSourceService:
    return AuthSourceService(db)


def _binding_read(row: AppIdpBinding) -> AppIdpBindingRead:
    provider = row.provider
    return AppIdpBindingRead(
        id=row.id,
        app_identity_provider_id=row.app_identity_provider_id,
        app_identity_provider_name=provider.name if provider else "",
        app_identity_provider_kind=provider.kind if provider else "",
        app_identity_provider_enabled=provider.enabled if provider else True,
        customer_id=row.customer_id,
        application_id=row.application_id,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


@router.get("", response_model=list[AppIdpBindingRead])
def list_bindings(
    customer_id: str | None = None,
    application_id: str | None = None,
    service: AuthSourceService = Depends(get_service),
) -> list[AppIdpBindingRead]:
    """Any authenticated user may list bindings (Customers UI)."""
    return [
        _binding_read(row)
        for row in service.list_bindings(customer_id=customer_id, application_id=application_id)
    ]


@router.post("", response_model=AppIdpBindingRead, status_code=status.HTTP_201_CREATED)
def create_binding(
    payload: AppIdpBindingCreate,
    db: Session = Depends(get_db),
    actor: User = Depends(require_roles("admin")),
    service: AuthSourceService = Depends(get_service),
) -> AppIdpBindingRead:
    try:
        row = service.create_binding(payload)
    except AuthSourceError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    AuditService(db).record(
        event_type="app_idp_bindings.create",
        resource_type="app_idp_binding",
        resource_id=row.id,
        actor=actor.username,
        payload={
            "app_identity_provider_id": row.app_identity_provider_id,
            "customer_id": row.customer_id,
            "application_id": row.application_id,
        },
        result="ok",
        commit=True,
    )
    return _binding_read(row)


@router.delete("/{binding_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_binding(
    binding_id: str,
    db: Session = Depends(get_db),
    actor: User = Depends(require_roles("admin")),
    service: AuthSourceService = Depends(get_service),
) -> Response:
    row = service.get_binding(binding_id)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Binding not found")
    service.delete_binding(row)
    AuditService(db).record(
        event_type="app_idp_bindings.delete",
        resource_type="app_idp_binding",
        resource_id=binding_id,
        actor=actor.username,
        payload={},
        result="ok",
        commit=True,
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)
