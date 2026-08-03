from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.design_flow import DesignFlow
from app.schemas.design_flows import DesignFlowCreate, DesignFlowUpdate, empty_graph


class DesignFlowService:
    def __init__(self, db: Session) -> None:
        self._db = db

    def list_flows(self) -> list[DesignFlow]:
        return list(self._db.scalars(select(DesignFlow).order_by(DesignFlow.name.asc())).all())

    def get_flow(self, flow_id: str) -> DesignFlow | None:
        return self._db.get(DesignFlow, flow_id)

    def create_flow(self, payload: DesignFlowCreate, *, created_by: str | None = None) -> DesignFlow:
        existing = self._db.scalar(select(DesignFlow).where(DesignFlow.name == payload.name))
        if existing is not None:
            raise ValueError(f"Design flow name already exists: {payload.name}")

        flow = DesignFlow(
            name=payload.name.strip(),
            description=payload.description,
            graph_json=payload.graph_json if payload.graph_json is not None else empty_graph(),
            created_by=created_by,
        )
        self._db.add(flow)
        self._db.commit()
        self._db.refresh(flow)
        return flow

    def update_flow(self, flow: DesignFlow, payload: DesignFlowUpdate) -> DesignFlow:
        data = payload.model_dump(exclude_unset=True)
        if "name" in data and data["name"] is not None:
            name = data["name"].strip()
            clash = self._db.scalar(
                select(DesignFlow).where(DesignFlow.name == name, DesignFlow.id != flow.id)
            )
            if clash is not None:
                raise ValueError(f"Design flow name already exists: {name}")
            flow.name = name
        if "description" in data:
            flow.description = data["description"]
        if "graph_json" in data and data["graph_json"] is not None:
            flow.graph_json = data["graph_json"]
        flow.updated_at = datetime.now(UTC)
        self._db.add(flow)
        self._db.commit()
        self._db.refresh(flow)
        return flow

    def delete_flow(self, flow: DesignFlow) -> None:
        self._db.delete(flow)
        self._db.commit()
