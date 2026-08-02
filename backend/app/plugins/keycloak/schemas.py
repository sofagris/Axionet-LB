from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


class KeycloakConfig(BaseModel):
    """Shared configuration for keycloak-mgmt and keycloak-apps instances."""

    realm: str = "axionet"
    http_port: int = Field(default=8080, ge=1, le=65535)
    hostname: str | None = None
    hostname_strict: bool = False
    admin_username: str = "admin"
    admin_password: str = "admin"
    gui_client_id: str = "axionet-gui"
    gui_client_secret: str = "axionet-gui-lab-secret"
    app_client_id: str = "axionet-app"
    app_client_secret: str = "axionet-app-lab-secret"
    import_realm: bool = True
    start_mode: Literal["dev"] = "dev"
    public_base_url: str | None = None

    @classmethod
    def from_dict(cls, data: dict[str, Any] | None) -> KeycloakConfig:
        if not data:
            return cls()
        return cls.model_validate(data)
