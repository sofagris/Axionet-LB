from __future__ import annotations

import csv
import io
from dataclasses import dataclass

from docker.errors import DockerException

from app.services.docker.client import DockerClientAdapter

STATS_CURL_IMAGE = "curlimages/curl:8.12.1"


@dataclass(frozen=True, slots=True)
class RuntimeRow:
    pxname: str
    svname: str
    status: str
    weight: str
    scur: str
    smax: str
    stot: str
    bin: str
    bout: str
    ereq: str
    econ: str
    eresp: str
    check_status: str
    check_code: str
    lastchg: str
    downtime: str
    type_code: str
    rate: str = ""


class HaproxyRuntimeClient:
    """Fetch HAProxy CSV stats via a curl sidecar sharing the instance network namespace."""

    def __init__(self, docker: DockerClientAdapter, stats_port: int = 8404) -> None:
        self._docker = docker
        self._stats_port = stats_port

    def fetch_stats_csv(self, container_id: str) -> str:
        url = f"http://127.0.0.1:{self._stats_port}/stats;csv"
        try:
            return self._docker.run_network_sidecar(
                image=STATS_CURL_IMAGE,
                network_container_id=container_id,
                command=["curl", "-fsS", url],
            )
        except DockerException as exc:
            raise RuntimeError(f"Failed to fetch HAProxy stats: {exc}") from exc

    def parse_stats(self, csv_text: str) -> list[RuntimeRow]:
        # HAProxy CSV starts with "# "
        cleaned = "\n".join(
            line[2:] if line.startswith("# ") else line for line in csv_text.splitlines() if line
        )
        reader = csv.DictReader(io.StringIO(cleaned))
        rows: list[RuntimeRow] = []
        for item in reader:
            rows.append(
                RuntimeRow(
                    pxname=item.get("pxname", ""),
                    svname=item.get("svname", ""),
                    status=item.get("status", ""),
                    weight=item.get("weight", ""),
                    scur=item.get("scur", ""),
                    smax=item.get("smax", ""),
                    stot=item.get("stot", ""),
                    bin=item.get("bin", ""),
                    bout=item.get("bout", ""),
                    ereq=item.get("ereq", ""),
                    econ=item.get("econ", ""),
                    eresp=item.get("eresp", ""),
                    check_status=item.get("check_status", ""),
                    check_code=item.get("check_code", ""),
                    lastchg=item.get("lastchg", ""),
                    downtime=item.get("downtime", ""),
                    type_code=item.get("type", ""),
                    rate=item.get("rate", ""),
                )
            )
        return rows
