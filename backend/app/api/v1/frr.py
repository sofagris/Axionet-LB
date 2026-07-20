from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.db.session import get_db
from app.plugins.frr.runtime import FrrRuntimeClient
from app.plugins.frr.schemas import FrrConfig
from app.plugins.registry import get_plugin
from app.schemas.frr import FrrBgpStatus, FrrConfigPreview, FrrConfigUpdate
from app.services.docker.client import DockerClientAdapter, create_docker_adapter
from app.services.instances.service import InstanceService

router = APIRouter(prefix="/instances/{instance_id}/frr", tags=["frr"])


def get_docker_adapter(settings: Settings = Depends(get_settings)) -> DockerClientAdapter:
    return create_docker_adapter(settings)


def get_instance_service(
    db: Session = Depends(get_db),
    docker: DockerClientAdapter = Depends(get_docker_adapter),
    settings: Settings = Depends(get_settings),
) -> InstanceService:
    return InstanceService(db=db, docker=docker, settings=settings)


def _require_instance(service: InstanceService, instance_id: str):
    instance = service.get_instance(instance_id)
    if instance is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Instance not found")
    if instance.service_type != "frr":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Not an FRR instance")
    return instance


@router.get("/config", response_model=FrrConfigPreview)
def get_config_preview(
    instance_id: str,
    service: InstanceService = Depends(get_instance_service),
) -> FrrConfigPreview:
    instance = _require_instance(service, instance_id)
    plugin = get_plugin("frr")
    return FrrConfigPreview(
        configuration=instance.configuration,
        rendered=plugin.render(instance.configuration),
    )


@router.put("/config", response_model=FrrConfigPreview)
def update_config(
    instance_id: str,
    payload: FrrConfigUpdate,
    service: InstanceService = Depends(get_instance_service),
) -> FrrConfigPreview:
    instance = _require_instance(service, instance_id)
    current = FrrConfig.from_dict(instance.configuration)
    data = current.model_dump()
    updates = payload.model_dump(exclude_unset=True)
    data.update(updates)
    try:
        updated = service.apply_configuration(instance, data)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc
    plugin = get_plugin("frr")
    return FrrConfigPreview(
        configuration=updated.configuration,
        rendered=plugin.render(updated.configuration),
    )


@router.get("/bgp", response_model=FrrBgpStatus)
def get_bgp_status(
    instance_id: str,
    service: InstanceService = Depends(get_instance_service),
    docker: DockerClientAdapter = Depends(get_docker_adapter),
) -> FrrBgpStatus:
    instance = _require_instance(service, instance_id)
    if not instance.container_id:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Instance has no container")
    runtime = FrrRuntimeClient(docker)
    try:
        summary = runtime.bgp_summary(instance.container_id)
        neighbors = runtime.bgp_neighbors(instance.container_id)
    except Exception as exc:  # noqa: BLE001 — surface docker/runtime errors to client
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc
    return FrrBgpStatus(summary=summary, neighbors=neighbors)
