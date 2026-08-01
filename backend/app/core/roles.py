"""Platform role helpers (admin > operator > viewer)."""

from __future__ import annotations

from typing import TYPE_CHECKING

PLATFORM_ROLES = ("admin", "operator", "viewer")
ROLE_RANK = {"viewer": 1, "operator": 2, "admin": 3}

if TYPE_CHECKING:
    from app.models.user import User


def normalize_role(role: str | None) -> str:
    value = (role or "viewer").strip().lower()
    if value not in ROLE_RANK:
        return "viewer"
    return value


def max_role(*roles: str | None) -> str:
    best = "viewer"
    best_rank = ROLE_RANK[best]
    for role in roles:
        normalized = normalize_role(role)
        rank = ROLE_RANK[normalized]
        if rank > best_rank:
            best = normalized
            best_rank = rank
    return best


def effective_role(user: User) -> str:
    roles: list[str | None] = [user.role]
    for membership in getattr(user, "group_memberships", []) or []:
        group = getattr(membership, "group", None)
        if group is not None:
            roles.append(group.role)
    return max_role(*roles)


def user_group_names(user: User) -> list[str]:
    names: list[str] = []
    for membership in getattr(user, "group_memberships", []) or []:
        group = getattr(membership, "group", None)
        if group is not None:
            names.append(group.name)
    return sorted(names)
