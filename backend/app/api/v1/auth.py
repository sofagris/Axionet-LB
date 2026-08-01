from __future__ import annotations

from urllib.parse import urlencode

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.core.security import authenticate_user, create_access_token, get_current_user
from app.db.session import get_db
from app.models.auth_source import LOCAL_UPN_SUFFIX
from app.models.user import User
from app.schemas.auth import LoginRequest, TokenResponse, UserRead
from app.schemas.auth_sources import LoginOptionsResponse, LoginOptionsSuffix
from app.services.audit.service import AuditService
from app.services.auth_sources.oidc import (
    OidcError,
    complete_oidc_callback,
    resolve_login_route,
    start_oidc_authorize_url,
)
from app.services.auth_sources.service import AuthSourceService
from app.services.identity.service import to_user_read

router = APIRouter(prefix="/auth", tags=["auth"])


def _request_base(request: Request) -> str:
    # Prefer proxy headers when present
    proto = request.headers.get("x-forwarded-proto", request.url.scheme)
    host = request.headers.get("x-forwarded-host", request.headers.get("host", request.url.netloc))
    return f"{proto}://{host}"


@router.get("/login-options", response_model=LoginOptionsResponse)
def login_options(db: Session = Depends(get_db)) -> LoginOptionsResponse:
    AuthSourceService(db).ensure_local_source()
    suffixes: list[LoginOptionsSuffix] = []
    for row in AuthSourceService(db).list_suffixes():
        source = row.auth_source
        if source is None or not source.enabled:
            continue
        suffixes.append(
            LoginOptionsSuffix(
                suffix=row.suffix,
                auth_source_id=source.id,
                auth_source_name=source.name,
                kind=source.kind,  # type: ignore[arg-type]
                sso=source.kind == "oidc",
            )
        )
    return LoginOptionsResponse(local_suffix=LOCAL_UPN_SUFFIX, suffixes=suffixes)


@router.post("/login", response_model=TokenResponse)
def login(
    payload: LoginRequest,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> TokenResponse:
    parsed, source, route = resolve_login_route(db, payload.username)
    if route == "oidc":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Use SSO for this UPN suffix",
        )
    if route == "unknown":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"No auth source mapped for suffix @{parsed.suffix}",
        )

    user = authenticate_user(db, payload.username, payload.password)
    if user is None:
        AuditService(db).record(
            event_type="auth.login",
            resource_type="user",
            resource_id=payload.username,
            actor=payload.username,
            payload={"username": payload.username, "route": "local"},
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
        payload={"username": user.username, "route": "local", "source": source.name if source else "local"},
        result="ok",
        commit=True,
    )
    return TokenResponse(
        access_token=token,
        user=UserRead.model_validate(to_user_read(user)),
    )


@router.get("/oidc/start")
def oidc_start(
    upn: str,
    request: Request,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> RedirectResponse:
    try:
        url = start_oidc_authorize_url(
            db=db,
            settings=settings,
            upn=upn,
            request_base=_request_base(request),
        )
    except OidcError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return RedirectResponse(url=url, status_code=status.HTTP_302_FOUND)


@router.get("/oidc/callback")
def oidc_callback(
    request: Request,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
) -> RedirectResponse:
    gui = settings.gui_public_url.rstrip("/")
    if error:
        qs = urlencode({"oidc_error": error})
        return RedirectResponse(url=f"{gui}/login?{qs}", status_code=status.HTTP_302_FOUND)
    if not code or not state:
        qs = urlencode({"oidc_error": "missing_code_or_state"})
        return RedirectResponse(url=f"{gui}/login?{qs}", status_code=status.HTTP_302_FOUND)
    try:
        token, user = complete_oidc_callback(db=db, settings=settings, code=code, state=state)
    except OidcError as exc:
        qs = urlencode({"oidc_error": str(exc)})
        return RedirectResponse(url=f"{gui}/login?{qs}", status_code=status.HTTP_302_FOUND)

    AuditService(db).record(
        event_type="auth.login",
        resource_type="user",
        resource_id=user.id,
        actor=user.username,
        payload={"username": user.username, "route": "oidc"},
        result="ok",
        commit=True,
    )
    qs = urlencode({"oidc_token": token})
    return RedirectResponse(url=f"{gui}/login?{qs}", status_code=status.HTTP_302_FOUND)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Response:
    AuditService(db).record(
        event_type="auth.logout",
        resource_type="user",
        resource_id=user.id,
        actor=user.username,
        payload={"username": user.username},
        result="ok",
        commit=True,
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/me", response_model=UserRead)
def me(user: User = Depends(get_current_user)) -> UserRead:
    return UserRead.model_validate(to_user_read(user))
