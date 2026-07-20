from __future__ import annotations

from datetime import UTC, datetime

from app.models.service_instance import ActualState, ServiceInstance
from app.plugins.haproxy.metrics import aggregate_runtime_rows
from app.plugins.haproxy.runtime import HaproxyRuntimeClient
from app.plugins.haproxy.schemas import HaproxyConfig
from app.schemas.instances import InstanceMetrics
from app.schemas.system import LbInstanceMetricsRead, LbMetricsResponse, LbMetricsTotals
from app.services.docker.client import DockerClientAdapter
from app.services.instances.service import InstanceService


class HaproxyMetricsCollector:
    """Collect aggregated HAProxy stats for one or all dataplane instances."""

    def __init__(self, docker: DockerClientAdapter, instances: InstanceService) -> None:
        self._docker = docker
        self._instances = instances

    def collect_instance(self, instance: ServiceInstance) -> InstanceMetrics:
        now = datetime.now(UTC)
        if instance.service_type != "haproxy":
            return InstanceMetrics(
                instance_id=instance.id,
                name=instance.name,
                available=False,
                detail="Not a HAProxy instance",
                collected_at=now,
            )
        if not instance.container_id:
            return InstanceMetrics(
                instance_id=instance.id,
                name=instance.name,
                available=False,
                detail="Instance has no container",
                collected_at=now,
            )

        config = HaproxyConfig.from_dict(instance.configuration)
        runtime = HaproxyRuntimeClient(self._docker, stats_port=config.stats_port)
        try:
            csv_text = runtime.fetch_stats_csv(instance.container_id)
            agg = aggregate_runtime_rows(runtime.parse_stats(csv_text))
        except RuntimeError as exc:
            return InstanceMetrics(
                instance_id=instance.id,
                name=instance.name,
                available=False,
                detail=str(exc),
                collected_at=now,
            )

        return InstanceMetrics(
            instance_id=instance.id,
            name=instance.name,
            available=True,
            current_sessions=agg.current_sessions,
            total_sessions=agg.total_sessions,
            session_rate=agg.session_rate,
            bytes_in=agg.bytes_in,
            bytes_out=agg.bytes_out,
            request_errors=agg.request_errors,
            connection_errors=agg.connection_errors,
            response_errors=agg.response_errors,
            servers_up=agg.servers_up,
            servers_down=agg.servers_down,
            servers_total=agg.servers_total,
            frontend_count=agg.frontend_count,
            backend_count=agg.backend_count,
            collected_at=now,
        )

    def collect_fleet(self) -> LbMetricsResponse:
        now = datetime.now(UTC)
        candidates = [
            item
            for item in self._instances.list_instances()
            if item.service_type == "haproxy"
            and item.container_id
            and item.actual_state
            in {
                ActualState.RUNNING.value,
                ActualState.DEGRADED.value,
                ActualState.STARTING.value,
            }
        ]

        rows: list[LbInstanceMetricsRead] = []
        for instance in candidates:
            metrics = self.collect_instance(instance)
            rows.append(
                LbInstanceMetricsRead(
                    instance_id=metrics.instance_id,
                    name=metrics.name,
                    available=metrics.available,
                    current_sessions=metrics.current_sessions,
                    total_sessions=metrics.total_sessions,
                    session_rate=metrics.session_rate,
                    bytes_in=metrics.bytes_in,
                    bytes_out=metrics.bytes_out,
                    request_errors=metrics.request_errors,
                    connection_errors=metrics.connection_errors,
                    response_errors=metrics.response_errors,
                    servers_up=metrics.servers_up,
                    servers_down=metrics.servers_down,
                    servers_total=metrics.servers_total,
                    frontend_count=metrics.frontend_count,
                    backend_count=metrics.backend_count,
                    detail=metrics.detail,
                )
            )

        totals = LbMetricsTotals(instances_total=len(rows))
        for row in rows:
            if not row.available:
                continue
            totals.instances_available += 1
            totals.current_sessions += row.current_sessions
            totals.total_sessions += row.total_sessions
            totals.session_rate += row.session_rate
            totals.bytes_in += row.bytes_in
            totals.bytes_out += row.bytes_out
            totals.request_errors += row.request_errors
            totals.connection_errors += row.connection_errors
            totals.response_errors += row.response_errors
            totals.servers_up += row.servers_up
            totals.servers_down += row.servers_down
            totals.servers_total += row.servers_total

        return LbMetricsResponse(totals=totals, instances=rows, collected_at=now)
