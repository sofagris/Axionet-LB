from __future__ import annotations

import json
from typing import Any

from app.plugins.keycloak.schemas import KeycloakConfig


def _redirect_bases(cfg: KeycloakConfig) -> list[str]:
    bases: list[str] = []
    if cfg.public_base_url:
        bases.append(cfg.public_base_url.rstrip("/"))
    if cfg.hostname:
        bases.append(f"http://{cfg.hostname}")
    bases.extend(["http://127.0.0.1", "http://localhost"])
    # Preserve unique order
    seen: set[str] = set()
    out: list[str] = []
    for item in bases:
        if item not in seen:
            seen.add(item)
            out.append(item)
    return out


def build_mgmt_realm(cfg: KeycloakConfig) -> dict[str, Any]:
    bases = _redirect_bases(cfg)
    redirect_uris = [f"{base}/api/v1/auth/oidc/callback" for base in bases]
    web_origins = [*bases, "+"]
    return {
        "realm": cfg.realm,
        "enabled": True,
        "displayName": "AxioNet Management",
        "registrationAllowed": False,
        "loginWithEmailAllowed": True,
        "duplicateEmailsAllowed": False,
        "resetPasswordAllowed": False,
        "editUsernameAllowed": False,
        "sslRequired": "none",
        "groups": [{"name": "operators", "path": "/operators"}],
        "clients": [
            {
                "clientId": cfg.gui_client_id,
                "name": "AxioNet LB management GUI",
                "enabled": True,
                "protocol": "openid-connect",
                "publicClient": False,
                "secret": cfg.gui_client_secret,
                "clientAuthenticatorType": "client-secret",
                "standardFlowEnabled": True,
                "directAccessGrantsEnabled": True,
                "serviceAccountsEnabled": False,
                "redirectUris": redirect_uris,
                "webOrigins": web_origins,
                "attributes": {"post.logout.redirect.uris": "+"},
                "protocolMappers": [
                    {
                        "name": "groups",
                        "protocol": "openid-connect",
                        "protocolMapper": "oidc-group-membership-mapper",
                        "consentRequired": False,
                        "config": {
                            "full.path": "false",
                            "id.token.claim": "true",
                            "access.token.claim": "true",
                            "claim.name": "groups",
                            "userinfo.token.claim": "true",
                        },
                    }
                ],
            },
            {
                "clientId": cfg.app_client_id,
                "name": "AxioNet App IdP (metadata)",
                "enabled": True,
                "protocol": "openid-connect",
                "publicClient": False,
                "secret": cfg.app_client_secret,
                "clientAuthenticatorType": "client-secret",
                "standardFlowEnabled": True,
                "directAccessGrantsEnabled": False,
                "redirectUris": ["*"],
                "webOrigins": ["*"],
            },
        ],
        "users": [
            {
                "username": "labuser",
                "enabled": True,
                "emailVerified": True,
                "firstName": "Lab",
                "lastName": "User",
                "email": "labuser@lab.local",
                "credentials": [
                    {"type": "password", "value": "LabPass1!", "temporary": False},
                ],
                "groups": ["/operators"],
            }
        ],
    }


def build_apps_realm(cfg: KeycloakConfig) -> dict[str, Any]:
    bases = _redirect_bases(cfg)
    # oauth2-proxy / auth-gateway callback paths on gateway hostnames
    gateway_callbacks = [f"{base}/oauth2/callback" for base in bases]
    redirect_uris = ["*", *gateway_callbacks]
    return {
        "realm": cfg.realm,
        "enabled": True,
        "displayName": f"AxioNet Apps ({cfg.realm})",
        "registrationAllowed": False,
        "loginWithEmailAllowed": True,
        "duplicateEmailsAllowed": False,
        "resetPasswordAllowed": False,
        "editUsernameAllowed": False,
        "sslRequired": "none",
        "groups": [{"name": "appusers", "path": "/appusers"}],
        "clients": [
            {
                "clientId": cfg.app_client_id,
                "name": "AxioNet application / auth-gateway client",
                "enabled": True,
                "protocol": "openid-connect",
                "publicClient": False,
                "secret": cfg.app_client_secret,
                "clientAuthenticatorType": "client-secret",
                "standardFlowEnabled": True,
                "directAccessGrantsEnabled": False,
                "redirectUris": redirect_uris,
                "webOrigins": ["*", *bases],
                "attributes": {"post.logout.redirect.uris": "+"},
                "protocolMappers": [
                    {
                        "name": "groups",
                        "protocol": "openid-connect",
                        "protocolMapper": "oidc-group-membership-mapper",
                        "consentRequired": False,
                        "config": {
                            "full.path": "false",
                            "id.token.claim": "true",
                            "access.token.claim": "true",
                            "claim.name": "groups",
                            "userinfo.token.claim": "true",
                        },
                    }
                ],
            }
        ],
        "users": [
            {
                "username": "appuser",
                "enabled": True,
                "emailVerified": True,
                "firstName": "App",
                "lastName": "User",
                "email": "appuser@lab.local",
                "credentials": [
                    {"type": "password", "value": "AppPass1!", "temporary": False},
                ],
                "groups": ["/appusers"],
            }
        ],
    }


def render_realm_json(cfg: KeycloakConfig, *, role: str) -> str:
    payload = build_mgmt_realm(cfg) if role == "mgmt" else build_apps_realm(cfg)
    # Keycloak import requires filename *-realm.json
    return json.dumps(payload, indent=2) + "\n"


def issuer_url(cfg: KeycloakConfig) -> str | None:
    if not cfg.hostname:
        return None
    return f"http://{cfg.hostname}:{cfg.http_port}/realms/{cfg.realm}"


def admin_console_url(cfg: KeycloakConfig) -> str | None:
    if not cfg.hostname:
        return None
    return f"http://{cfg.hostname}:{cfg.http_port}/"
