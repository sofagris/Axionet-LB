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
    management_interface: str | None = None
    management_bind_ip: str | None = None


class CapabilitiesResponse(BaseModel):
    features: list[str] = Field(default_factory=list)
    dataplane_services: list[str] = Field(default_factory=list)


class SystemLogError(BaseModel):
    instance_id: str
    name: str
    service_type: str
    actual_state: str
    health_status: str
    last_error: str
    updated_at: datetime


class SystemLogInstance(BaseModel):
    instance_id: str
    name: str
    service_type: str
    actual_state: str
    health_status: str
    has_error: bool
    container_name: str | None = None


class SystemLogsResponse(BaseModel):
    errors: list[SystemLogError] = Field(default_factory=list)
    instances: list[SystemLogInstance] = Field(default_factory=list)
    collected_at: datetime


class AuditEventRead(BaseModel):
    id: str
    event_type: str
    actor: str
    resource_type: str
    resource_id: str | None = None
    payload: dict = Field(default_factory=dict)
    result: str
    created_at: datetime


class AuditEventListResponse(BaseModel):
    events: list[AuditEventRead] = Field(default_factory=list)
    limit: int
    offset: int


class NetworkTotalsRead(BaseModel):
    rx_bytes: int
    tx_bytes: int
    rx_packets: int
    tx_packets: int
    rx_errors: int
    tx_errors: int
    rx_dropped: int
    tx_dropped: int


class InterfaceCountersRead(BaseModel):
    name: str
    link_state: str
    rx_bytes: int
    tx_bytes: int
    rx_packets: int
    tx_packets: int
    rx_errors: int
    tx_errors: int
    rx_dropped: int
    tx_dropped: int


class SystemMetricsResponse(BaseModel):
    cpu_percent: float
    mem_total_bytes: int
    mem_available_bytes: int
    mem_used_percent: float
    load_avg_1: float | None = None
    load_avg_5: float | None = None
    load_avg_15: float | None = None
    network: NetworkTotalsRead | None = None
    interfaces: list[InterfaceCountersRead] = Field(default_factory=list)
    collected_at: datetime


class LbInstanceMetricsRead(BaseModel):
    instance_id: str
    name: str
    available: bool
    current_sessions: int = 0
    total_sessions: int = 0
    session_rate: int = 0
    bytes_in: int = 0
    bytes_out: int = 0
    request_errors: int = 0
    connection_errors: int = 0
    response_errors: int = 0
    servers_up: int = 0
    servers_down: int = 0
    servers_total: int = 0
    frontend_count: int = 0
    backend_count: int = 0
    detail: str | None = None


class LbMetricsTotals(BaseModel):
    current_sessions: int = 0
    total_sessions: int = 0
    session_rate: int = 0
    bytes_in: int = 0
    bytes_out: int = 0
    request_errors: int = 0
    connection_errors: int = 0
    response_errors: int = 0
    servers_up: int = 0
    servers_down: int = 0
    servers_total: int = 0
    instances_available: int = 0
    instances_total: int = 0


class LbMetricsResponse(BaseModel):
    totals: LbMetricsTotals
    instances: list[LbInstanceMetricsRead] = Field(default_factory=list)
    collected_at: datetime


class OrphanContainer(BaseModel):
    kind: Literal["container"] = "container"
    id: str
    name: str
    status: str
    image: str = ""
    instance_id: str | None = None
    service_type: str | None = None
    reason: str
    prunable: bool = False


class OrphanNetwork(BaseModel):
    kind: Literal["network"] = "network"
    id: str
    name: str
    driver: str = ""
    network_id: str | None = None
    network_type: str | None = None
    reason: str
    prunable: bool = False


class OrphanReport(BaseModel):
    docker_ok: bool
    docker_error: str | None = None
    orphan_containers: list[OrphanContainer] = Field(default_factory=list)
    orphan_networks: list[OrphanNetwork] = Field(default_factory=list)
    missing_containers: list[OrphanContainer] = Field(default_factory=list)
    missing_networks: list[OrphanNetwork] = Field(default_factory=list)
    collected_at: datetime


class OrphanPruneRequest(BaseModel):
    container_ids: list[str] = Field(default_factory=list)
    network_ids: list[str] = Field(default_factory=list)


class OrphanPruneResult(BaseModel):
    removed_containers: list[str] = Field(default_factory=list)
    removed_networks: list[str] = Field(default_factory=list)
    errors: list[str] = Field(default_factory=list)
