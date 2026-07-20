from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.db.session import get_db
from app.schemas.system import (
    CapabilitiesResponse,
    HealthResponse,
    SystemInfoResponse,
    SystemMetricsResponse,
)
from app.services.docker.client import DockerClientAdapter, create_docker_adapter
from app.services.system.health import SystemService
from app.services.system.metrics import HostMetricsCollector

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
        _metrics_collector = HostMetricsCollector(proc_root=settings.host_proc_root)
    return _metrics_collector


@router.get("", response_model=SystemInfoResponse)
def get_system(service: SystemService = Depends(get_system_service)) -> SystemInfoResponse:
    return service.get_info()


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


@router.get("/capabilities", response_model=CapabilitiesResponse)
def get_capabilities(service: SystemService = Depends(get_system_service)) -> CapabilitiesResponse:
    return service.get_capabilities()
