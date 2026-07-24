from __future__ import annotations

from datetime import datetime
from enum import StrEnum
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class WidgetType(StrEnum):
    TRAFFIC_FLOW = "traffic_flow"


class DashboardWidget(BaseModel):
    id: str = Field(min_length=1, max_length=36)
    type: WidgetType
    config: dict[str, Any] = Field(default_factory=dict)


class DashboardCreate(BaseModel):
    name: str = Field(min_length=1, max_length=128)
    description: str | None = Field(default=None, max_length=2000)


class DashboardUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=128)
    description: str | None = Field(default=None, max_length=2000)
    widgets: list[DashboardWidget] | None = None


class DashboardWidgetCreate(BaseModel):
    type: WidgetType
    config: dict[str, Any] = Field(default_factory=dict)


class DashboardRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    description: str | None
    widgets: list[DashboardWidget]
    created_at: datetime
    updated_at: datetime
