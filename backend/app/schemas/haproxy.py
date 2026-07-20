from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


class HaproxyFrontendRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    name: str
    bind_address: str
    bind_port: int
    mode: str
    default_backend: str
    certificate: str | None = None


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


class HaproxyCertificateCreate(BaseModel):
    name: str = Field(min_length=1, max_length=64, pattern=r"^[A-Za-z0-9][A-Za-z0-9._-]*$")
    pem: str = Field(min_length=64)


class HaproxyCertificateRead(BaseModel):
    name: str
    filename: str
    size_bytes: int = 0


class HaproxyMapCreate(BaseModel):
    name: str = Field(min_length=1, max_length=64, pattern=r"^[A-Za-z0-9][A-Za-z0-9._-]*$")
    content: str = Field(min_length=1, max_length=1_000_000)


class HaproxyMapRead(BaseModel):
    name: str
    filename: str
    size_bytes: int = 0


class HaproxyMapDetail(HaproxyMapRead):
    content: str


class HaproxyAclRead(BaseModel):
    name: str
    frontend: str
    expression: str
    use_backend: str | None = None


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


class HaproxyServerRuntimeRequest(BaseModel):
    action: Literal["enable", "disable", "drain", "set_weight"]
    weight: int | None = Field(default=None, ge=0, le=256)


class HaproxyServerRuntimeResult(BaseModel):
    ok: bool
    backend: str
    server: str
    action: str
    output: str
    ephemeral: bool = True


class HaproxyClearCountersResult(BaseModel):
    ok: bool
    output: str
    ephemeral: bool = True
