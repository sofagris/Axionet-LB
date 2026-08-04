VARNISH_SERVICE = {
    "service_type": "varnish",
    "display_name": "Varnish",
    "description": "HTTP cache / reverse proxy",
    "container_image": "varnish",
    "default_version": "7.6",
    "enabled": True,
    "supported_actions": ["start", "stop", "restart", "validate", "reconcile", "logs"],
}
