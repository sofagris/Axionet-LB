from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


HealthStatus = Literal["ok", "degraded", "error"]
ComponentStatus = Literal["ok", "error", "unavailable"]


class ComponentHealth(BaseModel):
    status: ComponentStatus
    detail: str | None = None
    latency_ms: float | None = None


class HealthResponse(BaseModel):
    status: HealthStatus
    service: str = "ax-api"
    version: str = "0.1.0"
    checked_at: datetime
    components: dict[str, ComponentHealth]


class SystemInfoResponse(BaseModel):
    name: str
    version: str = "0.1.0"
    api_prefix: str
    data_dir: str
    database_configured: bool
    docker_configured: bool


class CapabilitiesResponse(BaseModel):
    features: list[str] = Field(default_factory=list)
    dataplane_services: list[str] = Field(default_factory=list)
