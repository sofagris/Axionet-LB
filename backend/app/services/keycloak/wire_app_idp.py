from __future__ import annotations

from sqlalchemy.orm import Session

from app.models.network_attachment import NetworkAttachment
from app.models.service_instance import ServiceInstance
from app.plugins.keycloak.schemas import KeycloakConfig
from app.schemas.auth_sources import (
    AppIdentityProviderCreate,
    AppIdentityProviderUpdate,
    AppIdpBindingCreate,
)
from app.services.auth_sources.service import AuthSourceError, AuthSourceService
from app.services.keycloak.wire_oidc import KeycloakWireError


def wire_app_idp(
    db: Session,
    instance: ServiceInstance,
    attachments: list[NetworkAttachment],
    *,
    idp_name: str = "Keycloak Apps",
    customer_id: str | None = None,
    application_id: str | None = None,
) -> dict:
    if instance.service_type != "keycloak-apps":
        raise KeycloakWireError("Only keycloak-apps can wire App IdP metadata")

    cfg = KeycloakConfig.from_dict(instance.configuration)
    ips = [item.ip_address for item in attachments if item.ip_address]
    hostname = cfg.hostname or (ips[0] if ips else None)
    if not hostname:
        raise KeycloakWireError("Instance has no hostname or attachment IP for issuer URL")

    issuer = f"http://{hostname}:{cfg.http_port}/realms/{cfg.realm}"
    auth = AuthSourceService(db)
    config = {
        "issuer_url": issuer,
        "client_id": cfg.app_client_id,
        "client_secret": cfg.app_client_secret,
        "scopes": "openid profile email",
    }

    existing = next((row for row in auth.list_app_idps() if row.name == idp_name), None)
    try:
        if existing is None:
            provider = auth.create_app_idp(
                AppIdentityProviderCreate(
                    name=idp_name,
                    kind="oidc",
                    enabled=True,
                    customer_id=customer_id,
                    config=config,
                )
            )
        else:
            provider = auth.update_app_idp(
                existing,
                AppIdentityProviderUpdate(
                    enabled=True,
                    customer_id=customer_id if customer_id is not None else existing.customer_id,
                    config=config,
                ),
            )
    except AuthSourceError as exc:
        raise KeycloakWireError(str(exc)) from exc

    binding_id: str | None = None
    if customer_id:
        try:
            # Replace existing binding for this customer/app if present
            for row in auth.list_bindings(customer_id=customer_id, application_id=application_id or ""):
                if row.app_identity_provider_id != provider.id:
                    auth.delete_binding(row)
            matches = auth.list_bindings(
                customer_id=customer_id,
                application_id=application_id or "",
            )
            if not any(row.app_identity_provider_id == provider.id for row in matches):
                binding = auth.create_binding(
                    AppIdpBindingCreate(
                        app_identity_provider_id=provider.id,
                        customer_id=customer_id,
                        application_id=application_id,
                    )
                )
                binding_id = binding.id
            else:
                binding_id = next(
                    row.id for row in matches if row.app_identity_provider_id == provider.id
                )
        except AuthSourceError as exc:
            raise KeycloakWireError(str(exc)) from exc

    return {
        "app_identity_provider_id": provider.id,
        "app_identity_provider_name": provider.name,
        "issuer_url": issuer,
        "app_client_id": cfg.app_client_id,
        "customer_id": customer_id,
        "application_id": application_id,
        "binding_id": binding_id,
    }
