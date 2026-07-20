HAPROXY_SERVICE = {
    "service_type": "haproxy",
    "display_name": "HAProxy",
    "description": "TCP/HTTP load balancer with master-worker mode",
    "container_image": "haproxy",
    "default_version": "3.2.6",
    "enabled": True,
    "supported_actions": ["start", "stop", "restart", "reload", "validate", "reconcile", "logs"],
}
