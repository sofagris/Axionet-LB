KEYCLOAK_MGMT_SERVICE = {
    "service_type": "keycloak-mgmt",
    "display_name": "Keycloak (Management)",
    "description": "OIDC IdP for AxioNet platform login (management network only)",
    "container_image": "quay.io/keycloak/keycloak",
    "default_version": "26.2.4",
    "enabled": True,
    "supported_actions": ["start", "stop", "restart", "validate", "reconcile", "logs"],
}

KEYCLOAK_APPS_SERVICE = {
    "service_type": "keycloak-apps",
    "display_name": "Keycloak (Apps)",
    "description": "OIDC IdP for customer applications (app / dataplane networks)",
    "container_image": "quay.io/keycloak/keycloak",
    "default_version": "26.2.4",
    "enabled": True,
    "supported_actions": ["start", "stop", "restart", "validate", "reconcile", "logs"],
}
