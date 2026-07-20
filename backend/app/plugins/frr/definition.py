FRR_SERVICE = {
    "service_type": "frr",
    "display_name": "FRR",
    "description": "Routing stack for BGP peering and prefix advertisement",
    "container_image": "frrouting/frr",
    "default_version": "v10.2.1",
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
