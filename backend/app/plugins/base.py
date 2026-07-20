from __future__ import annotations

from dataclasses import dataclass, field
from typing import Protocol

from app.services.docker.client import DockerClientAdapter


@dataclass(frozen=True, slots=True)
class ValidationResult:
    ok: bool
    output: str


@dataclass(frozen=True, slots=True)
class ContainerSpec:
    """How to run a dataplane container for a service type."""

    config_bind: str
    volume_mode: str = "ro"
    command: list[str] | None = None
    entrypoint: list[str] | None = None
    cap_add: list[str] = field(default_factory=list)
    sysctls: dict[str, str] = field(default_factory=dict)


class ServicePlugin(Protocol):
    service_type: str

    def normalize_configuration(self, configuration: dict | None) -> dict: ...

    def render(self, configuration: dict) -> str: ...

    def render_files(self, configuration: dict) -> dict[str, str]: ...

    def validate(
        self,
        docker: DockerClientAdapter,
        *,
        image: str,
        configuration: dict,
        extra_files: dict[str, str] | None = None,
    ) -> ValidationResult: ...

    def container_spec(self) -> ContainerSpec: ...

    def reload_signal(self) -> str | None:
        """Unix signal for soft reload, or None to restart the container."""
        ...
