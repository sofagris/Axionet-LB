"""Service catalog: enabled plugins plus stub definitions for future services."""

from __future__ import annotations

from app.app_packages.loader import list_loaded_packages
from app.plugins.auth_gateway.definition import AUTH_GATEWAY_SERVICE
from app.plugins.frr.definition import FRR_SERVICE
from app.plugins.generic.plugin import definition_from_package
from app.plugins.haproxy.definition import HAPROXY_SERVICE
from app.plugins.keycloak.definition import KEYCLOAK_APPS_SERVICE, KEYCLOAK_MGMT_SERVICE
from app.plugins.varnish.definition import VARNISH_SERVICE

STUB_SERVICES: list[dict] = [
    {
        "service_type": "nginx",
        "display_name": "Nginx",
        "description": "Web server / reverse proxy (kommer snart)",
        "container_image": "nginx",
        "default_version": "1.27",
        "enabled": False,
        "supported_actions": [],
    },
    {
        "service_type": "prometheus",
        "display_name": "Prometheus",
        "description": "Metrics collection (kommer snart)",
        "container_image": "prom/prometheus",
        "default_version": "3.2",
        "enabled": False,
        "supported_actions": [],
    },
    {
        "service_type": "grafana",
        "display_name": "Grafana",
        "description": "Dashboards and visualization (kommer snart)",
        "container_image": "grafana/grafana",
        "default_version": "11.5",
        "enabled": False,
        "supported_actions": [],
    },
]


def _builtin_definitions() -> list[dict]:
    return [
        HAPROXY_SERVICE,
        FRR_SERVICE,
        KEYCLOAK_MGMT_SERVICE,
        KEYCLOAK_APPS_SERVICE,
        AUTH_GATEWAY_SERVICE,
        VARNISH_SERVICE,
        *STUB_SERVICES,
    ]


def list_service_definitions() -> list[dict]:
    builtins = _builtin_definitions()
    by_type = {item["service_type"]: item for item in builtins}
    # Overlay / add package-driven definitions when runtime is declared and no builtin exists,
    # or when builtin is a disabled stub. Named enabled builtins always win.
    for package in list_loaded_packages(include_reference=False):
        runtime = package.root.get("runtime")
        if not isinstance(runtime, dict):
            continue
        existing = by_type.get(package.service_type)
        if existing is not None and existing.get("enabled"):
            continue
        by_type[package.service_type] = definition_from_package(package)
    # Preserve builtin order, then append remaining package-only types.
    ordered: list[dict] = []
    seen: set[str] = set()
    for item in builtins:
        st = item["service_type"]
        ordered.append(by_type[st])
        seen.add(st)
    for st, item in by_type.items():
        if st not in seen:
            ordered.append(item)
    return ordered


def get_service_definition(service_type: str) -> dict | None:
    for item in list_service_definitions():
        if item["service_type"] == service_type:
            return item
    return None
