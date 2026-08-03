from __future__ import annotations

import base64
import secrets
from typing import Any

from pydantic import BaseModel, Field, field_validator


class AuthGatewayConfig(BaseModel):
    """Configuration for oauth2-proxy auth-gateway instances."""

    upstream_url: str = Field(default="http://127.0.0.1:8080", min_length=1)
    oidc_issuer_url: str = Field(default="", min_length=0)
    client_id: str = "axionet-app"
    client_secret: str = "axionet-app-lab-secret"
    cookie_secret: str | None = None
    redirect_url: str | None = None
    email_domains: str = "*"
    http_port: int = Field(default=4180, ge=1, le=65535)
    cookie_secure: bool = False
    pass_user_headers: bool = True
    set_xauthrequest: bool = True

    @field_validator("upstream_url", "oidc_issuer_url")
    @classmethod
    def strip_url(cls, value: str) -> str:
        return value.strip()

    @classmethod
    def from_dict(cls, data: dict[str, Any] | None) -> AuthGatewayConfig:
        if not data:
            return cls()
        return cls.model_validate(data)

    def ensure_cookie_secret(self) -> str:
        if self.cookie_secret and len(self.cookie_secret) >= 16:
            return self.cookie_secret
        # oauth2-proxy expects 16/24/32 raw bytes (commonly passed as base64).
        return base64.urlsafe_b64encode(secrets.token_bytes(16)).decode("ascii")
