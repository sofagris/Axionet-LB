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
    discovered_at: datetime
    updated_at: datetime


class PhysicalInterfaceUpdate(BaseModel):
    description: str | None = None
    administrative_state: AdministrativeState | None = None
    exclusive_use: bool | None = None


class InterfaceRescanResponse(BaseModel):
    discovered: int = Field(description="Interfaces found on this scan")
    created: int
    updated: int
    removed: int
    interfaces: list[PhysicalInterfaceRead]
