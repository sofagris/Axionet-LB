AUTH_GATEWAY_SERVICE = {
    "service_type": "auth-gateway",
    "display_name": "Auth Gateway",
    "description": "OIDC reverse proxy (oauth2-proxy) in front of legacy apps",
    "container_image": "quay.io/oauth2-proxy/oauth2-proxy",
    "default_version": "v7.8.1",
    "enabled": True,
    "supported_actions": ["start", "stop", "restart", "validate", "reconcile", "logs"],
}
