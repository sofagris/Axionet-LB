from __future__ import annotations

from app.plugins.auth_gateway.plugin import AuthGatewayPlugin
from app.plugins.base import ServicePlugin
from app.plugins.frr.plugin import FrrPlugin
from app.plugins.generic.plugin import GenericPackagePlugin, package_for_service_type
from app.plugins.haproxy.plugin import HaproxyPlugin
from app.plugins.keycloak.plugin import KeycloakAppsPlugin, KeycloakMgmtPlugin
from app.plugins.varnish.plugin import VarnishPlugin

_PLUGINS: dict[str, ServicePlugin] = {
    HaproxyPlugin.service_type: HaproxyPlugin(),
    FrrPlugin.service_type: FrrPlugin(),
    KeycloakMgmtPlugin.service_type: KeycloakMgmtPlugin(),
    KeycloakAppsPlugin.service_type: KeycloakAppsPlugin(),
    AuthGatewayPlugin.service_type: AuthGatewayPlugin(),
    VarnishPlugin.service_type: VarnishPlugin(),
}


def get_plugin(service_type: str) -> ServicePlugin:
    plugin = _PLUGINS.get(service_type)
    if plugin is not None:
        return plugin
    if package_for_service_type(service_type) is not None:
        return GenericPackagePlugin(service_type)
    raise ValueError(f"Unsupported service_type={service_type}")


def list_enabled_service_types() -> list[str]:
    types = set(_PLUGINS.keys())
    from app.app_packages.loader import list_loaded_packages

    for package in list_loaded_packages(include_reference=False):
        if isinstance(package.root.get("runtime"), dict):
            types.add(package.service_type)
    return list(types)
