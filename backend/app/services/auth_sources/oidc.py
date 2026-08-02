from __future__ import annotations

import secrets
from datetime import UTC, datetime, timedelta
from typing import Any
from urllib.parse import urlencode

import httpx
import jwt
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.config import Settings
from app.core.security import create_access_token
from app.core.upn import ParsedUpn, local_lookup_username, parse_upn
from app.models.auth_source import AuthSource
from app.models.group import Group, UserGroup
from app.models.user import User
from app.services.auth_sources.service import AuthSourceError, AuthSourceService


class OidcError(AuthSourceError):
    """OIDC flow failures."""


def _discover(issuer_url: str) -> dict[str, Any]:
    base = issuer_url.rstrip("/")
    url = f"{base}/.well-known/openid-configuration"
    with httpx.Client(timeout=15.0) as client:
        response = client.get(url)
        response.raise_for_status()
        return response.json()


def build_redirect_uri(settings: Settings, request_base: str) -> str:
    if settings.auth_public_base_url.strip():
        base = settings.auth_public_base_url.rstrip("/")
    else:
        base = request_base.rstrip("/")
    return f"{base}{settings.api_prefix}/auth/oidc/callback"


def create_oidc_state(
    *,
    settings: Settings,
    source_id: str,
    upn: str,
    redirect_uri: str,
) -> str:
    now = datetime.now(UTC)
    payload = {
        "typ": "oidc_state",
        "sid": source_id,
        "upn": upn,
        "ru": redirect_uri,
        "nonce": secrets.token_urlsafe(16),
        "iat": now,
        "exp": now + timedelta(minutes=10),
    }
    return jwt.encode(payload, settings.auth_secret_key, algorithm="HS256")


def decode_oidc_state(state: str, settings: Settings) -> dict[str, Any]:
    try:
        payload = jwt.decode(state, settings.auth_secret_key, algorithms=["HS256"])
    except jwt.PyJWTError as exc:
        raise OidcError("Invalid or expired OIDC state") from exc
    if payload.get("typ") != "oidc_state":
        raise OidcError("Invalid OIDC state type")
    return payload


def start_oidc_authorize_url(
    *,
    db: Session,
    settings: Settings,
    upn: str,
    request_base: str,
) -> str:
    parsed = parse_upn(upn)
    if parsed.is_local_route:
        raise OidcError("Use local password login for @internal or bare usernames")
    if not parsed.suffix or not parsed.local_part:
        raise OidcError("A full UPN is required for SSO")

    service = AuthSourceService(db)
    mapping = service.get_suffix_by_value(parsed.suffix)
    if mapping is None or mapping.auth_source is None:
        raise OidcError(f"No auth source mapped for suffix @{parsed.suffix}")
    source = mapping.auth_source
    if not source.enabled:
        raise OidcError("Auth source is disabled")
    if source.kind != "oidc":
        raise OidcError("Mapped auth source is not OIDC")
    if not source.issuer_url or not source.client_id:
        raise OidcError("OIDC source is incomplete")

    try:
        discovery = _discover(source.issuer_url)
    except Exception as exc:
        raise OidcError(f"OIDC discovery failed: {exc}") from exc
    authorize_endpoint = discovery.get("authorization_endpoint")
    if not authorize_endpoint:
        raise OidcError("OIDC discovery missing authorization_endpoint")

    redirect_uri = build_redirect_uri(settings, request_base)
    state = create_oidc_state(
        settings=settings,
        source_id=source.id,
        upn=parsed.raw,
        redirect_uri=redirect_uri,
    )
    params = {
        "response_type": "code",
        "client_id": source.client_id,
        "redirect_uri": redirect_uri,
        "scope": source.scopes or "openid profile email",
        "state": state,
        "login_hint": parsed.raw,
    }
    return f"{authorize_endpoint}?{urlencode(params)}"


def _exchange_code(
    *,
    source: AuthSource,
    discovery: dict[str, Any],
    code: str,
    redirect_uri: str,
) -> dict[str, Any]:
    token_endpoint = discovery.get("token_endpoint")
    if not token_endpoint:
        raise OidcError("OIDC discovery missing token_endpoint")
    data = {
        "grant_type": "authorization_code",
        "code": code,
        "redirect_uri": redirect_uri,
        "client_id": source.client_id or "",
    }
    if source.client_secret:
        data["client_secret"] = source.client_secret
    with httpx.Client(timeout=20.0) as client:
        response = client.post(token_endpoint, data=data)
        if response.status_code >= 400:
            raise OidcError(f"Token exchange failed: {response.text[:200]}")
        return response.json()


def _claims_from_id_token(id_token: str) -> dict[str, Any]:
    # Signature validation against JWKS is recommended for production; phase 2 trusts
    # the token endpoint response and decodes claims without verify for lab simplicity.
    return jwt.decode(id_token, options={"verify_signature": False})


