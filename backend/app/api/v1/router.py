from fastapi import APIRouter

from app.api.v1 import interfaces, system

api_router = APIRouter()
api_router.include_router(system.router)
api_router.include_router(interfaces.router)
