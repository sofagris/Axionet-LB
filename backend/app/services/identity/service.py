from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.core.config import Settings
from app.core.roles import effective_role, normalize_role, user_group_names
from app.core.security import hash_password
from app.models.group import Group, UserGroup
from app.models.user import User
from app.schemas.identity import GroupCreate, GroupUpdate, UserCreate, UserUpdate


class IdentityError(ValueError):
    """Domain validation error for identity operations."""


class IdentityService:
    def __init__(self, db: Session, settings: Settings) -> None:
        self.db = db
        self.settings = settings

    def _load_user(self, user_id: str) -> User | None:
        return self.db.scalars(
            select(User)
            .where(User.id == user_id)
            .options(selectinload(User.group_memberships).selectinload(UserGroup.group))
        ).first()

    def _load_user_by_username(self, username: str) -> User | None:
        return self.db.scalars(
            select(User)
            .where(User.username == username)
            .options(selectinload(User.group_memberships).selectinload(UserGroup.group))
        ).first()

    def list_users(self) -> list[User]:
        return list(
            self.db.scalars(
                select(User)
                .options(selectinload(User.group_memberships).selectinload(UserGroup.group))
                .order_by(User.username)
            ).all()
        )

    def get_user(self, user_id: str) -> User | None:
        return self._load_user(user_id)

    def create_user(self, payload: UserCreate) -> User:
        username = payload.username.strip()
        if not username:
            raise IdentityError("Username is required")
        if self._load_user_by_username(username) is not None:
            raise IdentityError("Username already exists")
        role = normalize_role(payload.role)
        user = User(
            username=username,
            password_hash=hash_password(payload.password),
            role=role,
            email=(payload.email or None),
            display_name=(payload.display_name or None),
            auth_source="local",
            is_active=payload.is_active,
        )
        self.db.add(user)
        self.db.flush()
        self._set_user_groups(user, payload.group_ids)
        self.db.commit()
        loaded = self._load_user(user.id)
        assert loaded is not None
        return loaded

    def update_user(self, user: User, payload: UserUpdate) -> User:
        bootstrap = self._is_bootstrap_admin(user)

        if payload.role is not None:
            new_role = normalize_role(payload.role)
            if new_role != user.role:
                if self._would_remove_last_local_admin(user, new_role=new_role):
                    raise IdentityError("Cannot remove the last active local admin")
                user.role = new_role

        if payload.email is not None:
            user.email = payload.email or None
        if payload.display_name is not None:
            user.display_name = payload.display_name or None

        if payload.password is not None:
            if user.auth_source != "local":
                raise IdentityError("Password can only be set for local users")
            user.password_hash = hash_password(payload.password)

        if payload.is_active is not None and payload.is_active != user.is_active:
            if not payload.is_active:
                if bootstrap:
                    raise IdentityError("Cannot deactivate the bootstrap admin")
                if self._would_remove_last_local_admin(user, deactivate=True):
                    raise IdentityError("Cannot deactivate the last active local admin")
            user.is_active = payload.is_active

        if payload.group_ids is not None:
            self._set_user_groups(user, payload.group_ids)

        self.db.commit()
        loaded = self._load_user(user.id)
        assert loaded is not None
        return loaded

    def deactivate_user(self, user: User) -> User:
        return self.update_user(user, UserUpdate(is_active=False))

    def list_groups(self) -> list[Group]:
        return list(self.db.scalars(select(Group).order_by(Group.name)).all())

    def get_group(self, group_id: str) -> Group | None:
        return self.db.get(Group, group_id)

    def create_group(self, payload: GroupCreate) -> Group:
        name = payload.name.strip()
        if not name:
            raise IdentityError("Group name is required")
        existing = self.db.scalars(select(Group).where(Group.name == name)).first()
        if existing is not None:
            raise IdentityError("Group name already exists")
        group = Group(
            name=name,
            description=payload.description or "",
            role=normalize_role(payload.role),
        )
        self.db.add(group)
        self.db.commit()
        self.db.refresh(group)
        return group

    def update_group(self, group: Group, payload: GroupUpdate) -> Group:
        if payload.name is not None:
            name = payload.name.strip()
            if not name:
                raise IdentityError("Group name is required")
            clash = self.db.scalars(
                select(Group).where(Group.name == name, Group.id != group.id)
            ).first()
            if clash is not None:
                raise IdentityError("Group name already exists")
            group.name = name
        if payload.description is not None:
            group.description = payload.description
        if payload.role is not None:
            group.role = normalize_role(payload.role)
        self.db.commit()
        self.db.refresh(group)
        return group

    def delete_group(self, group: Group) -> None:
        self.db.delete(group)
        self.db.commit()

    def set_group_members(self, group: Group, user_ids: list[str]) -> Group:
        unique_ids = list(dict.fromkeys(user_ids))
        users = list(self.db.scalars(select(User).where(User.id.in_(unique_ids))).all()) if unique_ids else []
        if len(users) != len(unique_ids):
            raise IdentityError("One or more users not found")

        existing = list(
            self.db.scalars(select(UserGroup).where(UserGroup.group_id == group.id)).all()
        )
        for membership in existing:
            self.db.delete(membership)
        self.db.flush()
        for user in users:
            self.db.add(UserGroup(user_id=user.id, group_id=group.id))
        self.db.commit()
        refreshed = self.get_group(group.id)
        assert refreshed is not None
        return refreshed

    def group_member_count(self, group_id: str) -> int:
        return int(
            self.db.scalar(
                select(func.count()).select_from(UserGroup).where(UserGroup.group_id == group_id)
            )
            or 0
        )

    def group_member_ids(self, group_id: str) -> list[str]:
        return list(
            self.db.scalars(select(UserGroup.user_id).where(UserGroup.group_id == group_id)).all()
        )

    def _set_user_groups(self, user: User, group_ids: list[str]) -> None:
        unique_ids = list(dict.fromkeys(group_ids))
        groups = (
            list(self.db.scalars(select(Group).where(Group.id.in_(unique_ids))).all())
            if unique_ids
            else []
        )
        if len(groups) != len(unique_ids):
            raise IdentityError("One or more groups not found")
        existing = list(
            self.db.scalars(select(UserGroup).where(UserGroup.user_id == user.id)).all()
        )
        for membership in existing:
            self.db.delete(membership)
        self.db.flush()
        for group in groups:
            self.db.add(UserGroup(user_id=user.id, group_id=group.id))

    def _is_bootstrap_admin(self, user: User) -> bool:
        return user.username == self.settings.auth_default_admin_username

    def _is_active_local_admin(self, user: User) -> bool:
        if not user.is_active or user.auth_source != "local":
            return False
        return effective_role(user) == "admin" or normalize_role(user.role) == "admin"

    def _count_active_local_admins(self, *, excluding_user_id: str | None = None) -> int:
        users = self.list_users()
        count = 0
        for user in users:
            if excluding_user_id and user.id == excluding_user_id:
                continue
            if user.is_active and user.auth_source == "local" and normalize_role(user.role) == "admin":
                count += 1
        return count

    def _would_remove_last_local_admin(
        self,
        user: User,
        *,
        new_role: str | None = None,
        deactivate: bool = False,
    ) -> bool:
        if user.auth_source != "local":
            return False
        currently_admin = normalize_role(user.role) == "admin" and user.is_active
        if not currently_admin:
            return False
        demoting = new_role is not None and normalize_role(new_role) != "admin"
        if not demoting and not deactivate:
            return False
        return self._count_active_local_admins(excluding_user_id=user.id) == 0


def to_user_read(user: User) -> dict:
    return {
        "id": user.id,
        "username": user.username,
        "role": normalize_role(user.role),
        "email": user.email,
        "display_name": user.display_name,
        "auth_source": user.auth_source or "local",
        "is_active": user.is_active,
        "groups": user_group_names(user),
        "effective_role": effective_role(user),
        "created_at": user.created_at,
    }
