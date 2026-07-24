from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.dashboard import Dashboard
from app.schemas.dashboards import (
    DashboardCreate,
    DashboardUpdate,
    DashboardWidget,
    DashboardWidgetCreate,
)


class DashboardService:
    def __init__(self, db: Session) -> None:
        self._db = db

    def list_dashboards(self) -> list[Dashboard]:
        return list(
            self._db.scalars(select(Dashboard).order_by(Dashboard.name.asc())).all()
        )

    def get_dashboard(self, dashboard_id: str) -> Dashboard | None:
        return self._db.get(Dashboard, dashboard_id)

    def create_dashboard(self, payload: DashboardCreate) -> Dashboard:
        existing = self._db.scalar(select(Dashboard).where(Dashboard.name == payload.name))
        if existing is not None:
            raise ValueError(f"Dashboard name already exists: {payload.name}")

        dashboard = Dashboard(
            name=payload.name.strip(),
            description=payload.description,
            widgets=[],
        )
        self._db.add(dashboard)
        self._db.commit()
        self._db.refresh(dashboard)
        return dashboard

    def update_dashboard(self, dashboard: Dashboard, payload: DashboardUpdate) -> Dashboard:
        data = payload.model_dump(exclude_unset=True)
        if "name" in data and data["name"] is not None:
            name = data["name"].strip()
            clash = self._db.scalar(
                select(Dashboard).where(Dashboard.name == name, Dashboard.id != dashboard.id)
            )
            if clash is not None:
                raise ValueError(f"Dashboard name already exists: {name}")
            dashboard.name = name
        if "description" in data:
            dashboard.description = data["description"]
        if "widgets" in data and data["widgets"] is not None:
            widgets = [DashboardWidget.model_validate(item) for item in data["widgets"]]
            dashboard.widgets = [item.model_dump(mode="json") for item in widgets]
        dashboard.updated_at = datetime.now(UTC)
        self._db.add(dashboard)
        self._db.commit()
        self._db.refresh(dashboard)
        return dashboard

    def delete_dashboard(self, dashboard: Dashboard) -> None:
        self._db.delete(dashboard)
        self._db.commit()

    def append_widget(
        self,
        dashboard: Dashboard,
        payload: DashboardWidgetCreate,
    ) -> Dashboard:
        widget = DashboardWidget(
            id=str(uuid.uuid4()),
            type=payload.type,
            config=payload.config,
        )
        widgets = list(dashboard.widgets or [])
        widgets.append(widget.model_dump(mode="json"))
        dashboard.widgets = widgets
        dashboard.updated_at = datetime.now(UTC)
        self._db.add(dashboard)
        self._db.commit()
        self._db.refresh(dashboard)
        return dashboard
