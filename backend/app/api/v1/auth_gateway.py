from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.db.session import get_db
from app.plugins.auth_gateway.overview import overview_payload
from app.schemas.auth_gateway import AuthGatewayOverview
from app.services.docker.client import DockerClientAdapter, create_docker_adapter
from app.services.instances.service import InstanceService

router = APIRouter(prefix="/instances/{instance_id}/auth-gateway", tags=["auth-gateway"])


def get_docker_adapter(settings: Settings = Depends(get_settings)) -> DockerClientAdapter:
    return create_docker_adapter(settings)


def get_instance_service(
    db: Session = Depends(get_db),
    docker: DockerClientAdapter = Depends(get_docker_adapter),
    settings: Settings = Depends(get_settings),
) -> InstanceService:
    return InstanceService(db=db, docker=docker, settings=settings)


@router.get("/overview", response_model=AuthGatewayOverview)
def get_overview(
    instance_id: str,
    service: InstanceService = Depends(get_instance_service),
) -> AuthGatewayOverview:
    instance = service.get_instance(instance_id)
    if instance is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Instance not found")
    if instance.service_type != "auth-gateway":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Not an auth-gateway instance",
        )
    attachments = service.list_attachments(instance.id)
    ips = [item.ip_address for item in attachments if item.ip_address]
    payload = overview_payload(
        instance_id=instance.id,
        configuration=instance.configuration or {},
        attachment_ips=ips,
    )
    return AuthGatewayOverview.model_validate(payload)
