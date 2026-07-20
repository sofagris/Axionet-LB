from __future__ import annotations

from app.plugins.base import ContainerSpec, ValidationResult
from app.plugins.frr.renderer import render_frr_config, render_frr_files
from app.plugins.frr.schemas import FrrConfig
from app.plugins.frr.validator import FrrConfigValidator
from app.services.docker.client import DockerClientAdapter


class FrrPlugin:
    service_type = "frr"

    def normalize_configuration(self, configuration: dict | None) -> dict:
        return FrrConfig.from_dict(configuration).model_dump()

    def render(self, configuration: dict) -> str:
        return render_frr_config(FrrConfig.from_dict(configuration))

    def render_files(self, configuration: dict) -> dict[str, str]:
        return render_frr_files(FrrConfig.from_dict(configuration))

    def validate(
        self,
        docker: DockerClientAdapter,
        *,
        image: str,
        configuration: dict,
        extra_files: dict[str, str] | None = None,
    ) -> ValidationResult:
        _ = extra_files
        return FrrConfigValidator(docker, image=image).validate_config_dict(configuration)

    def container_spec(self) -> ContainerSpec:
        return ContainerSpec(
            config_bind="/etc/frr",
            volume_mode="rw",
            command=None,
            entrypoint=None,
            cap_add=["NET_ADMIN", "NET_RAW", "SYS_ADMIN", "NET_BIND_SERVICE"],
            sysctls={"net.ipv4.ip_forward": "1"},
        )

    def reload_signal(self) -> str | None:
        # FRR prefers container restart for integrated config reloads in MVP.
        return None
