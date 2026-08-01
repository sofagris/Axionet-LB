from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

PlatformRole = Literal["admin", "operator", "viewer"]


class GroupRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    description: str
    role: PlatformRole
    member_count: int = 0
    created_at: datetime
    updated_at: datetime


class GroupCreate(BaseModel):
    name: str = Field(min_length=1, max_length=64)
    description: str = Field(default="", max_length=512)
    role: PlatformRole = "viewer"


class GroupUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=64)
    description: str | None = Field(default=None, max_length=512)
    role: PlatformRole | None = None


class GroupMembersUpdate(BaseModel):
    user_ids: list[str] = Field(default_factory=list)


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    username: str
    role: PlatformRole
    email: str | None = None
    display_name: str | None = None
    auth_source: str = "local"
    is_active: bool
    groups: list[str] = Field(default_factory=list)
    effective_role: PlatformRole = "viewer"
    created_at: datetime


class UserCreate(BaseModel):
    username: str = Field(min_length=1, max_length=64)
    password: str = Field(min_length=8, max_length=256)
    role: PlatformRole = "viewer"
    email: str | None = Field(default=None, max_length=255)
    display_name: str | None = Field(default=None, max_length=128)
    group_ids: list[str] = Field(default_factory=list)
    is_active: bool = True


class UserUpdate(BaseModel):
    role: PlatformRole | None = None
    email: str | None = Field(default=None, max_length=255)
    display_name: str | None = Field(default=None, max_length=128)
    password: str | None = Field(default=None, min_length=8, max_length=256)
    is_active: bool | None = None
    group_ids: list[str] | None = None