def upsert_oidc_user(
    db: Session,
    *,
    source: AuthSource,
    claims: dict[str, Any],
    upn_hint: str | None,
) -> User:
    sub = claims.get("sub")
    if not isinstance(sub, str) or not sub:
        raise OidcError("OIDC token missing sub")

    username_claim = source.claim_username or "preferred_username"
    groups_claim = source.claim_groups or "groups"

    username = claims.get(username_claim) or claims.get("email") or upn_hint or sub
    if not isinstance(username, str) or not username.strip():
        username = sub
    username = username.strip()[:64]

    email = claims.get("email") if isinstance(claims.get("email"), str) else None
    display = claims.get("name") if isinstance(claims.get("name"), str) else None

    user = db.scalars(
        select(User)
        .where(User.auth_source_id == source.id, User.oidc_sub == sub)
        .options(selectinload(User.group_memberships).selectinload(UserGroup.group))
    ).first()

    if user is None:
        # Avoid colliding with local usernames
        existing = db.scalars(select(User).where(User.username == username)).first()
        if existing is not None and (
            existing.auth_source_id != source.id or existing.oidc_sub != sub
        ):
            username = f"{username[:40]}.{sub[:8]}"[:64]
        user = User(
            username=username,
            password_hash=None,
            role="viewer",
            email=email,
            display_name=display,
            auth_source="oidc",
            auth_source_id=source.id,
            oidc_sub=sub,
            is_active=True,
        )
        db.add(user)
        db.flush()
    else:
        if email:
            user.email = email
        if display:
            user.display_name = display
        if not user.is_active:
            raise OidcError("User is inactive")

    raw_groups = claims.get(groups_claim)
    group_names: list[str] = []
    if isinstance(raw_groups, list):
        group_names = [str(g) for g in raw_groups if g]
    elif isinstance(raw_groups, str) and raw_groups:
        group_names = [raw_groups]

    # Sync memberships from IdP group claim (case-insensitive name match → local groups).
    # Empty claim list clears memberships. Effective role = max(user.role, group.roles).
    if groups_claim in claims:
        groups: list[Group] = []
        if group_names:
            wanted = {n.casefold() for n in group_names}
            candidates = list(db.scalars(select(Group)).all())
            groups = [g for g in candidates if g.name.casefold() in wanted]
        existing = list(
            db.scalars(select(UserGroup).where(UserGroup.user_id == user.id)).all()
        )
        for membership in existing:
            db.delete(membership)
        db.flush()
        for group in groups:
            db.add(UserGroup(user_id=user.id, group_id=group.id))

    db.commit()
    loaded = db.scalars(
        select(User)
        .where(User.id == user.id)
        .options(selectinload(User.group_memberships).selectinload(UserGroup.group))
    ).first()
    assert loaded is not None
    return loaded


def complete_oidc_callback(
    *,
    db: Session,
    settings: Settings,
    code: str,
    state: str,
) -> tuple[str, User]:
    state_payload = decode_oidc_state(state, settings)
    source_id = state_payload.get("sid")
    redirect_uri = state_payload.get("ru")
    upn_hint = state_payload.get("upn")
    if not isinstance(source_id, str) or not isinstance(redirect_uri, str):
        raise OidcError("Invalid OIDC state payload")

    source = db.get(AuthSource, source_id)
    if source is None or source.kind != "oidc" or not source.enabled:
        raise OidcError("OIDC source unavailable")
    if not source.issuer_url or not source.client_id:
        raise OidcError("OIDC source incomplete")

    try:
        discovery = _discover(source.issuer_url)
    except Exception as exc:
        raise OidcError(f"OIDC discovery failed: {exc}") from exc

    token_response = _exchange_code(
        source=source,
        discovery=discovery,
        code=code,
        redirect_uri=redirect_uri,
    )
    id_token = token_response.get("id_token")
    if not isinstance(id_token, str):
        raise OidcError("Token response missing id_token")
    claims = _claims_from_id_token(id_token)
    user = upsert_oidc_user(
        db,
        source=source,
        claims=claims,
        upn_hint=upn_hint if isinstance(upn_hint, str) else None,
    )
    access = create_access_token(user_id=user.id, username=user.username, settings=settings)
    return access, user


def resolve_login_route(db: Session, username: str) -> tuple[ParsedUpn, AuthSource | None, str]:
    """Return parsed UPN, mapped source (if any), and route kind: local|oidc|unknown."""
    parsed = parse_upn(username)
    if parsed.is_local_route:
        return parsed, None, "local"
    if not parsed.suffix:
        return parsed, None, "local"
    mapping = AuthSourceService(db).get_suffix_by_value(parsed.suffix)
    if mapping is None or mapping.auth_source is None:
        return parsed, None, "unknown"
    source = mapping.auth_source
    if source.kind == "local":
        return parsed, source, "local"
    if source.kind == "oidc":
        return parsed, source, "oidc"
    return parsed, source, "unknown"


# re-export helpers used by auth routes
__all__ = [
    "OidcError",
    "build_redirect_uri",
    "complete_oidc_callback",
    "local_lookup_username",
    "parse_upn",
    "resolve_login_route",
    "start_oidc_authorize_url",
]
