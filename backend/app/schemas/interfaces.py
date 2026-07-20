from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.physical_interface import AdministrativeState, LinkState


class PhysicalInterfaceRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    mac_address: str | None
    pci_address: str | None
    numa_node: int | None
    speed_mbps: int | None
    driver: str | None
    description: str | None
    mtu: int | None
    link_state: LinkState
    administrative_state: AdministrativeState
    exclusive_use: bool
    is_management: bool = False
    discovered_at: datetime
    updated_at: datetime


class PhysicalInterfaceUpdate(BaseModel):
    description: str | None = None
    administrative_state: AdministrativeState | None = None
    exclusive_use: bool | None = None
    mtu: int | None = Field(default=None, ge=68, le=9216)
    speed_mbps: int | None = Field(default=None, ge=10, le=400_000)
    speed_autoneg: bool | None = None
    confirm: bool = False


class PhysicalInterfaceApplyResult(BaseModel):
    interface: PhysicalInterfaceRead
    pending_change_id: str | None = None
    rollback_at: datetime | None = None
    message: str | None = None


class PromoteManagementResult(BaseModel):
    interface: PhysicalInterfaceRead
    management_bind_ip: str
    compose_hint: str
    requires_compose_recreate: bool = True


class PendingChangeRead(BaseModel):
    id: str
    interface_id: str
    interface_name: str
    rollback_at: datetime
    confirmed: bool


class InterfaceRescanResponse(BaseModel):
    discovered: int = Field(description="Interfaces found on this scan")
    created: int
    updated: int
    removed: int
    interfaces: list[PhysicalInterfaceRead]
