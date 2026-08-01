from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

AuthSourceKind = Literal["local", "oidc"]
AppIdPKind = Literal["oidc", "saml"]


class AuthSourceRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    kind: AuthSourceKind
    enabled: bool
    description: str
    issuer_url: str | None = None
    client_id: str | None = None
    has_client_secret: bool = False
    scopes: str
    claim_username: str
    claim_groups: str
    created_at: datetime
    updated_at: datetime


class AuthSourceCreate(BaseModel):
    name: str = Field(min_length=1, max_length=64)
    kind: AuthSourceKind = "oidc"
    enabled: bool = True
    description: str = Field(default="", max_length=512)
    issuer_url: str | None = Field(default=None, max_length=512)
    client_id: str | None = Field(default=None, max_length=256)
    client_secret: str | None = Field(default=None, max_length=512)
    scopes: str = Field(default="openid profile email", max_length=256)
    claim_username: str = Field(default="preferred_username", max_length=64)
    claim_groups: str = Field(default="groups", max_length=64)


class AuthSourceUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=64)
    enabled: bool | None = None
    description: str | None = Field(default=None, max_length=512)
    issuer_url: str | None = Field(default=None, max_length=512)
    client_id: str | None = Field(default=None, max_length=256)
    client_secret: str | None = Field(default=None, max_length=512)
    scopes: str | None = Field(default=None, max_length=256)
    claim_username: str | None = Field(default=None, max_length=64)
    claim_groups: str | None = Field(default=None, max_length=64)


class UpnSuffixRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    suffix: str
    auth_source_id: str
    auth_source_name: str = ""
    auth_source_kind: str = ""
    created_at: datetime
    updated_at: datetime


class UpnSuffixCreate(BaseModel):
    suffix: str = Field(min_length=1, max_length=255)
    auth_source_id: str


class UpnSuffixUpdate(BaseModel):
    auth_source_id: str | None = None


class AppIdentityProviderRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    kind: AppIdPKind
    enabled: bool
    customer_id: str | None = None
    config: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime
    updated_at: datetime


class AppIdentityProviderCreate(BaseModel):
    name: str = Field(min_length=1, max_length=128)
    kind: AppIdPKind = "oidc"
    enabled: bool = True
    customer_id: str | None = Field(default=None, max_length=64)
    config: dict[str, Any] = Field(default_factory=dict)


class AppIdentityProviderUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=128)
    kind: AppIdPKind | None = None
    enabled: bool | None = None
    customer_id: str | None = Field(default=None, max_length=64)
    config: dict[str, Any] | None = None


class LoginOptionsSuffix(BaseModel):
    suffix: str
    auth_source_id: str
    auth_source_name: str
    kind: AuthSourceKind
    sso: bool


class LoginOptionsResponse(BaseModel):
    local_suffix: str
    suffixes: list[LoginOptionsSuffix]
