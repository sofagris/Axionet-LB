from __future__ import annotations

from app.plugins.base import ContainerSpec, ValidationResult
from app.plugins.varnish.renderer import render_default_vcl, render_varnish_files
from app.plugins.varnish.schemas import VarnishConfig
from app.services.docker.client import DockerClientAdapter


class VarnishPlugin:
    service_type = "varnish"

    def normalize_configuration(self, configuration: dict | None) -> dict:
        return VarnishConfig.from_dict(configuration).model_dump()

    def render(self, configuration: dict) -> str:
        return render_default_vcl(VarnishConfig.from_dict(configuration))

    def render_files(self, configuration: dict) -> dict[str, str]:
        return render_varnish_files(VarnishConfig.from_dict(configuration))

    def validate(
        self,
        docker: DockerClientAdapter,
        *,
        image: str,
        configuration: dict,
        extra_files: dict[str, str] | None = None,
    ) -> ValidationResult:
        _ = docker, image, extra_files
        try:
            cfg = VarnishConfig.from_dict(configuration)
        except Exception as exc:  # noqa: BLE001
            return ValidationResult(ok=False, output=str(exc))
        if not cfg.origin.address:
            return ValidationResult(ok=False, output="origin.address is required")
        return ValidationResult(ok=True, output="varnish configuration ok")

    def container_spec(self, configuration: dict | None = None) -> ContainerSpec:
        cfg = VarnishConfig.from_dict(configuration)
        return ContainerSpec(
            config_bind="/etc/varnish",
            volume_mode="ro",
            entrypoint=["varnishd"],
            command=[
                "-F",
                "-a",
                cfg.varnish_listen(),
                "-f",
                "/etc/varnish/default.vcl",
                "-s",
                f"malloc,{cfg.storage_size}",
            ],
        )

    def reload_signal(self) -> str | None:
        # Soft VCL reload can come later; restart on apply for v1.
        return None
