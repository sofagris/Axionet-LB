from __future__ import annotations

from pydantic import BaseModel, Field


class KeycloakOverview(BaseModel):
    instance_id: str
    service_type: str
    realm: str
    http_port: int
    hostname: str | None = None
    issuer_url: str | None = None
    admin_console_url: str | None = None
    gui_client_id: str
    app_client_id: str
    attachment_ips: list[str] = Field(default_factory=list)


class KeycloakWireOidcRequest(BaseModel):
    source_name: str = Field(default="Keycloak Management", min_length=1, max_length=64)
    upn_suffix: str = Field(default="lab.local", min_length=1, max_length=255)


class KeycloakWireOidcResponse(BaseModel):
    auth_source_id: str
    auth_source_name: str
    issuer_url: str
    upn_suffix: str
    gui_client_id: str


class KeycloakWireAppIdpRequest(BaseModel):
    idp_name: str = Field(default="Keycloak Apps", min_length=1, max_length=128)
    customer_id: str | None = Field(default=None, max_length=64)
    application_id: str | None = Field(default=None, max_length=64)


class KeycloakWireAppIdpResponse(BaseModel):
    app_identity_provider_id: str
    app_identity_provider_name: str
    issuer_url: str
    app_client_id: str
    customer_id: str | None = None
    application_id: str | None = None
    binding_id: str | None = None
