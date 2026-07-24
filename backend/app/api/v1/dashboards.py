from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.dashboards import (
    DashboardCreate,
    DashboardRead,
    DashboardUpdate,
    DashboardWidget,
    DashboardWidgetCreate,
)
from app.services.dashboards.service import DashboardService

router = APIRouter(prefix="/dashboards", tags=["dashboards"])


def get_dashboard_service(db: Session = Depends(get_db)) -> DashboardService:
    return DashboardService(db=db)


def _to_read(dashboard) -> DashboardRead:
    widgets = [DashboardWidget.model_validate(item) for item in (dashboard.widgets or [])]
    return DashboardRead(
        id=dashboard.id,
        name=dashboard.name,
        description=dashboard.description,
        widgets=widgets,
        created_at=dashboard.created_at,
        updated_at=dashboard.updated_at,
    )


@router.get("", response_model=list[DashboardRead])
def list_dashboards(service: DashboardService = Depends(get_dashboard_service)) -> list[DashboardRead]:
    return [_to_read(item) for item in service.list_dashboards()]


@router.post("", response_model=DashboardRead, status_code=status.HTTP_201_CREATED)
def create_dashboard(
    payload: DashboardCreate,
    service: DashboardService = Depends(get_dashboard_service),
) -> DashboardRead:
    try:
        dashboard = service.create_dashboard(payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return _to_read(dashboard)


@router.get("/{dashboard_id}", response_model=DashboardRead)
def get_dashboard(
    dashboard_id: str,
    service: DashboardService = Depends(get_dashboard_service),
) -> DashboardRead:
    dashboard = service.get_dashboard(dashboard_id)
    if dashboard is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dashboard not found")
    return _to_read(dashboard)


@router.patch("/{dashboard_id}", response_model=DashboardRead)
def update_dashboard(
    dashboard_id: str,
    payload: DashboardUpdate,
    service: DashboardService = Depends(get_dashboard_service),
) -> DashboardRead:
    dashboard = service.get_dashboard(dashboard_id)
    if dashboard is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dashboard not found")
    try:
        updated = service.update_dashboard(dashboard, payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return _to_read(updated)


@router.delete("/{dashboard_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_dashboard(
    dashboard_id: str,
    service: DashboardService = Depends(get_dashboard_service),
) -> Response:
    dashboard = service.get_dashboard(dashboard_id)
    if dashboard is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dashboard not found")
    service.delete_dashboard(dashboard)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{dashboard_id}/widgets", response_model=DashboardRead, status_code=status.HTTP_201_CREATED)
def append_widget(
    dashboard_id: str,
    payload: DashboardWidgetCreate,
    service: DashboardService = Depends(get_dashboard_service),
) -> DashboardRead:
    dashboard = service.get_dashboard(dashboard_id)
    if dashboard is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dashboard not found")
    updated = service.append_widget(dashboard, payload)
    return _to_read(updated)
