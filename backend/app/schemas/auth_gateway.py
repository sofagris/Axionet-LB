from __future__ import annotations

from pydantic import BaseModel, Field


class AuthGatewayOverview(BaseModel):
    instance_id: str
    service_type: str
    upstream_url: str
    oidc_issuer_url: str
    client_id: str
    http_port: int
    redirect_url: str | None = None
    listen_url: str | None = None
    attachment_ips: list[str] = Field(default_factory=list)
    pass_user_headers: bool = True
