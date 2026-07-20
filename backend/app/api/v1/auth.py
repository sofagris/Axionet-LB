from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.core.security import authenticate_user, create_access_token, get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.auth import LoginRequest, TokenResponse, UserRead
from app.services.audit.service import AuditService

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
def login(
    payload: LoginRequest,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> TokenResponse:
    user = authenticate_user(db, payload.username, payload.password)
    if user is None:
        AuditService(db).record(
            event_type="auth.login",
            resource_type="user",
            resource_id=payload.username,
            actor=payload.username,
            payload={"username": payload.username},
            result="error",
            commit=True,
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
        )
    token = create_access_token(user_id=user.id, username=user.username, settings=settings)
    AuditService(db).record(
        event_type="auth.login",
        resource_type="user",
        resource_id=user.id,
        actor=user.username,
        payload={"username": user.username},
        result="ok",
        commit=True,
    )
    return TokenResponse(
        access_token=token,
        user=UserRead.model_validate(user, from_attributes=True),
    )


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> None:
    AuditService(db).record(
        event_type="auth.logout",
        resource_type="user",
        resource_id=user.id,
        actor=user.username,
        payload={"username": user.username},
        result="ok",
        commit=True,
    )


@router.get("/me", response_model=UserRead)
def me(user: User = Depends(get_current_user)) -> UserRead:
    return UserRead.model_validate(user, from_attributes=True)
