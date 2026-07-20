from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.db.session import get_db
from app.schemas.system import (
    AuditEventListResponse,
    AuditEventRead,
    CapabilitiesResponse,
    HealthResponse,
    LbMetricsResponse,
    OrphanPruneRequest,
    OrphanPruneResult,
    OrphanReport,
    SystemInfoResponse,
    SystemLogError,
    SystemLogInstance,
    SystemLogsResponse,
    SystemMetricsResponse,
)
from app.services.audit.service import AuditService
from app.services.docker.client import DockerClientAdapter, create_docker_adapter
from app.services.instances.metrics import HaproxyMetricsCollector
from app.services.instances.service import InstanceService
from app.services.system.health import SystemService
from app.services.system.metrics import HostMetricsCollector
from app.services.system.orphans import OrphanService

router = APIRouter(prefix="/system", tags=["system"])

_metrics_collector: HostMetricsCollector | None = None


def get_docker_adapter(settings: Settings = Depends(get_settings)) -> DockerClientAdapter:
    return create_docker_adapter(settings)


def get_system_service(
    settings: Settings = Depends(get_settings),
    docker_adapter: DockerClientAdapter = Depends(get_docker_adapter),
) -> SystemService:
    return SystemService(settings=settings, docker_adapter=docker_adapter)


def get_metrics_collector(settings: Settings = Depends(get_settings)) -> HostMetricsCollector:
    global _metrics_collector
    if _metrics_collector is None:
        _metrics_collector = HostMetricsCollector(
            proc_root=settings.host_proc_root,
            sysfs_root=settings.host_sysfs_root,
        )
    return _metrics_collector


@router.get("", response_model=SystemInfoResponse)
def get_system(
    db: Session = Depends(get_db),
    service: SystemService = Depends(get_system_service),
) -> SystemInfoResponse:
    return service.get_info(db)


@router.get("/health", response_model=HealthResponse)
def get_health(
    db: Session = Depends(get_db),
    service: SystemService = Depends(get_system_service),
) -> HealthResponse:
    return service.check_health(db)


@router.get("/metrics", response_model=SystemMetricsResponse)
def get_metrics(
    collector: HostMetricsCollector = Depends(get_metrics_collector),
) -> SystemMetricsResponse:
    return collector.collect()


@router.get("/lb-metrics", response_model=LbMetricsResponse)
def get_lb_metrics(
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
    docker: DockerClientAdapter = Depends(get_docker_adapter),
) -> LbMetricsResponse:
    instances = InstanceService(db=db, docker=docker, settings=settings)
    return HaproxyMetricsCollector(docker=docker, instances=instances).collect_fleet()


@router.get("/capabilities", response_model=CapabilitiesResponse)
def get_capabilities(service: SystemService = Depends(get_system_service)) -> CapabilitiesResponse:
    return service.get_capabilities()


@router.get("/logs", response_model=SystemLogsResponse)
def get_system_logs(
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
    docker: DockerClientAdapter = Depends(get_docker_adapter),
) -> SystemLogsResponse:
    """Fleet log overview: instance errors and log sources (container tails via instance logs API)."""
    instances = InstanceService(db=db, docker=docker, settings=settings).list_instances()
    errors: list[SystemLogError] = []
    overview: list[SystemLogInstance] = []
    for item in instances:
        overview.append(
            SystemLogInstance(
                instance_id=item.id,
                name=item.name,
                service_type=item.service_type,
                actual_state=item.actual_state,
                health_status=item.health_status,
                has_error=bool(item.last_error),
                container_name=item.container_name,
            )
        )
        if item.last_error:
            errors.append(
                SystemLogError(
                    instance_id=item.id,
                    name=item.name,
                    service_type=item.service_type,
                    actual_state=item.actual_state,
                    health_status=item.health_status,
                    last_error=item.last_error,
                    updated_at=item.updated_at,
                )
            )
    return SystemLogsResponse(errors=errors, instances=overview, collected_at=datetime.now(UTC))


@router.get("/audit", response_model=AuditEventListResponse)
def list_audit_events(
    limit: int = 100,
    offset: int = 0,
    event_type: str | None = None,
    resource_type: str | None = None,
    resource_id: str | None = None,
    db: Session = Depends(get_db),
) -> AuditEventListResponse:
    events = AuditService(db).list_events(
        limit=limit,
        offset=offset,
        event_type=event_type,
        resource_type=resource_type,
        resource_id=resource_id,
    )
    return AuditEventListResponse(
        events=[AuditEventRead.model_validate(item, from_attributes=True) for item in events],
        limit=min(max(limit, 1), 500),
        offset=max(offset, 0),
    )


def get_orphan_service(
    db: Session = Depends(get_db),
    docker_adapter: DockerClientAdapter = Depends(get_docker_adapter),
) -> OrphanService:
    return OrphanService(db=db, docker=docker_adapter)


@router.get("/orphans", response_model=OrphanReport)
def get_orphans(service: OrphanService = Depends(get_orphan_service)) -> OrphanReport:
    return OrphanReport.model_validate(service.scan())


@router.post("/orphans/prune", response_model=OrphanPruneResult)
def prune_orphans(
    payload: OrphanPruneRequest,
    service: OrphanService = Depends(get_orphan_service),
) -> OrphanPruneResult:
    try:
        result = service.prune(
            container_ids=payload.container_ids,
            network_ids=payload.network_ids,
        )
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc
    return OrphanPruneResult.model_validate(result)
