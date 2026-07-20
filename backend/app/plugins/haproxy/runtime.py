from __future__ import annotations

import csv
import io
import logging
import re
import shlex
from dataclasses import dataclass
from typing import Literal

from docker.errors import DockerException

from app.services.docker.client import DockerClientAdapter

STATS_CURL_IMAGE = "curlimages/curl:8.12.1"
SOCAT_IMAGE = "alpine/socat:1.8.0.1"
ADMIN_TCP = "127.0.0.1:9999"
NAME_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$")

RuntimeAction = Literal["enable", "disable", "drain", "set_weight"]

logger = logging.getLogger(__name__)


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
    """Fetch HAProxy CSV stats and send admin-socket runtime commands."""

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

    def server_action(
        self,
        container_id: str,
        *,
        backend: str,
        server: str,
        action: RuntimeAction,
        weight: int | None = None,
    ) -> str:
        self._validate_name(backend, "backend")
        self._validate_name(server, "server")
        target = f"{backend}/{server}"
        if action == "enable":
            command = f"set server {target} state ready"
        elif action == "disable":
            command = f"disable server {target}"
        elif action == "drain":
            command = f"set server {target} state drain"
        elif action == "set_weight":
            if weight is None:
                raise ValueError("weight is required for set_weight")
            if weight < 0 or weight > 256:
                raise ValueError("weight must be between 0 and 256")
            command = f"set server {target} weight {weight}"
        else:
            raise ValueError(f"Unsupported action: {action}")
        return self.send_admin_command(container_id, command)

    def send_admin_command(self, container_id: str, command: str) -> str:
        """Send one line to the HAProxy admin socket (TCP localhost:9999 via socat sidecar)."""
        if "\n" in command or "\r" in command:
            raise ValueError("Invalid admin command")
        shell = f"printf '%s\\n' {shlex.quote(command)} | socat -t 3 - TCP:{ADMIN_TCP}"
        try:
            output = self._docker.run_network_sidecar(
                image=SOCAT_IMAGE,
                network_container_id=container_id,
                entrypoint=["/bin/sh", "-c"],
                command=[shell],
            )
        except DockerException as exc:
            raise RuntimeError(f"Failed to send HAProxy runtime command: {exc}") from exc
        cleaned = (output or "").strip()
        # HAProxy returns empty string on success for many set/disable commands
        if cleaned.lower().startswith("unknown") or "not found" in cleaned.lower():
            raise RuntimeError(cleaned or "HAProxy rejected runtime command")
        return cleaned or "ok"

    @staticmethod
    def _validate_name(value: str, field: str) -> None:
        if not NAME_RE.match(value):
            raise ValueError(f"Invalid {field} name")
