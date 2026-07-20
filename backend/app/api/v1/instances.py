from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.db.session import get_db
from app.schemas.instances import (
    InstanceCreate,
    InstanceLogs,
    InstanceRead,
    InstanceStatus,
    InstanceUpdate,
    InstanceValidateResult,
    NetworkAttachmentRead,
)
from app.services.docker.client import DockerClientAdapter, create_docker_adapter
from app.services.instances.service import InstanceService

router = APIRouter(prefix="/instances", tags=["instances"])


def get_docker_adapter(settings: Settings = Depends(get_settings)) -> DockerClientAdapter:
    return create_docker_adapter(settings)


def get_instance_service(
    db: Session = Depends(get_db),
    docker: DockerClientAdapter = Depends(get_docker_adapter),
    settings: Settings = Depends(get_settings),
) -> InstanceService:
    return InstanceService(db=db, docker=docker, settings=settings)


def _to_read(service: InstanceService, instance) -> InstanceRead:
    attachments = service.list_attachments(instance.id)
    data = InstanceRead.model_validate(instance)
    return data.model_copy(
        update={
            "networks": [NetworkAttachmentRead.model_validate(item) for item in attachments],
        }
    )


@router.get("", response_model=list[InstanceRead])
def list_instances(service: InstanceService = Depends(get_instance_service)) -> list[InstanceRead]:
    return [_to_read(service, item) for item in service.list_instances()]


@router.post("", response_model=InstanceRead, status_code=status.HTTP_201_CREATED)
def create_instance(
    payload: InstanceCreate,
    service: InstanceService = Depends(get_instance_service),
) -> InstanceRead:
    try:
        instance = service.create_instance(payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc
    return _to_read(service, instance)


@router.get("/{instance_id}", response_model=InstanceRead)
def get_instance(
    instance_id: str,
    service: InstanceService = Depends(get_instance_service),
) -> InstanceRead:
    instance = service.get_instance(instance_id)
    if instance is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Instance not found")
    return _to_read(service, instance)


@router.patch("/{instance_id}", response_model=InstanceRead)
def update_instance(
    instance_id: str,
    payload: InstanceUpdate,
    service: InstanceService = Depends(get_instance_service),
) -> InstanceRead:
    instance = service.get_instance(instance_id)
    if instance is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Instance not found")
    try:
        updated = service.update_instance(instance, payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return _to_read(service, updated)


@router.delete("/{instance_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_instance(
    instance_id: str,
    service: InstanceService = Depends(get_instance_service),
) -> None:
    instance = service.get_instance(instance_id)
    if instance is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Instance not found")
    try:
        service.delete_instance(instance)
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc


@router.post("/{instance_id}/start", response_model=InstanceRead)
def start_instance(
    instance_id: str,
    service: InstanceService = Depends(get_instance_service),
) -> InstanceRead:
    return _action(service, instance_id, service.start_instance)


@router.post("/{instance_id}/stop", response_model=InstanceRead)
def stop_instance(
    instance_id: str,
    service: InstanceService = Depends(get_instance_service),
) -> InstanceRead:
    return _action(service, instance_id, service.stop_instance)


@router.post("/{instance_id}/restart", response_model=InstanceRead)
def restart_instance(
    instance_id: str,
    service: InstanceService = Depends(get_instance_service),
) -> InstanceRead:
    return _action(service, instance_id, service.restart_instance)


@router.post("/{instance_id}/reload", response_model=InstanceRead)
def reload_instance(
    instance_id: str,
    service: InstanceService = Depends(get_instance_service),
) -> InstanceRead:
    return _action(service, instance_id, service.reload_instance)


@router.post("/{instance_id}/reconcile", response_model=InstanceRead)
def reconcile_instance(
    instance_id: str,
    service: InstanceService = Depends(get_instance_service),
) -> InstanceRead:
    return _action(service, instance_id, service.reconcile)


@router.post("/{instance_id}/validate", response_model=InstanceValidateResult)
def validate_instance(
    instance_id: str,
    service: InstanceService = Depends(get_instance_service),
) -> InstanceValidateResult:
    instance = service.get_instance(instance_id)
    if instance is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Instance not found")
    ok, output, rendered = service.validate_instance(instance)
    return InstanceValidateResult(ok=ok, output=output, rendered_preview=rendered)


@router.get("/{instance_id}/status", response_model=InstanceStatus)
def instance_status(
    instance_id: str,
    service: InstanceService = Depends(get_instance_service),
) -> InstanceStatus:
    instance = service.get_instance(instance_id)
    if instance is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Instance not found")
    return InstanceStatus(
        id=instance.id,
        desired_state=instance.desired_state,
        actual_state=instance.actual_state,
        health_status=instance.health_status,
        container_id=instance.container_id,
        container_status=service.get_container_status(instance),
        last_error=instance.last_error,
    )


@router.get("/{instance_id}/logs", response_model=InstanceLogs)
def instance_logs(
    instance_id: str,
    tail: int = Query(default=200, ge=1, le=5000),
    service: InstanceService = Depends(get_instance_service),
) -> InstanceLogs:
    instance = service.get_instance(instance_id)
    if instance is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Instance not found")
    try:
        logs = service.get_logs(instance, tail=tail)
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc
    return InstanceLogs(id=instance.id, logs=logs)


def _action(service: InstanceService, instance_id: str, fn) -> InstanceRead:
    instance = service.get_instance(instance_id)
    if instance is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Instance not found")
    try:
        updated = fn(instance)
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc
    return _to_read(service, updated)
