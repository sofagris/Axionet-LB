from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.core.roles import normalize_role
from app.core.security import require_roles
from app.db.session import get_db
from app.models.user import User
from app.schemas.identity import GroupCreate, GroupMembersUpdate, GroupRead, GroupUpdate
from app.services.audit.service import AuditService
from app.services.identity.service import IdentityError, IdentityService

router = APIRouter(
    prefix="/groups",
    tags=["groups"],
    dependencies=[Depends(require_roles("admin"))],
)


def get_identity_service(
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> IdentityService:
    return IdentityService(db=db, settings=settings)


def _to_read(service: IdentityService, group) -> GroupRead:
    return GroupRead(
        id=group.id,
        name=group.name,
        description=group.description,
        role=normalize_role(group.role),  # type: ignore[arg-type]
        member_count=service.group_member_count(group.id),
        created_at=group.created_at,
        updated_at=group.updated_at,
    )


@router.get("", response_model=list[GroupRead])
def list_groups(service: IdentityService = Depends(get_identity_service)) -> list[GroupRead]:
    return [_to_read(service, group) for group in service.list_groups()]


@router.post("", response_model=GroupRead, status_code=status.HTTP_201_CREATED)
def create_group(
    payload: GroupCreate,
    db: Session = Depends(get_db),
    actor: User = Depends(require_roles("admin")),
    service: IdentityService = Depends(get_identity_service),
) -> GroupRead:
    try:
        group = service.create_group(payload)
    except IdentityError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    AuditService(db).record(
        event_type="groups.create",
        resource_type="group",
        resource_id=group.id,
        actor=actor.username,
        payload={"name": group.name, "role": group.role},
        result="ok",
        commit=True,
    )
    return _to_read(service, group)


@router.get("/{group_id}", response_model=GroupRead)
def get_group(
    group_id: str,
    service: IdentityService = Depends(get_identity_service),
) -> GroupRead:
    group = service.get_group(group_id)
    if group is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Group not found")
    return _to_read(service, group)


@router.patch("/{group_id}", response_model=GroupRead)
def update_group(
    group_id: str,
    payload: GroupUpdate,
    db: Session = Depends(get_db),
    actor: User = Depends(require_roles("admin")),
    service: IdentityService = Depends(get_identity_service),
) -> GroupRead:
    group = service.get_group(group_id)
    if group is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Group not found")
    try:
        updated = service.update_group(group, payload)
    except IdentityError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    AuditService(db).record(
        event_type="groups.update",
        resource_type="group",
        resource_id=updated.id,
        actor=actor.username,
        payload=payload.model_dump(exclude_unset=True),
        result="ok",
        commit=True,
    )
    return _to_read(service, updated)


@router.delete("/{group_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_group(
    group_id: str,
    db: Session = Depends(get_db),
    actor: User = Depends(require_roles("admin")),
    service: IdentityService = Depends(get_identity_service),
) -> Response:
    group = service.get_group(group_id)
    if group is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Group not found")
    service.delete_group(group)
    AuditService(db).record(
        event_type="groups.delete",
        resource_type="group",
        resource_id=group_id,
        actor=actor.username,
        payload={},
        result="ok",
        commit=True,
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.put("/{group_id}/members", response_model=GroupRead)
def set_group_members(
    group_id: str,
    payload: GroupMembersUpdate,
    db: Session = Depends(get_db),
    actor: User = Depends(require_roles("admin")),
    service: IdentityService = Depends(get_identity_service),
) -> GroupRead:
    group = service.get_group(group_id)
    if group is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Group not found")
    try:
        updated = service.set_group_members(group, payload.user_ids)
    except IdentityError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    AuditService(db).record(
        event_type="groups.set_members",
        resource_type="group",
        resource_id=updated.id,
        actor=actor.username,
        payload={"user_ids": payload.user_ids},
        result="ok",
        commit=True,
    )
    return _to_read(service, updated)


@router.get("/{group_id}/members", response_model=list[str])
def list_group_members(
    group_id: str,
    service: IdentityService = Depends(get_identity_service),
) -> list[str]:
    group = service.get_group(group_id)
    if group is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Group not found")
    return service.group_member_ids(group_id)
