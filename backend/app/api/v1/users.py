from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.core.security import require_roles
from app.db.session import get_db
from app.models.user import User
from app.schemas.identity import UserCreate, UserRead, UserUpdate
from app.services.audit.service import AuditService
from app.services.identity.service import IdentityError, IdentityService, to_user_read

router = APIRouter(
    prefix="/users",
    tags=["users"],
    dependencies=[Depends(require_roles("admin"))],
)


def get_identity_service(
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> IdentityService:
    return IdentityService(db=db, settings=settings)


@router.get("", response_model=list[UserRead])
def list_users(service: IdentityService = Depends(get_identity_service)) -> list[UserRead]:
    return [UserRead.model_validate(to_user_read(user)) for user in service.list_users()]


@router.post("", response_model=UserRead, status_code=status.HTTP_201_CREATED)
def create_user(
    payload: UserCreate,
    db: Session = Depends(get_db),
    actor: User = Depends(require_roles("admin")),
    service: IdentityService = Depends(get_identity_service),
) -> UserRead:
    try:
        user = service.create_user(payload)
    except IdentityError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    AuditService(db).record(
        event_type="users.create",
        resource_type="user",
        resource_id=user.id,
        actor=actor.username,
        payload={"username": user.username, "role": user.role},
        result="ok",
        commit=True,
    )
    return UserRead.model_validate(to_user_read(user))


@router.get("/{user_id}", response_model=UserRead)
def get_user(
    user_id: str,
    service: IdentityService = Depends(get_identity_service),
) -> UserRead:
    user = service.get_user(user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return UserRead.model_validate(to_user_read(user))


@router.patch("/{user_id}", response_model=UserRead)
def update_user(
    user_id: str,
    payload: UserUpdate,
    db: Session = Depends(get_db),
    actor: User = Depends(require_roles("admin")),
    service: IdentityService = Depends(get_identity_service),
) -> UserRead:
    user = service.get_user(user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    try:
        updated = service.update_user(user, payload)
    except IdentityError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    AuditService(db).record(
        event_type="users.update",
        resource_type="user",
        resource_id=updated.id,
        actor=actor.username,
        payload=payload.model_dump(exclude_unset=True, exclude={"password"}),
        result="ok",
        commit=True,
    )
    return UserRead.model_validate(to_user_read(updated))


@router.post("/{user_id}/deactivate", response_model=UserRead)
def deactivate_user(
    user_id: str,
    db: Session = Depends(get_db),
    actor: User = Depends(require_roles("admin")),
    service: IdentityService = Depends(get_identity_service),
) -> UserRead:
    user = service.get_user(user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    try:
        updated = service.deactivate_user(user)
    except IdentityError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    AuditService(db).record(
        event_type="users.deactivate",
        resource_type="user",
        resource_id=updated.id,
        actor=actor.username,
        payload={"username": updated.username},
        result="ok",
        commit=True,
    )
    return UserRead.model_validate(to_user_read(updated))
