from __future__ import annotations

from docker.errors import ContainerError, DockerException, ImageNotFound

from app.plugins.base import ValidationResult
from app.plugins.frr.renderer import render_frr_files
from app.plugins.frr.schemas import FrrConfig
from app.services.docker.client import DockerClientAdapter


class FrrConfigValidator:
    """Validate FRR config files inside an ephemeral FRR image."""

    def __init__(self, docker: DockerClientAdapter, image: str = "frrouting/frr:v10.2.1") -> None:
        self._docker = docker
        self._image = image

    def validate_config_dict(self, configuration: dict) -> ValidationResult:
        files = render_frr_files(FrrConfig.from_dict(configuration))
        return self.validate_files(files)

    def validate_files(self, files: dict[str, str]) -> ValidationResult:
        try:
            # Lightweight structural check inside the FRR image (no full daemon boot).
            output = self._docker.run_ephemeral(
                image=self._image,
                command=[
                    "-c",
                    "test -s /etc/frr/daemons && test -s /etc/frr/frr.conf && "
                    "test -s /etc/frr/vtysh.conf && "
                    "grep -Eq 'router bgp [0-9]+' /etc/frr/frr.conf && "
                    "grep -q 'bgpd=yes' /etc/frr/daemons && "
                    "echo FRR configuration looks valid",
                ],
                files=files,
                bind_path="/etc/frr",
                entrypoint=["/bin/sh"],
            )
            return ValidationResult(ok=True, output=output or "FRR configuration is valid")
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
