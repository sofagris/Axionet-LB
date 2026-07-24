from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class VipCreate(BaseModel):
    name: str = Field(min_length=1, max_length=128)
    address: str = Field(min_length=1, max_length=64)
    haproxy_instance_id: str
    frr_instance_id: str
    network_id: str
    enabled: bool = True
    advertise: bool = True
    bind_frontends: bool = False


class VipUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=128)
    address: str | None = Field(default=None, min_length=1, max_length=64)
    haproxy_instance_id: str | None = None
    frr_instance_id: str | None = None
    network_id: str | None = None
    enabled: bool | None = None
    advertise: bool | None = None
    bind_frontends: bool | None = None


class VipRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    address: str
    haproxy_instance_id: str
    frr_instance_id: str
    network_id: str
    enabled: bool
    advertise: bool
    attached: bool
    advertised: bool
    last_error: str | None
    created_at: datetime
    updated_at: datetime
    announce_prefix: str | None = None
