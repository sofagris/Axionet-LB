from __future__ import annotations

from app.services.docker.client import DockerClientAdapter


class FrrRuntimeClient:
    """Read BGP status from a running FRR container via vtysh."""

    def __init__(self, docker: DockerClientAdapter) -> None:
        self._docker = docker

    def bgp_summary(self, container_id: str) -> str:
        return self._docker.exec_in_container(
            container_id,
            ["vtysh", "-c", "show bgp summary"],
        )

    def bgp_neighbors(self, container_id: str) -> str:
        return self._docker.exec_in_container(
            container_id,
            ["vtysh", "-c", "show bgp neighbors"],
        )
