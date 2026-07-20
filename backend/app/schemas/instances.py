from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from app.models.service_instance import ActualState, DesiredState, HealthStatus
from app.plugins.haproxy.schemas import HaproxyConfig


class NetworkAttachmentCreate(BaseModel):
    network_id: str
    ip_address: str | None = None
    gateway: str | None = None
    interface_alias: str | None = None
    attachment_order: int = 0


class NetworkAttachmentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    network_id: str
    ip_address: str | None
    gateway: str | None
    interface_alias: str | None
    attachment_order: int
    created_at: datetime


class InstanceCreate(BaseModel):
    name: str = Field(min_length=1, max_length=128)
    service_type: str = "haproxy"
    desired_state: DesiredState = DesiredState.STOPPED
    image_version: str = "3.2.6"
    restart_policy: str = "unless-stopped"
    configuration: dict[str, Any] | None = None
    networks: list[NetworkAttachmentCreate] = Field(default_factory=list)


class InstanceUpdate(BaseModel):
    desired_state: DesiredState | None = None
    configuration: dict[str, Any] | None = None
    restart_policy: str | None = None


class InstanceRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    service_type: str
    desired_state: DesiredState
    actual_state: ActualState
    image: str
    image_version: str
    restart_policy: str
    configuration: dict[str, Any]
    container_id: str | None
    container_name: str | None
    last_error: str | None
    health_status: HealthStatus
    created_at: datetime
    updated_at: datetime
    started_at: datetime | None
    stopped_at: datetime | None
    networks: list[NetworkAttachmentRead] = Field(default_factory=list)


class InstanceStatus(BaseModel):
    id: str
    desired_state: DesiredState
    actual_state: ActualState
    health_status: HealthStatus
    container_id: str | None
    container_status: str | None = None
    last_error: str | None = None


class InstanceLogs(BaseModel):
    id: str
    logs: str


class InstanceValidateResult(BaseModel):
    ok: bool
    output: str
    rendered_preview: str | None = None


class ServiceDefinitionRead(BaseModel):
    service_type: str
    display_name: str
    description: str
    container_image: str
    default_version: str
    enabled: bool
    supported_actions: list[str]
