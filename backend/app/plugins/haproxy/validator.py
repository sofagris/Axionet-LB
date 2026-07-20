from __future__ import annotations

from dataclasses import dataclass

from docker.errors import ContainerError, DockerException, ImageNotFound

from app.plugins.haproxy.schemas import HaproxyConfig
from app.services.docker.client import DockerClientAdapter


@dataclass(frozen=True, slots=True)
class ValidationResult:
    ok: bool
    output: str


class HaproxyConfigValidator:
    """Validate rendered config using the official HAProxy image (`haproxy -c`)."""

    def __init__(self, docker: DockerClientAdapter, image: str = "haproxy:3.2.6") -> None:
        self._docker = docker
        self._image = image

    def validate_config_dict(
        self,
        configuration: dict,
        *,
        cert_files: dict[str, str] | None = None,
        map_files: dict[str, str] | None = None,
    ) -> ValidationResult:
        from app.plugins.haproxy.renderer import render_haproxy_config

        rendered = render_haproxy_config(HaproxyConfig.from_dict(configuration))
        files = {"haproxy.cfg": rendered}
        if cert_files:
            for name, content in cert_files.items():
                files[f"certs/{name}.pem"] = content
        if map_files:
            for name, content in map_files.items():
                files[f"maps/{name}.map"] = content
        return self.validate_files(files)

    def validate_rendered(self, rendered_config: str) -> ValidationResult:
        return self.validate_files({"haproxy.cfg": rendered_config})

    def validate_files(self, files: dict[str, str]) -> ValidationResult:
        try:
            output = self._docker.run_ephemeral(
                image=self._image,
                command=["haproxy", "-c", "-f", "/usr/local/etc/haproxy/haproxy.cfg"],
                files=files,
            )
            return ValidationResult(ok=True, output=output or "Configuration file is valid")
        except ImageNotFound as exc:
            return ValidationResult(ok=False, output=f"Image not found: {exc}")
        except ContainerError as exc:
            stderr = (
                (exc.stderr or b"").decode("utf-8", errors="replace")
                if isinstance(exc.stderr, bytes)
                else str(exc.stderr or "")
            )
            return ValidationResult(ok=False, output=stderr or str(exc))
        except DockerException as exc:
            return ValidationResult(ok=False, output=str(exc))
