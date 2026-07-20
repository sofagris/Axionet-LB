from __future__ import annotations

from app.plugins.haproxy.plugin import HaproxyPlugin
from app.plugins.frr.plugin import FrrPlugin
from app.plugins.base import ServicePlugin

_PLUGINS: dict[str, ServicePlugin] = {
    HaproxyPlugin.service_type: HaproxyPlugin(),
    FrrPlugin.service_type: FrrPlugin(),
}


def get_plugin(service_type: str) -> ServicePlugin:
    plugin = _PLUGINS.get(service_type)
    if plugin is None:
        raise ValueError(f"Unsupported service_type={service_type}")
    return plugin


def list_enabled_service_types() -> list[str]:
    return list(_PLUGINS.keys())
