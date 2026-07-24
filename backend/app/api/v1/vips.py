from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.db.session import get_db
from app.schemas.vips import VipCreate, VipLinkCreate, VipLinkRead, VipRead, VipUpdate
from app.services.docker.client import DockerClientAdapter, create_docker_adapter
from app.services.instances.service import InstanceService
from app.services.vips.service import VipService, vip_announce_prefix

router = APIRouter(prefix="/vips", tags=["vips"])


def get_docker_adapter(settings: Settings = Depends(get_settings)) -> DockerClientAdapter:
    return create_docker_adapter(settings)


def get_instance_service(
    db: Session = Depends(get_db),
    docker: DockerClientAdapter = Depends(get_docker_adapter),
    settings: Settings = Depends(get_settings),
) -> InstanceService:
    return InstanceService(db=db, docker=docker, settings=settings)


def get_vip_service(
    db: Session = Depends(get_db),
    instances: InstanceService = Depends(get_instance_service),
) -> VipService:
    return VipService(db=db, instances=instances)


def _to_read(vip) -> VipRead:
    links = [VipLinkRead.model_validate(item) for item in (vip.links or [])]
    data = VipRead.model_validate(vip)
    return data.model_copy(
        update={
            "announce_prefix": vip_announce_prefix(vip.address),
            "links": links,
        }
    )


@router.get("", response_model=list[VipRead])
def list_vips(service: VipService = Depends(get_vip_service)) -> list[VipRead]:
    return [_to_read(item) for item in service.list_vips()]


@router.post("", response_model=VipRead, status_code=status.HTTP_201_CREATED)
def create_vip(
    payload: VipCreate,
    service: VipService = Depends(get_vip_service),
) -> VipRead:
    try:
        vip = service.create_vip(payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc
    return _to_read(vip)


@router.get("/{vip_id}", response_model=VipRead)
def get_vip(vip_id: str, service: VipService = Depends(get_vip_service)) -> VipRead:
    vip = service.get_vip(vip_id)
    if vip is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="VIP not found")
    return _to_read(vip)


@router.patch("/{vip_id}", response_model=VipRead)
def update_vip(
    vip_id: str,
    payload: VipUpdate,
    service: VipService = Depends(get_vip_service),
) -> VipRead:
    vip = service.get_vip(vip_id)
    if vip is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="VIP not found")
    try:
        updated = service.update_vip(vip, payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc
    return _to_read(updated)


@router.post("/{vip_id}/links", response_model=VipRead, status_code=status.HTTP_201_CREATED)
def add_vip_link(
    vip_id: str,
    payload: VipLinkCreate,
    service: VipService = Depends(get_vip_service),
) -> VipRead:
    vip = service.get_vip(vip_id)
    if vip is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="VIP not found")
    try:
        updated = service.add_link(vip, payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc
    return _to_read(updated)


@router.delete(
    "/{vip_id}/links/{link_id}",
    response_model=VipRead,
)
def remove_vip_link(
    vip_id: str,
    link_id: str,
    service: VipService = Depends(get_vip_service),
) -> VipRead:
    vip = service.get_vip(vip_id)
    if vip is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="VIP not found")
    try:
        updated = service.remove_link(vip, link_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc
    return _to_read(updated)


@router.post("/{vip_id}/enable", response_model=VipRead)
def enable_vip(vip_id: str, service: VipService = Depends(get_vip_service)) -> VipRead:
    vip = service.get_vip(vip_id)
    if vip is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="VIP not found")
    try:
        updated = service.update_vip(vip, VipUpdate(enabled=True, advertise=True))
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc
    return _to_read(updated)


@router.post("/{vip_id}/disable", response_model=VipRead)
def disable_vip(vip_id: str, service: VipService = Depends(get_vip_service)) -> VipRead:
    vip = service.get_vip(vip_id)
    if vip is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="VIP not found")
    try:
        updated = service.update_vip(vip, VipUpdate(enabled=False))
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc
    return _to_read(updated)


@router.delete("/{vip_id}", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
def delete_vip(vip_id: str, service: VipService = Depends(get_vip_service)) -> Response:
    vip = service.get_vip(vip_id)
    if vip is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="VIP not found")
    try:
        service.delete_vip(vip)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc
    return Response(status_code=status.HTTP_204_NO_CONTENT)
