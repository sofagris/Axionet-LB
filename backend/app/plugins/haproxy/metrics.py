from __future__ import annotations

from dataclasses import dataclass

from app.plugins.haproxy.runtime import RuntimeRow


def _as_int(value: str | None) -> int:
    if not value:
        return 0
    try:
        return int(value)
    except ValueError:
        return 0


@dataclass(frozen=True, slots=True)
class AggregatedHaproxyMetrics:
    current_sessions: int
    total_sessions: int
    session_rate: int
    bytes_in: int
    bytes_out: int
    request_errors: int
    connection_errors: int
    response_errors: int
    servers_up: int
    servers_down: int
    servers_total: int
    frontend_count: int
    backend_count: int


def aggregate_runtime_rows(rows: list[RuntimeRow]) -> AggregatedHaproxyMetrics:
    """Aggregate HAProxy CSV rows without double-counting backends/servers.

    Session and byte counters are taken from FRONTEND rows only.
    Server health counts exclude FRONTEND/BACKEND summary lines.
    """
    current_sessions = 0
    total_sessions = 0
    session_rate = 0
    bytes_in = 0
    bytes_out = 0
    request_errors = 0
    connection_errors = 0
    response_errors = 0
    servers_up = 0
    servers_down = 0
    servers_total = 0
    frontend_count = 0
    backend_count = 0

    for row in rows:
        if row.svname == "FRONTEND":
            frontend_count += 1
            current_sessions += _as_int(row.scur)
            total_sessions += _as_int(row.stot)
            session_rate += _as_int(row.rate)
            bytes_in += _as_int(row.bin)
            bytes_out += _as_int(row.bout)
            request_errors += _as_int(row.ereq)
            continue
        if row.svname == "BACKEND":
            backend_count += 1
            connection_errors += _as_int(row.econ)
            response_errors += _as_int(row.eresp)
            continue
        if not row.pxname:
            continue
        servers_total += 1
        if row.status.upper() == "UP":
            servers_up += 1
        else:
            servers_down += 1

    return AggregatedHaproxyMetrics(
        current_sessions=current_sessions,
        total_sessions=total_sessions,
        session_rate=session_rate,
        bytes_in=bytes_in,
        bytes_out=bytes_out,
        request_errors=request_errors,
        connection_errors=connection_errors,
        response_errors=response_errors,
        servers_up=servers_up,
        servers_down=servers_down,
        servers_total=servers_total,
        frontend_count=frontend_count,
        backend_count=backend_count,
    )
