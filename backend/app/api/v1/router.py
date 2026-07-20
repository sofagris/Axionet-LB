from fastapi import APIRouter, Depends

from app.api.v1 import (
    auth,
    haproxy,
    instances,
    interfaces,
    networks,
    revisions,
    service_definitions,
    system,
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
