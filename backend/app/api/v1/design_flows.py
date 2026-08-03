from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.design_flows import DesignFlowCreate, DesignFlowRead, DesignFlowUpdate
from app.services.design_flows.service import DesignFlowService

router = APIRouter(prefix="/design-flows", tags=["design-flows"])


def get_design_flow_service(db: Session = Depends(get_db)) -> DesignFlowService:
    return DesignFlowService(db=db)


def _actor(request: Request) -> str | None:
    user = getattr(request.state, "user", None)
    if user is None:
        return None
    return getattr(user, "username", None) or getattr(user, "id", None)


@router.get("", response_model=list[DesignFlowRead])
def list_design_flows(
    service: DesignFlowService = Depends(get_design_flow_service),
) -> list[DesignFlowRead]:
    return [DesignFlowRead.model_validate(item) for item in service.list_flows()]


@router.post("", response_model=DesignFlowRead, status_code=status.HTTP_201_CREATED)
def create_design_flow(
    payload: DesignFlowCreate,
    request: Request,
    service: DesignFlowService = Depends(get_design_flow_service),
) -> DesignFlowRead:
    try:
        flow = service.create_flow(payload, created_by=_actor(request))
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return DesignFlowRead.model_validate(flow)


@router.get("/{flow_id}", response_model=DesignFlowRead)
def get_design_flow(
    flow_id: str,
    service: DesignFlowService = Depends(get_design_flow_service),
) -> DesignFlowRead:
    flow = service.get_flow(flow_id)
    if flow is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Design flow not found")
    return DesignFlowRead.model_validate(flow)


@router.patch("/{flow_id}", response_model=DesignFlowRead)
def update_design_flow(
    flow_id: str,
    payload: DesignFlowUpdate,
    service: DesignFlowService = Depends(get_design_flow_service),
) -> DesignFlowRead:
    flow = service.get_flow(flow_id)
    if flow is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Design flow not found")
    try:
        updated = service.update_flow(flow, payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return DesignFlowRead.model_validate(updated)


@router.delete("/{flow_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_design_flow(
    flow_id: str,
    service: DesignFlowService = Depends(get_design_flow_service),
) -> Response:
    flow = service.get_flow(flow_id)
    if flow is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Design flow not found")
    service.delete_flow(flow)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
