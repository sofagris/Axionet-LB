from fastapi import APIRouter

from app.api.v1 import instances, interfaces, networks, service_definitions, system

api_router = APIRouter()
api_router.include_router(system.router)
api_router.include_router(interfaces.router)
api_router.include_router(networks.router)
api_router.include_router(service_definitions.router)
api_router.include_router(instances.router)
