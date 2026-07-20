from fastapi import APIRouter, HTTPException, status

from app.plugins.haproxy.definition import get_service_definition, list_service_definitions
from app.schemas.instances import ServiceDefinitionRead

router = APIRouter(prefix="/service-definitions", tags=["service-definitions"])


@router.get("", response_model=list[ServiceDefinitionRead])
def list_definitions() -> list[ServiceDefinitionRead]:
    return [ServiceDefinitionRead.model_validate(item) for item in list_service_definitions()]


@router.get("/{service_type}", response_model=ServiceDefinitionRead)
def get_definition(service_type: str) -> ServiceDefinitionRead:
    item = get_service_definition(service_type)
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Service definition not found")
    return ServiceDefinitionRead.model_validate(item)
