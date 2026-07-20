FRR_SERVICE = {
    "service_type": "frr",
    "display_name": "FRR",
    "description": "Routing stack for BGP peering and prefix advertisement",
    "container_image": "quay.io/frrouting/frr",
    "default_version": "10.2.6",
    "enabled": True,
    "supported_actions": [
        "start",
        "stop",
        "restart",
        "reload",
        "validate",
        "reconcile",
        "logs",
    ],
}
