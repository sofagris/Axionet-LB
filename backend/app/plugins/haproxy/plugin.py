from __future__ import annotations

from app.plugins.base import ContainerSpec, ValidationResult
from app.plugins.haproxy.renderer import render_haproxy_config
from app.plugins.haproxy.schemas import HaproxyConfig
from app.plugins.haproxy.validator import HaproxyConfigValidator
from app.services.docker.client import DockerClientAdapter


class HaproxyPlugin:
    service_type = "haproxy"

    def normalize_configuration(self, configuration: dict | None) -> dict:
        return HaproxyConfig.from_dict(configuration).model_dump()

    def render(self, configuration: dict) -> str:
        return render_haproxy_config(HaproxyConfig.from_dict(configuration))

    def render_files(self, configuration: dict) -> dict[str, str]:
        return {"haproxy.cfg": self.render(configuration)}

    def validate(
        self,
        docker: DockerClientAdapter,
        *,
        image: str,
        configuration: dict,
        extra_files: dict[str, str] | None = None,
    ) -> ValidationResult:
        cert_files: dict[str, str] = {}
        map_files: dict[str, str] = {}
        if extra_files:
            for path, content in extra_files.items():
                if path.startswith("certs/") and path.endswith(".pem"):
                    cert_files[path.removeprefix("certs/").removesuffix(".pem")] = content
                elif path.startswith("maps/") and path.endswith(".map"):
                    map_files[path.removeprefix("maps/").removesuffix(".map")] = content
        return HaproxyConfigValidator(docker, image=image).validate_config_dict(
            configuration,
            cert_files=cert_files or None,
            map_files=map_files or None,
        )

    def container_spec(self) -> ContainerSpec:
        return ContainerSpec(
            config_bind="/usr/local/etc/haproxy",
            volume_mode="ro",
            command=["haproxy", "-W", "-db", "-f", "/usr/local/etc/haproxy/haproxy.cfg"],
        )

    def reload_signal(self) -> str | None:
        return "SIGUSR2"
