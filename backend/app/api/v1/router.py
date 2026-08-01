from fastapi import APIRouter, Depends

from app.api.v1 import (
    auth,
    dashboards,
    frr,
    groups,
    haproxy,
    instances,
    interfaces,
    networks,
    revisions,
    service_definitions,
    system,
    users,
    vips,
)
from app.core.security import enforce_auth

api_router = APIRouter(dependencies=[Depends(enforce_auth)])
api_router.include_router(auth.router)
api_router.include_router(system.router)
api_router.include_router(interfaces.router)
api_router.include_router(networks.router)
api_router.include_router(service_definitions.router)
api_router.include_router(instances.router)
api_router.include_router(revisions.router)
api_router.include_router(haproxy.router)
api_router.include_router(frr.router)
api_router.include_router(vips.router)
api_router.include_router(dashboards.router)
api_router.include_router(users.router)
api_router.include_router(groups.router)
