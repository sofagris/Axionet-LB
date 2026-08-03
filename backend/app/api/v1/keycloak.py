from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.core.security import require_roles
from app.db.session import get_db
from app.models.user import User
from app.plugins.keycloak.common import overview_payload
from app.schemas.keycloak import (
    KeycloakOverview,
    KeycloakWireAppIdpRequest,
    KeycloakWireAppIdpResponse,
    KeycloakWireOidcRequest,
    KeycloakWireOidcResponse,
)
from app.services.audit.service import AuditService
from app.services.docker.client import DockerClientAdapter, create_docker_adapter
from app.services.instances.service import InstanceService
from app.services.keycloak.wire_app_idp import wire_app_idp
from app.services.keycloak.wire_oidc import KeycloakWireError, wire_platform_oidc

router = APIRouter(prefix="/instances/{instance_id}/keycloak", tags=["keycloak"])


def get_docker_adapter(settings: Settings = Depends(get_settings)) -> DockerClientAdapter:
    return create_docker_adapter(settings)


def get_instance_service(
    db: Session = Depends(get_db),
    docker: DockerClientAdapter = Depends(get_docker_adapter),
    settings: Settings = Depends(get_settings),
) -> InstanceService:
    return InstanceService(db=db, docker=docker, settings=settings)


def _require_keycloak(service: InstanceService, instance_id: str):
    instance = service.get_instance(instance_id)
    if instance is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Instance not found")
    if instance.service_type not in {"keycloak-mgmt", "keycloak-apps"}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Not a Keycloak instance",
        )
    return instance


@router.get("/overview", response_model=KeycloakOverview)
def get_overview(
    instance_id: str,
    service: InstanceService = Depends(get_instance_service),
) -> KeycloakOverview:
    instance = _require_keycloak(service, instance_id)
    attachments = service.list_attachments(instance.id)
    ips = [item.ip_address for item in attachments if item.ip_address]
    payload = overview_payload(
        instance_id=instance.id,
        service_type=instance.service_type,
        configuration=instance.configuration or {},
        attachment_ips=ips,
    )
    return KeycloakOverview.model_validate(payload)


@router.post("/wire-platform-oidc", response_model=KeycloakWireOidcResponse)
def post_wire_platform_oidc(
    instance_id: str,
    payload: KeycloakWireOidcRequest,
    db: Session = Depends(get_db),
    actor: User = Depends(require_roles("admin")),
    service: InstanceService = Depends(get_instance_service),
) -> KeycloakWireOidcResponse:
    instance = _require_keycloak(service, instance_id)
    if instance.service_type != "keycloak-mgmt":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Platform OIDC wiring is only available for keycloak-mgmt",
        )
    attachments = service.list_attachments(instance.id)
    try:
        result = wire_platform_oidc(
            db,
            instance,
            attachments,
            source_name=payload.source_name,
            upn_suffix=payload.upn_suffix,
        )
    except KeycloakWireError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    AuditService(db).record(
        event_type="keycloak.wire_platform_oidc",
        resource_type="instance",
        resource_id=instance.id,
        actor=actor.username,
        payload=result,
        result="ok",
        commit=True,
    )
    return KeycloakWireOidcResponse.model_validate(result)


@router.post("/wire-app-idp", response_model=KeycloakWireAppIdpResponse)
def post_wire_app_idp(
    instance_id: str,
    payload: KeycloakWireAppIdpRequest,
    db: Session = Depends(get_db),
    actor: User = Depends(require_roles("admin")),
    service: InstanceService = Depends(get_instance_service),
) -> KeycloakWireAppIdpResponse:
    instance = _require_keycloak(service, instance_id)
    if instance.service_type != "keycloak-apps":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="App IdP wiring is only available for keycloak-apps",
        )
    attachments = service.list_attachments(instance.id)
    try:
        result = wire_app_idp(
            db,
            instance,
            attachments,
            idp_name=payload.idp_name,
            customer_id=payload.customer_id,
            application_id=payload.application_id,
        )
    except KeycloakWireError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    AuditService(db).record(
        event_type="keycloak.wire_app_idp",
        resource_type="instance",
        resource_id=instance.id,
        actor=actor.username,
        payload=result,
        result="ok",
        commit=True,
    )
    return KeycloakWireAppIdpResponse.model_validate(result)
