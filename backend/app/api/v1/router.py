from fastapi import APIRouter

from app.api.v1 import interfaces, networks, system

api_router = APIRouter()
api_router.include_router(system.router)
api_router.include_router(interfaces.router)
api_router.include_router(networks.router)
