from __future__ import annotations

from app.plugins.keycloak.common import KeycloakPluginBase


class KeycloakMgmtPlugin(KeycloakPluginBase):
    service_type = "keycloak-mgmt"
    role = "mgmt"


class KeycloakAppsPlugin(KeycloakPluginBase):
    service_type = "keycloak-apps"
    role = "apps"
