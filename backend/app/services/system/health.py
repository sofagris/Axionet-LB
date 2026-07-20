from __future__ import annotations

import time
from datetime import UTC, datetime

from docker.errors import DockerException
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.schemas.system import (
    CapabilitiesResponse,
    ComponentHealth,
    HealthResponse,
    HealthStatus,
    SystemInfoResponse,
)
from app.services.docker.client import DockerClientAdapter
from app.services.networking.bind_env import read_mgmt_bind_ip
from app.services.networking.discovery import InterfaceDiscoveryService
from app.services.networking.sysfs import SysfsInterfaceScanner


class SystemService:
    def __init__(self, settings: Settings, docker_adapter: DockerClientAdapter) -> None:
        self._settings = settings
        self._docker = docker_adapter

    def get_info(self, db: Session | None = None) -> SystemInfoResponse:
        management_interface = None
        management_bind_ip = read_mgmt_bind_ip(self._settings.data_dir)
        if db is not None:
            discovery = InterfaceDiscoveryService(
                db=db,
                scanner=SysfsInterfaceScanner(self._settings.host_sysfs_root),
            )
            mgmt = next((item for item in discovery.list_interfaces() if item.is_management), None)
            if mgmt is not None:
                management_interface = mgmt.name
        return SystemInfoResponse(
            name=self._settings.app_name,
            api_prefix=self._settings.api_prefix,
            data_dir=self._settings.data_dir,
            database_configured=bool(self._settings.database_url),
            docker_configured=True,
            management_interface=management_interface,
            management_bind_ip=management_bind_ip,
        )

    def get_capabilities(self) -> CapabilitiesResponse:
        return CapabilitiesResponse(
            features=[
                "system.health",
                "system.info",
                "system.metrics",
                "system.capabilities",
                "docker.connectivity",
                "interfaces.discovery",
                "interfaces.rescan",
                "interfaces.live_edit",
                "interfaces.management",
                "networks.crud",
                "networks.ipvlan-l2",
                "networks.validate",
                "instances.haproxy",
                "instances.lifecycle",
                "haproxy.structured_config",
                "haproxy.runtime_status",
            ],
            dataplane_services=["haproxy"],
        )

    def check_health(self, db: Session) -> HealthResponse:
        components: dict[str, ComponentHealth] = {
            "api": ComponentHealth(status="ok", detail="process running"),
            "database": self._check_database(db),
            "docker": self._check_docker(),
        }
        return HealthResponse(
            status=self._overall_status(components),
            checked_at=datetime.now(UTC),
            components=components,
        )

    @staticmethod
    def _overall_status(components: dict[str, ComponentHealth]) -> HealthStatus:
        db_status = components["database"].status
        docker_status = components["docker"].status
        if db_status == "error":
            return "error"
        if docker_status in {"error", "unavailable"}:
            return "degraded"
        return "ok"

    def _check_database(self, db: Session) -> ComponentHealth:
        started = time.perf_counter()
        try:
            db.execute(text("SELECT 1"))
            latency_ms = (time.perf_counter() - started) * 1000
            return ComponentHealth(status="ok", detail="sqlite reachable", latency_ms=latency_ms)
        except Exception as exc:  # noqa: BLE001 - surface any DB failure in health
            return ComponentHealth(status="error", detail=str(exc))

    def _check_docker(self) -> ComponentHealth:
        started = time.perf_counter()
        try:
            self._docker.ping()
            latency_ms = (time.perf_counter() - started) * 1000
            return ComponentHealth(status="ok", detail="engine reachable", latency_ms=latency_ms)
        except DockerException as exc:
            return ComponentHealth(status="error", detail=str(exc))
        except Exception as exc:  # noqa: BLE001
            return ComponentHealth(status="unavailable", detail=str(exc))
