from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any

import bcrypt
import jwt
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from collections.abc import Callable
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.config import Settings, get_settings
from app.core.roles import effective_role, normalize_role
from app.core.upn import local_lookup_username, parse_upn
from app.db.session import get_db
from app.models.group import UserGroup
from app.models.user import User
from app.services.auth_sources.service import AuthSourceService

bearer_scheme = HTTPBearer(auto_error=False)

PUBLIC_PATH_SUFFIXES = (
    "/system/health",
    "/auth/login",
    "/auth/login-options",
    "/auth/oidc/start",
    "/auth/oidc/callback",
)


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
    except ValueError:
        return False


def create_access_token(*, user_id: str, username: str, settings: Settings) -> str:
    now = datetime.now(UTC)
    payload = {
        "sub": user_id,
        "username": username,
        "iat": now,
        "exp": now + timedelta(hours=settings.auth_token_expire_hours),
    }
    return jwt.encode(payload, settings.auth_secret_key, algorithm="HS256")


def decode_access_token(token: str, settings: Settings) -> dict[str, Any]:
    try:
        return jwt.decode(token, settings.auth_secret_key, algorithms=["HS256"])
    except jwt.PyJWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc


def is_public_path(path: str) -> bool:
    normalized = path.rstrip("/") or "/"
    return any(normalized.endswith(suffix) for suffix in PUBLIC_PATH_SUFFIXES)


def _user_load_options():
    return selectinload(User.group_memberships).selectinload(UserGroup.group)


def get_user_by_username(db: Session, username: str) -> User | None:
    return db.scalars(
        select(User).where(User.username == username).options(_user_load_options())
    ).first()


def get_user_by_id(db: Session, user_id: str) -> User | None:
    return db.scalars(
        select(User).where(User.id == user_id).options(_user_load_options())
    ).first()


def authenticate_user(db: Session, username: str, password: str) -> User | None:
    parsed = parse_upn(username)
    if not parsed.is_local_route:
        return None
    lookup = local_lookup_username(parsed)
    if not lookup:
        return None
    user = get_user_by_username(db, lookup)
    if user is None or not user.is_active:
        return None
    if (user.auth_source or "local") != "local":
        return None
    if not user.password_hash:
        return None
    if not verify_password(password, user.password_hash):
        return None
    return user


def ensure_default_admin(db: Session, settings: Settings) -> User:
    AuthSourceService(db).ensure_local_source()
    existing = get_user_by_username(db, settings.auth_default_admin_username)
    if existing is not None:
        return existing
    user = User(
        username=settings.auth_default_admin_username,
        password_hash=hash_password(settings.auth_default_admin_password),
        role="admin",
        auth_source="local",
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def resolve_user_from_credentials(
    db: Session,
    settings: Settings,
    credentials: HTTPAuthorizationCredentials | None,
) -> User:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    payload = decode_access_token(credentials.credentials, settings)
    user_id = payload.get("sub")
    if not isinstance(user_id, str):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token subject",
            headers={"WWW-Authenticate": "Bearer"},
        )
    user = get_user_by_id(db, user_id)
    if user is None or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User inactive or not found",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


def enforce_auth(
    request: Request,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> User | None:
    if is_public_path(request.url.path):
        return None
    user = resolve_user_from_credentials(db, settings, credentials)
    request.state.user = user
    return user


def get_current_user(request: Request) -> User:
    user = getattr(request.state, "user", None)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


def require_roles(*allowed: str) -> Callable[..., User]:
    """Dependency factory: require the current user's effective role to be one of ``allowed``."""

    allowed_normalized = {normalize_role(role) for role in allowed}

    def _dependency(user: User = Depends(get_current_user)) -> User:
        if effective_role(user) not in allowed_normalized:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient role",
            )
        return user

    return _dependency
