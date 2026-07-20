from __future__ import annotations

import docker
from docker.errors import DockerException

from app.core.config import Settings


class DockerClientAdapter:
    """Thin adapter so Docker socket usage stays behind one boundary."""

    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._client: docker.DockerClient | None = None

    def _get_client(self) -> docker.DockerClient:
        if self._client is None:
            timeout = self._settings.docker_timeout_seconds
            if self._settings.docker_host:
                self._client = docker.DockerClient(
                    base_url=self._settings.docker_host,
                    timeout=timeout,
                )
            else:
                self._client = docker.from_env(timeout=timeout)
        return self._client

    def ping(self) -> None:
        client = self._get_client()
        if not client.ping():
            raise DockerException("Docker daemon did not respond to ping")

    def close(self) -> None:
        if self._client is not None:
            self._client.close()
            self._client = None


def create_docker_adapter(settings: Settings) -> DockerClientAdapter:
    return DockerClientAdapter(settings)
