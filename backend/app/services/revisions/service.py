from __future__ import annotations

import difflib
from copy import deepcopy
from datetime import UTC, datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.config_revision import ConfigRevision, DeploymentStatus, ValidationStatus
from app.models.service_instance import ServiceInstance
from app.plugins.haproxy.renderer import render_haproxy_config
from app.plugins.haproxy.schemas import HaproxyConfig


class RevisionService:
    def __init__(self, db: Session) -> None:
        self._db = db

    def list_revisions(self, instance_id: str) -> list[ConfigRevision]:
        stmt = (
            select(ConfigRevision)
            .where(ConfigRevision.service_instance_id == instance_id)
            .order_by(ConfigRevision.revision_number.desc())
        )
        return list(self._db.scalars(stmt))

    def get_revision(self, instance_id: str, revision_id: str) -> ConfigRevision | None:
        revision = self._db.get(ConfigRevision, revision_id)
        if revision is None or revision.service_instance_id != instance_id:
            return None
        return revision

    def get_previous_revision(self, revision: ConfigRevision) -> ConfigRevision | None:
        stmt = (
            select(ConfigRevision)
            .where(
                ConfigRevision.service_instance_id == revision.service_instance_id,
                ConfigRevision.revision_number < revision.revision_number,
            )
            .order_by(ConfigRevision.revision_number.desc())
            .limit(1)
        )
        return self._db.scalars(stmt).first()

    def diff_from_previous(self, revision: ConfigRevision) -> str | None:
        previous = self.get_previous_revision(revision)
        if previous is None:
            return None
        return unified_config_diff(
            previous.rendered_configuration,
            revision.rendered_configuration,
            from_label=f"r{previous.revision_number}",
            to_label=f"r{revision.revision_number}",
        )

    def record_revision(
        self,
        instance: ServiceInstance,
        *,
        validation_ok: bool,
        validation_output: str,
        deployment_status: DeploymentStatus,
        created_by: str = "system",
        mark_previous_superseded: bool = True,
    ) -> ConfigRevision:
        rendered = render_haproxy_config(HaproxyConfig.from_dict(instance.configuration))
        number = self._next_revision_number(instance.id)

        if mark_previous_superseded and deployment_status == DeploymentStatus.DEPLOYED:
            self._mark_deployed_as_superseded(instance.id)

        revision = ConfigRevision(
            service_instance_id=instance.id,
            revision_number=number,
            configuration=deepcopy(instance.configuration),
            rendered_configuration=rendered,
            validation_status=(
                ValidationStatus.VALID.value if validation_ok else ValidationStatus.INVALID.value
            ),
            validation_output=validation_output,
            deployment_status=deployment_status.value,
            created_by=created_by,
            deployed_at=datetime.now(UTC) if deployment_status == DeploymentStatus.DEPLOYED else None,
        )
        self._db.add(revision)
        self._db.flush()
        return revision

    def _next_revision_number(self, instance_id: str) -> int:
        current = self._db.scalar(
            select(func.max(ConfigRevision.revision_number)).where(
                ConfigRevision.service_instance_id == instance_id
            )
        )
        return int(current or 0) + 1

    def _mark_deployed_as_superseded(self, instance_id: str) -> None:
        stmt = select(ConfigRevision).where(
            ConfigRevision.service_instance_id == instance_id,
            ConfigRevision.deployment_status == DeploymentStatus.DEPLOYED.value,
        )
        for item in self._db.scalars(stmt):
            item.deployment_status = DeploymentStatus.SUPERSEDED.value


def unified_config_diff(
    previous: str,
    current: str,
    *,
    from_label: str = "previous",
    to_label: str = "current",
) -> str:
    diff = difflib.unified_diff(
        previous.splitlines(keepends=True),
        current.splitlines(keepends=True),
        fromfile=from_label,
        tofile=to_label,
    )
    return "".join(diff)
