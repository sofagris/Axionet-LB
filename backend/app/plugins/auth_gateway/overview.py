from __future__ import annotations

from typing import Any

from app.plugins.auth_gateway.schemas import AuthGatewayConfig


def overview_payload(
    *,
    instance_id: str,
    configuration: dict[str, Any],
    attachment_ips: list[str],
) -> dict[str, Any]:
    cfg = AuthGatewayConfig.from_dict(configuration)
    listen_ip = attachment_ips[0] if attachment_ips else None
    listen_url = f"http://{listen_ip}:{cfg.http_port}/" if listen_ip else None
    redirect = cfg.redirect_url
    if not redirect and listen_ip:
        redirect = f"http://{listen_ip}:{cfg.http_port}/oauth2/callback"
    return {
        "instance_id": instance_id,
        "service_type": "auth-gateway",
        "upstream_url": cfg.upstream_url,
        "oidc_issuer_url": cfg.oidc_issuer_url,
        "client_id": cfg.client_id,
        "http_port": cfg.http_port,
        "redirect_url": redirect,
        "listen_url": listen_url,
        "attachment_ips": attachment_ips,
        "pass_user_headers": cfg.pass_user_headers,
    }
