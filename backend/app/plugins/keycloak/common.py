from __future__ import annotations

from typing import Any

from app.plugins.base import ContainerSpec, ValidationResult
from app.plugins.keycloak.realm import render_realm_json
from app.plugins.keycloak.schemas import KeycloakConfig
from app.services.docker.client import DockerClientAdapter


class KeycloakPluginBase:
    """Shared Keycloak container wiring for mgmt and apps roles."""

    service_type: str
    role: str  # mgmt | apps

    def normalize_configuration(self, configuration: dict | None) -> dict:
        return KeycloakConfig.from_dict(configuration).model_dump()

    def apply_network_hints(self, configuration: dict, attachment_ips: list[str]) -> dict:
        cfg = KeycloakConfig.from_dict(configuration)
        data = cfg.model_dump()
        if not cfg.hostname and attachment_ips:
            data["hostname"] = attachment_ips[0]
        return KeycloakConfig.from_dict(data).model_dump()

    def render(self, configuration: dict) -> str:
        cfg = KeycloakConfig.from_dict(configuration)
        lines = [
            f"realm={cfg.realm}",
            f"hostname={cfg.hostname or ''}",
            f"http_port={cfg.http_port}",
            f"start_mode={cfg.start_mode}",
            f"import_realm={cfg.import_realm}",
        ]
        return "\n".join(lines) + "\n"

    def render_files(self, configuration: dict) -> dict[str, str]:
        cfg = KeycloakConfig.from_dict(configuration)
        files = {
            "README.txt": (
                "Keycloak data directory managed by AxioNet.\n"
                "Realm import (if enabled) lives under import/.\n"
            ),
        }
        if cfg.import_realm:
            # Keycloak only imports files named *-realm.json
            files[f"import/{cfg.realm}-realm.json"] = render_realm_json(cfg, role=self.role)
        return files

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
            KeycloakConfig.from_dict(configuration)
        except Exception as exc:  # noqa: BLE001 — surface schema errors to API
            return ValidationResult(ok=False, output=str(exc))
        return ValidationResult(ok=True, output="keycloak configuration ok")

    def container_spec(self, configuration: dict | None = None) -> ContainerSpec:
        cfg = KeycloakConfig.from_dict(configuration)
        command = ["start-dev"]
        if cfg.import_realm:
            command.append("--import-realm")
        env: dict[str, str] = {
            "KC_BOOTSTRAP_ADMIN_USERNAME": cfg.admin_username,
            "KC_BOOTSTRAP_ADMIN_PASSWORD": cfg.admin_password,
            "KC_HTTP_ENABLED": "true",
            "KC_HTTP_PORT": str(cfg.http_port),
            "KC_HOSTNAME_STRICT": "true" if cfg.hostname_strict else "false",
            "KC_HEALTH_ENABLED": "true",
        }
        if cfg.hostname:
            env["KC_HOSTNAME"] = cfg.hostname
            env["KC_HOSTNAME_PORT"] = str(cfg.http_port)
        return ContainerSpec(
            config_bind="/opt/keycloak/data",
            volume_mode="rw",
            command=command,
            environment=env,
        )

    def reload_signal(self) -> str | None:
        return None


def overview_payload(
    *,
    instance_id: str,
    service_type: str,
    configuration: dict[str, Any],
    attachment_ips: list[str],
) -> dict[str, Any]:
    from app.plugins.keycloak.realm import admin_console_url, issuer_url

    cfg = KeycloakConfig.from_dict(configuration)
    if not cfg.hostname and attachment_ips:
        cfg = KeycloakConfig.from_dict({**cfg.model_dump(), "hostname": attachment_ips[0]})
    return {
        "instance_id": instance_id,
        "service_type": service_type,
        "realm": cfg.realm,
        "http_port": cfg.http_port,
        "hostname": cfg.hostname,
        "issuer_url": issuer_url(cfg),
        "admin_console_url": admin_console_url(cfg),
        "gui_client_id": cfg.gui_client_id,
        "app_client_id": cfg.app_client_id,
        "attachment_ips": attachment_ips,
    }
