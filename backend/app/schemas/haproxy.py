from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class HaproxyFrontendRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    name: str
    bind_address: str
    bind_port: int
    mode: str
    default_backend: str


class HaproxyServerRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    name: str
    address: str
    port: int
    check: bool
    weight: int
    inter_ms: int
    rise: int
    fall: int


class HaproxyBackendRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    name: str
    balance: str
    mode: str
    servers: list[HaproxyServerRead] = Field(default_factory=list)


class HaproxyConfigPreview(BaseModel):
    configuration: dict[str, Any]
    rendered: str


class HaproxyStatRow(BaseModel):
    proxy: str
    server: str
    status: str
    weight: str | None = None
    current_sessions: str | None = None
    max_sessions: str | None = None
    total_sessions: str | None = None
    bytes_in: str | None = None
    bytes_out: str | None = None
    check_status: str | None = None
    check_code: str | None = None
    downtime: str | None = None


class HaproxyRuntimeStatus(BaseModel):
    instance_id: str
    available: bool
    frontends: list[HaproxyStatRow] = Field(default_factory=list)
    backends: list[HaproxyStatRow] = Field(default_factory=list)
    servers: list[HaproxyStatRow] = Field(default_factory=list)
