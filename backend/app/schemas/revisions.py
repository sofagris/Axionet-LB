from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from app.models.config_revision import DeploymentStatus, ValidationStatus


class RevisionSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    service_instance_id: str
    revision_number: int
    validation_status: ValidationStatus
    deployment_status: DeploymentStatus
    created_by: str
    created_at: datetime
    deployed_at: datetime | None = None


class RevisionRead(RevisionSummary):
    configuration: dict[str, Any]
    rendered_configuration: str
    validation_output: str
    diff_from_previous: str | None = Field(
        default=None,
        description="Unified diff of rendered config against previous revision",
    )
