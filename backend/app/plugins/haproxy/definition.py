HAPROXY_SERVICE = {
    "service_type": "haproxy",
    "display_name": "HAProxy",
    "description": "TCP/HTTP load balancer with master-worker mode",
    "container_image": "haproxy",
    "default_version": "3.2.6",
    "enabled": True,
    "supported_actions": ["start", "stop", "restart", "reload", "validate", "reconcile", "logs"],
}


def list_service_definitions() -> list[dict]:
    return [HAPROXY_SERVICE]


def get_service_definition(service_type: str) -> dict | None:
    if service_type == "haproxy":
        return HAPROXY_SERVICE
    return None
