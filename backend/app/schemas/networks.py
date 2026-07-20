from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.network import NetworkType


class NetworkCreate(BaseModel):
    name: str = Field(min_length=1, max_length=128)
    network_type: NetworkType
    parent_interface_id: str | None = None
    vlan_id: int | None = Field(default=None, ge=1, le=4094)
    subnet: str | None = None
    gateway: str | None = None
    ip_range: str | None = None
    mtu: int | None = Field(default=None, ge=576, le=9216)
    enabled: bool = True


class NetworkUpdate(BaseModel):
    enabled: bool | None = None
    mtu: int | None = Field(default=None, ge=576, le=9216)


class NetworkRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    network_type: NetworkType
    parent_interface_id: str | None
    vlan_id: int | None
    subnet: str | None
    gateway: str | None
    ip_range: str | None
    mtu: int | None
    docker_network_id: str | None
    docker_network_name: str | None
    parent_device: str | None
    enabled: bool
    last_error: str | None
    created_at: datetime
    updated_at: datetime
    docker_exists: bool = False


class NetworkValidationIssue(BaseModel):
    code: str
    message: str
    severity: str = "error"


class NetworkValidationResult(BaseModel):
    valid: bool
    issues: list[NetworkValidationIssue] = Field(default_factory=list)
