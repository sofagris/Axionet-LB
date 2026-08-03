from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

PlacementKind = Literal["site", "shared"]
PlacementIcon = Literal["site", "shared", "building"]


class SiteCreate(BaseModel):
    name: str = Field(min_length=1, max_length=128)
    description: str | None = Field(default=None, max_length=2000)


class SiteUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=128)
    description: str | None = Field(default=None, max_length=2000)


class SiteRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    description: str | None
    created_at: datetime
    updated_at: datetime


class PlacementDomainCreate(BaseModel):
    name: str = Field(min_length=1, max_length=128)
    kind: PlacementKind = "site"
    description: str | None = Field(default=None, max_length=2000)
    icon: PlacementIcon | None = None
    site_id: str | None = None


class PlacementDomainUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=128)
    kind: PlacementKind | None = None
    description: str | None = Field(default=None, max_length=2000)
    icon: PlacementIcon | None = None
    site_id: str | None = None


class PlacementDomainRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    kind: str
    description: str | None
    icon: str | None
    site_id: str | None
    created_at: datetime
    updated_at: datetime


class LoadBalancerCreate(BaseModel):
    name: str = Field(min_length=1, max_length=128)
    description: str | None = Field(default=None, max_length=2000)
    ip_address: str | None = Field(default=None, max_length=64)
    site_id: str | None = None
    is_local: bool = False


class LoadBalancerUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=128)
    description: str | None = Field(default=None, max_length=2000)
    ip_address: str | None = Field(default=None, max_length=64)
    site_id: str | None = None


class LoadBalancerRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    description: str | None
    ip_address: str | None
    site_id: str | None
    is_local: bool
    created_at: datetime
    updated_at: datetime
