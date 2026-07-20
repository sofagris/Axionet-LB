"""Service catalog: enabled plugins plus stub definitions for future services."""

from __future__ import annotations

from app.plugins.frr.definition import FRR_SERVICE
from app.plugins.haproxy.definition import HAPROXY_SERVICE

STUB_SERVICES: list[dict] = [
    {
        "service_type": "varnish",
        "display_name": "Varnish",
        "description": "HTTP cache / reverse proxy (kommer snart)",
        "container_image": "varnish",
        "default_version": "7.6",
        "enabled": False,
        "supported_actions": [],
    },
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


def list_service_definitions() -> list[dict]:
    return [HAPROXY_SERVICE, FRR_SERVICE, *STUB_SERVICES]


def get_service_definition(service_type: str) -> dict | None:
    for item in list_service_definitions():
        if item["service_type"] == service_type:
            return item
    return None
