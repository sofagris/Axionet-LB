"""Mutation RBAC: viewer read-only, operator dataplane, admin identity/destructive."""

from __future__ import annotations

from fastapi import HTTPException, Request, status

from app.core.roles import ROLE_RANK, effective_role, normalize_role
from app.core.security import is_public_path
from app.models.user import User

SAFE_METHODS = frozenset({"GET", "HEAD", "OPTIONS"})

# Any authenticated role may call these mutating paths.
AUTHENTICATED_MUTATION_SUFFIXES = (
    "/auth/logout",
)

# Minimum role admin (identity + destructive system).
ADMIN_MUTATION_PREFIXES = (
    "/api/v1/users",
    "/api/v1/groups",
    "/api/v1/auth-sources",
    "/api/v1/app-idp-bindings",
    "/api/v1/sites",
    "/api/v1/load-balancers",
)

ADMIN_MUTATION_SUFFIXES = (
    "/system/orphans/prune",
    "/promote-management",
)


def _normalized_path(path: str) -> str:
    return path.rstrip("/") or "/"


def _path_under_prefix(path: str, prefix: str) -> bool:
    normalized = _normalized_path(path)
    pref = _normalized_path(prefix)
    return normalized == pref or normalized.startswith(f"{pref}/")


def _path_endswith_suffix(path: str, suffix: str) -> bool:
    return _normalized_path(path).endswith(_normalized_path(suffix))


def required_mutation_role(method: str, path: str) -> str | None:
    """Return minimum platform role for a mutating request, or None if unrestricted.

    None means: safe HTTP method, public path, or any authenticated user (e.g. logout).
    Callers must still ensure authentication where required.
    """
    if method.upper() in SAFE_METHODS:
        return None
    if is_public_path(path):
        return None
    if any(_path_endswith_suffix(path, suffix) for suffix in AUTHENTICATED_MUTATION_SUFFIXES):
        return None
    if any(_path_under_prefix(path, prefix) for prefix in ADMIN_MUTATION_PREFIXES):
        return "admin"
    if any(_path_endswith_suffix(path, suffix) for suffix in ADMIN_MUTATION_SUFFIXES):
        return "admin"
    return "operator"


def role_satisfies(user_role: str, minimum: str) -> bool:
    return ROLE_RANK[normalize_role(user_role)] >= ROLE_RANK[normalize_role(minimum)]


def enforce_mutation_rbac(request: Request) -> None:
    """Router dependency: block mutating requests below the required effective role.

    Skips when ``request.state.user`` is missing (auth bypass in tests, or public path).
    """
    minimum = required_mutation_role(request.method, request.url.path)
    if minimum is None:
        return
    user = getattr(request.state, "user", None)
    if user is None:
        # Auth dependency was overridden / not applied — leave to other guards.
        return
    if not isinstance(user, User):
        return
    if not role_satisfies(effective_role(user), minimum):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient role",
        )
