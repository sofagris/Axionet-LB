from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.db.session import get_db
from app.schemas.revisions import RevisionRead, RevisionSummary
from app.services.docker.client import DockerClientAdapter, create_docker_adapter
from app.services.instances.service import InstanceService
from app.services.revisions.service import RevisionService

router = APIRouter(prefix="/instances/{instance_id}/revisions", tags=["revisions"])


def get_docker_adapter(settings: Settings = Depends(get_settings)) -> DockerClientAdapter:
    return create_docker_adapter(settings)


def get_instance_service(
    db: Session = Depends(get_db),
    docker: DockerClientAdapter = Depends(get_docker_adapter),
    settings: Settings = Depends(get_settings),
) -> InstanceService:
    return InstanceService(db=db, docker=docker, settings=settings)


def get_revision_service(db: Session = Depends(get_db)) -> RevisionService:
    return RevisionService(db=db)


def _require_instance(service: InstanceService, instance_id: str):
    instance = service.get_instance(instance_id)
    if instance is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Instance not found")
    return instance


@router.get("", response_model=list[RevisionSummary])
def list_revisions(
    instance_id: str,
    service: InstanceService = Depends(get_instance_service),
    revisions: RevisionService = Depends(get_revision_service),
) -> list[RevisionSummary]:
    _require_instance(service, instance_id)
    return [RevisionSummary.model_validate(item) for item in revisions.list_revisions(instance_id)]


@router.get("/{revision_id}", response_model=RevisionRead)
def get_revision(
    instance_id: str,
    revision_id: str,
    service: InstanceService = Depends(get_instance_service),
    revisions: RevisionService = Depends(get_revision_service),
) -> RevisionRead:
    _require_instance(service, instance_id)
    revision = revisions.get_revision(instance_id, revision_id)
    if revision is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Revision not found")
    data = RevisionRead.model_validate(revision)
    return data.model_copy(update={"diff_from_previous": revisions.diff_from_previous(revision)})


@router.post("/{revision_id}/restore", response_model=RevisionRead)
def restore_revision(
    instance_id: str,
    revision_id: str,
    service: InstanceService = Depends(get_instance_service),
    revisions: RevisionService = Depends(get_revision_service),
) -> RevisionRead:
    instance = _require_instance(service, instance_id)
    revision = revisions.get_revision(instance_id, revision_id)
    if revision is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Revision not found")
    try:
        _, created = service.restore_revision(instance, revision)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc

    data = RevisionRead.model_validate(created)
    return data.model_copy(update={"diff_from_previous": revisions.diff_from_previous(created)})
