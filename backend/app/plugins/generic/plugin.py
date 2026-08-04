"""Generic ServicePlugin driven by axionet.app/v1 package runtime."""

from __future__ import annotations

import re
from typing import Any

from app.app_packages.loader import list_loaded_packages, resolve_package_paths
from app.plugins.base import ContainerSpec, ValidationResult
from app.services.docker.client import DockerClientAdapter

_PLACEHOLDER_RE = re.compile(r"\{([a-zA-Z0-9_.]+)\}")
_TEMPLATE_RE = re.compile(r"\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}")


def _resolve_path(configuration: dict[str, Any], dotted: str) -> str:
    current: Any = configuration
    for part in dotted.split("."):
        if not isinstance(current, dict) or part not in current:
            return ""
        current = current[part]
    if current is None:
        return ""
    return str(current)


def substitute_placeholders(template: str, configuration: dict[str, Any]) -> str:
    def repl(match: re.Match[str]) -> str:
        return _resolve_path(configuration, match.group(1))

    return _PLACEHOLDER_RE.sub(repl, template)


def substitute_template_file(content: str, configuration: dict[str, Any]) -> str:
    def repl(match: re.Match[str]) -> str:
        return _resolve_path(configuration, match.group(1))

    return _TEMPLATE_RE.sub(repl, content)


def package_for_service_type(service_type: str) -> Any | None:
    for package in list_loaded_packages(include_reference=False):
        if package.service_type == service_type and isinstance(package.root.get("runtime"), dict):
            return package
    return None


def definition_from_package(package: Any) -> dict[str, Any]:
    runtime = package.root.get("runtime") or {}
    caps = package.root.get("capabilities") or {}
    actions = list(caps.get("actions") or ["start", "stop", "restart", "validate", "reconcile", "logs"])
    return {
        "service_type": package.service_type,
        "display_name": str(package.catalog.get("name") or package.id),
        "description": str(package.catalog.get("summary") or ""),
        "container_image": str(runtime.get("image") or package.service_type),
        "default_version": str(runtime.get("defaultVersion") or "latest"),
        "enabled": True,
        "supported_actions": actions,
        "from_package": True,
    }


class GenericPackagePlugin:
    """One plugin instance bound to a service_type that has package runtime."""

    def __init__(self, service_type: str) -> None:
        self.service_type = service_type

    def _package(self) -> Any:
        package = package_for_service_type(self.service_type)
        if package is None:
            raise ValueError(f"No package runtime for service_type={self.service_type}")
        return package

    def _runtime(self) -> dict[str, Any]:
        runtime = self._package().root.get("runtime")
        if not isinstance(runtime, dict):
            raise ValueError("Package runtime missing")
        return runtime

    def normalize_configuration(self, configuration: dict | None) -> dict:
        package = self._package()
        data = dict(configuration or {})
        example = package.desired_state_example if isinstance(package.desired_state_example, dict) else {}
        for key, value in example.items():
            data.setdefault(key, value)
        return data

    def render(self, configuration: dict) -> str:
        files = self.render_files(configuration)
        if not files:
            return ""
        for name in ("default.vcl", "config.conf", "app.conf"):
            if name in files:
                return files[name]
        return next(iter(files.values()))

    def render_files(self, configuration: dict) -> dict[str, str]:
        package = self._package()
        paths = resolve_package_paths()
        package_dir = paths.root / package.directory_name
        templates_dir = package_dir / "config" / "templates"
        out: dict[str, str] = {}
        if templates_dir.is_dir():
            for path in sorted(templates_dir.rglob("*")):
                if not path.is_file():
                    continue
                rel = path.relative_to(templates_dir).as_posix()
                out_name = rel[:-9] if rel.endswith(".template") else rel
                text = path.read_text(encoding="utf-8")
                out[out_name] = substitute_template_file(text, configuration)
        if not out:
            out["README.txt"] = (
                f"Axionet generic package '{package.id}' ({package.service_type}).\n"
                "Add config/templates for rendered files.\n"
            )
        return out

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
            self._runtime()
            self.normalize_configuration(configuration)
        except Exception as exc:  # noqa: BLE001
            return ValidationResult(ok=False, output=str(exc))
        return ValidationResult(ok=True, output="generic package configuration ok")

    def container_spec(self, configuration: dict | None = None) -> ContainerSpec:
        runtime = self._runtime()
        cfg = self.normalize_configuration(configuration)
        entrypoint_raw = runtime.get("entrypoint")
        command_raw = runtime.get("command")
        entrypoint = (
            [substitute_placeholders(str(item), cfg) for item in entrypoint_raw]
            if isinstance(entrypoint_raw, list)
            else None
        )
        command = (
            [substitute_placeholders(str(item), cfg) for item in command_raw]
            if isinstance(command_raw, list)
            else None
        )
        volume_mode = str(runtime.get("volumeMode") or "ro")
        if volume_mode not in {"ro", "rw"}:
            volume_mode = "ro"
        return ContainerSpec(
            config_bind=str(runtime["configBind"]),
            volume_mode=volume_mode,
            entrypoint=entrypoint,
            command=command,
        )

    def reload_signal(self) -> str | None:
        return None
