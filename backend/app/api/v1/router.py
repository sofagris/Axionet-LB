from fastapi import APIRouter, Depends

from app.api.v1 import (
    app_idp_bindings,
    auth,
    auth_gateway,
    auth_sources,
    dashboards,
    design_flows,
    frr,
    groups,
    haproxy,
    instances,
    interfaces,
    keycloak,
    networks,
    revisions,
    service_definitions,
    system,
    users,
    vips,
)
from app.core.rbac import enforce_mutation_rbac
from app.core.security import enforce_auth

api_router = APIRouter(dependencies=[Depends(enforce_auth), Depends(enforce_mutation_rbac)])
api_router.include_router(auth.router)
api_router.include_router(auth_sources.router)
api_router.include_router(app_idp_bindings.router)
api_router.include_router(system.router)
api_router.include_router(interfaces.router)
api_router.include_router(networks.router)
api_router.include_router(service_definitions.router)
api_router.include_router(instances.router)
api_router.include_router(revisions.router)
api_router.include_router(haproxy.router)
api_router.include_router(frr.router)
api_router.include_router(keycloak.router)
api_router.include_router(auth_gateway.router)
api_router.include_router(vips.router)
api_router.include_router(dashboards.router)
api_router.include_router(design_flows.router)
api_router.include_router(users.router)
api_router.include_router(groups.router)
