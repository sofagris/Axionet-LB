from __future__ import annotations

import logging
import re
import shutil
from datetime import UTC, datetime
from pathlib import Path

from docker.errors import DockerException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.models.config_revision import ConfigRevision, DeploymentStatus
from app.models.network import Network
from app.models.network_attachment import NetworkAttachment
from app.models.service_instance import (
    ActualState,
    DesiredState,
    HealthStatus,
    ServiceInstance,
)
from app.plugins.haproxy.renderer import render_haproxy_config
from app.plugins.haproxy.schemas import HaproxyConfig
from app.plugins.haproxy.validator import HaproxyConfigValidator
from app.schemas.instances import InstanceCreate, InstanceUpdate, NetworkAttachmentCreate
from app.services.docker.client import DockerClientAdapter
from app.services.instances.attachments import validate_network_attachments
from app.services.revisions.service import RevisionService

logger = logging.getLogger(__name__)

NAME_RE = re.compile(r"^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$")


class InstanceService:
    def __init__(self, db: Session, docker: DockerClientAdapter, settings: Settings) -> None:
        self._db = db
        self._docker = docker
        self._settings = settings
        self._validator = HaproxyConfigValidator(docker)
        self._revisions = RevisionService(db)

    def list_instances(self) -> list[ServiceInstance]:
        return list(self._db.scalars(select(ServiceInstance).order_by(ServiceInstance.name)))

    def get_instance(self, instance_id: str) -> ServiceInstance | None:
        return self._db.get(ServiceInstance, instance_id)

    def list_attachments(self, instance_id: str) -> list[NetworkAttachment]:
        stmt = (
            select(NetworkAttachment)
            .where(NetworkAttachment.service_instance_id == instance_id)
            .order_by(NetworkAttachment.attachment_order, NetworkAttachment.created_at)
        )
        return list(self._db.scalars(stmt))

    def create_instance(self, payload: InstanceCreate) -> ServiceInstance:
        if payload.service_type != "haproxy":
            raise ValueError("Only service_type=haproxy is supported in Milestone 4")
        if not NAME_RE.match(payload.name):
            raise ValueError("Invalid instance name")
        if self._db.scalars(
            select(ServiceInstance).where(ServiceInstance.name == payload.name)
        ).first():
            raise ValueError("Instance name already exists")

        networks = self._resolve_networks(payload.networks)
        config = HaproxyConfig.from_dict(payload.configuration).model_dump()
        image = f"haproxy:{payload.image_version}"

        instance = ServiceInstance(
            name=payload.name,
            service_type="haproxy",
            desired_state=payload.desired_state.value,
            actual_state=ActualState.CREATING.value,
            image=image,
            image_version=payload.image_version,
            restart_policy=payload.restart_policy,
            configuration=config,
            container_name=None,
            health_status=HealthStatus.UNKNOWN.value,
        )
        self._db.add(instance)
        self._db.flush()
        instance.container_name = f"ax-haproxy-{instance.id.replace('-', '')[:12]}"

        for index, attachment in enumerate(payload.networks):
            self._db.add(
                NetworkAttachment(
                    service_instance_id=instance.id,
                    network_id=attachment.network_id,
                    ip_address=attachment.ip_address,
                    gateway=attachment.gateway,
                    interface_alias=attachment.interface_alias,
                    attachment_order=attachment.attachment_order or index,
                )
            )

        try:
            self._write_config(instance)
            validation = self._validator.validate_config_dict(
                instance.configuration,
                cert_files=self._load_cert_files(instance),
            )
            if not validation.ok:
                raise ValueError(f"HAProxy config invalid: {validation.output}")
            self._revisions.record_revision(
                instance,
                validation_ok=True,
                validation_output=validation.output,
                deployment_status=DeploymentStatus.DEPLOYED,
                created_by="system",
            )
            self._ensure_container(instance, networks)
            if payload.desired_state == DesiredState.RUNNING:
                self._docker.start_container(instance.container_id or "")
                instance.desired_state = DesiredState.RUNNING.value
                instance.actual_state = ActualState.RUNNING.value
                instance.started_at = datetime.now(UTC)
                instance.health_status = HealthStatus.HEALTHY.value
            else:
                instance.desired_state = DesiredState.STOPPED.value
                instance.actual_state = ActualState.STOPPED.value
            instance.last_error = None
        except (ValueError, DockerException, OSError) as exc:
            instance.actual_state = ActualState.ERROR.value
            instance.last_error = str(exc)
            instance.health_status = HealthStatus.UNHEALTHY.value
            self._db.commit()
            raise RuntimeError(str(exc)) from exc

        instance.updated_at = datetime.now(UTC)
        self._db.commit()
        self._db.refresh(instance)
        return instance

    def update_instance(self, instance: ServiceInstance, payload: InstanceUpdate) -> ServiceInstance:
        if payload.configuration is not None:
            return self.apply_configuration(instance, payload.configuration, restart_if_running=True)
        if payload.restart_policy is not None:
            instance.restart_policy = payload.restart_policy
        if payload.desired_state is not None:
            instance.desired_state = payload.desired_state.value
        instance.updated_at = datetime.now(UTC)
        self._db.commit()
        self._db.refresh(instance)
        return instance

    def apply_configuration(
        self,
        instance: ServiceInstance,
        configuration: dict,
        *,
        restart_if_running: bool = True,
        created_by: str = "system",
    ) -> ServiceInstance:
        instance.configuration = HaproxyConfig.from_dict(configuration).model_dump()
        self._write_config(instance)
        validation = self._validator.validate_config_dict(
            instance.configuration,
            cert_files=self._load_cert_files(instance),
        )
        if not validation.ok:
            raise ValueError(f"HAProxy config invalid: {validation.output}")

        should_reload = (
            restart_if_running
            and instance.desired_state == DesiredState.RUNNING.value
            and bool(instance.container_id)
        )
        deployment_status = DeploymentStatus.DEPLOYED
        try:
            if should_reload:
                self._reload_or_restart(instance)
                instance.desired_state = DesiredState.RUNNING.value
                instance.actual_state = ActualState.RUNNING.value
                instance.started_at = instance.started_at or datetime.now(UTC)
                instance.last_error = None
                instance.health_status = HealthStatus.HEALTHY.value
        except DockerException as exc:
            deployment_status = DeploymentStatus.FAILED
            instance.actual_state = ActualState.ERROR.value
            instance.last_error = str(exc)
            instance.health_status = HealthStatus.UNHEALTHY.value
            self._revisions.record_revision(
                instance,
                validation_ok=True,
                validation_output=validation.output,
                deployment_status=deployment_status,
                created_by=created_by,
            )
            instance.updated_at = datetime.now(UTC)
            self._db.commit()
            raise RuntimeError(str(exc)) from exc

        self._revisions.record_revision(
            instance,
            validation_ok=True,
            validation_output=validation.output,
            deployment_status=deployment_status,
            created_by=created_by,
        )
        instance.updated_at = datetime.now(UTC)
        self._db.commit()
        self._db.refresh(instance)
        return instance

    def restore_revision(
        self,
        instance: ServiceInstance,
        revision: ConfigRevision,
        *,
        created_by: str = "system",
    ) -> tuple[ServiceInstance, ConfigRevision]:
        updated = self.apply_configuration(
            instance,
            revision.configuration,
            restart_if_running=True,
            created_by=created_by,
        )
        created = self._revisions.list_revisions(instance.id)[0]
        return updated, created

    def list_revisions(self, instance_id: str) -> list[ConfigRevision]:
        return self._revisions.list_revisions(instance_id)

    def get_revision(self, instance_id: str, revision_id: str) -> ConfigRevision | None:
        return self._revisions.get_revision(instance_id, revision_id)

    def delete_instance(self, instance: ServiceInstance) -> None:
        instance.desired_state = DesiredState.DELETED.value
        instance.actual_state = ActualState.DELETING.value
        self._db.flush()
        if instance.container_id:
            try:
                self._docker.remove_container(instance.container_id)
            except DockerException as exc:
                raise RuntimeError(str(exc)) from exc
        shutil.rmtree(self._instance_dir(instance.id), ignore_errors=True)
        self._db.delete(instance)
        self._db.commit()

    def start_instance(self, instance: ServiceInstance) -> ServiceInstance:
        instance.desired_state = DesiredState.RUNNING.value
        return self.reconcile(instance)

    def stop_instance(self, instance: ServiceInstance) -> ServiceInstance:
        instance.desired_state = DesiredState.STOPPED.value
        return self.reconcile(instance)

    def restart_instance(self, instance: ServiceInstance) -> ServiceInstance:
        if not instance.container_id:
            return self.start_instance(instance)
        try:
            self._docker.restart_container(instance.container_id)
            instance.desired_state = DesiredState.RUNNING.value
            instance.actual_state = ActualState.RUNNING.value
            instance.started_at = datetime.now(UTC)
            instance.last_error = None
            instance.health_status = HealthStatus.HEALTHY.value
        except DockerException as exc:
            instance.actual_state = ActualState.ERROR.value
            instance.last_error = str(exc)
            instance.health_status = HealthStatus.UNHEALTHY.value
            self._db.commit()
            raise RuntimeError(str(exc)) from exc
        instance.updated_at = datetime.now(UTC)
        self._db.commit()
        self._db.refresh(instance)
        return instance

    def reload_instance(self, instance: ServiceInstance) -> ServiceInstance:
        """Soft-reload HAProxy master-worker (SIGUSR2). Falls back to restart on failure."""
        if not instance.container_id:
            return self.start_instance(instance)

        self._write_config(instance)
        validation = self._validator.validate_config_dict(
            instance.configuration,
            cert_files=self._load_cert_files(instance),
        )
        if not validation.ok:
            raise ValueError(f"HAProxy config invalid: {validation.output}")

        try:
            self._reload_or_restart(instance)
            instance.desired_state = DesiredState.RUNNING.value
            instance.actual_state = ActualState.RUNNING.value
            instance.started_at = instance.started_at or datetime.now(UTC)
            instance.last_error = None
            instance.health_status = HealthStatus.HEALTHY.value
        except DockerException as exc:
            instance.actual_state = ActualState.ERROR.value
            instance.last_error = str(exc)
            instance.health_status = HealthStatus.UNHEALTHY.value
            self._db.commit()
            raise RuntimeError(str(exc)) from exc
        instance.updated_at = datetime.now(UTC)
        self._db.commit()
        self._db.refresh(instance)
        return instance

    def ensure_runtime_admin_socket(self, instance: ServiceInstance) -> None:
        """Ensure live HAProxy has TCP admin socket (rewrite config + soft-reload if needed)."""
        if not instance.container_id:
            raise RuntimeError("Instance has no container")
        config_dir = self._write_config(instance)
        rendered = (config_dir / "haproxy.cfg").read_text(encoding="utf-8")
        if "ipv4@127.0.0.1:9999" not in rendered:
            raise RuntimeError("Rendered HAProxy config is missing TCP admin socket")

        from app.plugins.haproxy.runtime import HaproxyRuntimeClient

        runtime = HaproxyRuntimeClient(self._docker)
        try:
            runtime.send_admin_command(instance.container_id, "show info")
        except RuntimeError:
            logger.info("Admin socket unavailable for %s; soft-reloading", instance.name)
            self._reload_or_restart(instance)
            runtime.send_admin_command(instance.container_id, "show info")

    def _reload_or_restart(self, instance: ServiceInstance) -> None:
        """Prefer soft reload; fall back to container restart if signal fails."""
        container_id = instance.container_id or ""
        if not container_id:
            raise DockerException("Instance has no container")
        status = self.get_container_status(instance)
        if status != "running":
            self._docker.restart_container(container_id)
            return
        try:
            self._docker.signal_container(container_id, "SIGUSR2")
        except DockerException as exc:
            logger.warning(
                "Soft reload failed for %s (%s); falling back to restart",
                instance.name,
                exc,
            )
            self._docker.restart_container(container_id)

    def validate_instance(self, instance: ServiceInstance) -> tuple[bool, str, str]:
        rendered = render_haproxy_config(HaproxyConfig.from_dict(instance.configuration))
        result = self._validator.validate_config_dict(
            instance.configuration,
            cert_files=self._load_cert_files(instance),
        )
        return result.ok, result.output, rendered

    def validate_draft(
        self,
        *,
        service_type: str,
        image_version: str,
        configuration: dict | None,
    ) -> tuple[bool, str, str]:
        if service_type != "haproxy":
            raise ValueError("Only service_type=haproxy can be validated in this milestone")
        config = HaproxyConfig.from_dict(configuration).model_dump()
        rendered = render_haproxy_config(HaproxyConfig.from_dict(config))
        validator = HaproxyConfigValidator(self._docker, image=f"haproxy:{image_version}")
        result = validator.validate_config_dict(config)
        return result.ok, result.output, rendered

    def get_logs(self, instance: ServiceInstance, *, tail: int = 200) -> str:
        if not instance.container_id:
            return ""
        return self._docker.container_logs(instance.container_id, tail=tail)

    def get_container_status(self, instance: ServiceInstance) -> str | None:
        if not instance.container_id:
            return None
        attrs = self._docker.inspect_container(instance.container_id)
        if not attrs:
            return None
        return attrs.get("State", {}).get("Status")

    def reconcile(self, instance: ServiceInstance) -> ServiceInstance:
        try:
            networks = self._networks_for_instance(instance.id)
            if instance.desired_state == DesiredState.DELETED.value:
                if instance.container_id:
                    self._docker.remove_container(instance.container_id)
                instance.actual_state = ActualState.STOPPED.value
                instance.container_id = None
            elif instance.desired_state == DesiredState.RUNNING.value:
                self._write_config(instance)
                validation = self._validator.validate_config_dict(
                    instance.configuration,
                    cert_files=self._load_cert_files(instance),
                )
                if not validation.ok:
                    raise RuntimeError(f"HAProxy config invalid: {validation.output}")
                self._ensure_container(instance, networks)
                status = self.get_container_status(instance)
                if status != "running":
                    instance.actual_state = ActualState.STARTING.value
                    self._docker.start_container(instance.container_id or "")
                instance.actual_state = ActualState.RUNNING.value
                instance.started_at = instance.started_at or datetime.now(UTC)
                instance.health_status = HealthStatus.HEALTHY.value
                instance.last_error = None
            elif instance.desired_state == DesiredState.STOPPED.value:
                if instance.container_id:
                    status = self.get_container_status(instance)
                    if status == "running":
                        instance.actual_state = ActualState.STOPPING.value
                        self._docker.stop_container(instance.container_id)
                else:
                    self._ensure_container(instance, networks)
                instance.actual_state = ActualState.STOPPED.value
                instance.stopped_at = datetime.now(UTC)
                instance.last_error = None
        except (DockerException, OSError, RuntimeError, ValueError) as exc:
            instance.actual_state = ActualState.ERROR.value
            instance.last_error = str(exc)
            instance.health_status = HealthStatus.UNHEALTHY.value
            self._db.commit()
            raise RuntimeError(str(exc)) from exc

        instance.updated_at = datetime.now(UTC)
        self._db.commit()
        self._db.refresh(instance)
        return instance

    def reconcile_all(self) -> int:
        count = 0
        for instance in self.list_instances():
            if instance.desired_state == DesiredState.DELETED.value:
                continue
            if instance.desired_state != instance.actual_state or instance.actual_state == ActualState.ERROR.value:
                try:
                    self.reconcile(instance)
                    count += 1
                except RuntimeError:
                    logger.exception("Reconcile failed for %s", instance.id)
        return count

    def _resolve_networks(
        self,
        attachments: list[NetworkAttachmentCreate],
        *,
        exclude_instance_id: str | None = None,
    ) -> list[Network]:
        networks: list[Network] = []
        for item in attachments:
            network = self._db.get(Network, item.network_id)
            if network is None:
                raise ValueError(f"Network not found: {item.network_id}")
            if not network.enabled:
                raise ValueError(f"Network is disabled: {network.name}")
            if not network.docker_network_id:
                raise ValueError(f"Network has no Docker network: {network.name}")
            networks.append(network)
        validate_network_attachments(
            self._db,
            attachments,
            networks=networks,
            exclude_instance_id=exclude_instance_id,
        )
        return networks

    def _networks_for_instance(self, instance_id: str) -> list[Network]:
        attachments = self.list_attachments(instance_id)
        return self._resolve_networks(
            [
                NetworkAttachmentCreate(
                    network_id=item.network_id,
                    ip_address=item.ip_address,
                    gateway=item.gateway,
                    interface_alias=item.interface_alias,
                    attachment_order=item.attachment_order,
                )
                for item in attachments
            ],
            exclude_instance_id=instance_id,
        )

    def _instance_dir(self, instance_id: str) -> Path:
        path = Path(self._settings.data_dir) / "instances" / instance_id
        path.mkdir(parents=True, exist_ok=True)
        (path / "config").mkdir(exist_ok=True)
        (path / "certs").mkdir(exist_ok=True)
        (path / "maps").mkdir(exist_ok=True)
        (path / "errors").mkdir(exist_ok=True)
        (path / "runtime").mkdir(exist_ok=True)
        (path / "logs").mkdir(exist_ok=True)
        return path

    def _write_config(self, instance: ServiceInstance) -> Path:
        rendered = render_haproxy_config(HaproxyConfig.from_dict(instance.configuration))
        config_dir = self._instance_dir(instance.id) / "config"
        (config_dir / "certs").mkdir(parents=True, exist_ok=True)
        cfg = config_dir / "haproxy.cfg"
        cfg.write_text(rendered, encoding="utf-8")
        return config_dir

    def certs_dir(self, instance_id: str) -> Path:
        path = self._instance_dir(instance_id) / "config" / "certs"
        path.mkdir(parents=True, exist_ok=True)
        return path

    def write_certificate_pem(self, instance: ServiceInstance, name: str, pem: str) -> Path:
        if "BEGIN CERTIFICATE" not in pem:
            raise ValueError("PEM must include a certificate block")
        if "BEGIN" not in pem or "PRIVATE KEY" not in pem:
            raise ValueError("PEM must include a private key block (HAProxy expects a combined bundle)")
        path = self.certs_dir(instance.id) / f"{name}.pem"
        path.write_text(pem.strip() + "\n", encoding="utf-8")
        path.chmod(0o600)
        return path

    def delete_certificate_pem(self, instance: ServiceInstance, name: str) -> None:
        path = self.certs_dir(instance.id) / f"{name}.pem"
        path.unlink(missing_ok=True)

    def certificate_size(self, instance: ServiceInstance, name: str) -> int:
        path = self.certs_dir(instance.id) / f"{name}.pem"
        return path.stat().st_size if path.exists() else 0

    def _load_cert_files(self, instance: ServiceInstance) -> dict[str, str]:
        config = HaproxyConfig.from_dict(instance.configuration)
        files: dict[str, str] = {}
        for cert in config.certificates:
            path = self.certs_dir(instance.id) / f"{cert.name}.pem"
            if path.exists():
                files[cert.name] = path.read_text(encoding="utf-8")
        return files

    def _ensure_container(self, instance: ServiceInstance, networks: list[Network]) -> None:
        config_dir = str(self._instance_dir(instance.id) / "config")
        attachments = self.list_attachments(instance.id)

        if instance.container_id:
            attrs = self._docker.inspect_container(instance.container_id)
            if attrs is not None:
                for net, attachment in zip(networks, attachments, strict=False):
                    if net.docker_network_id:
                        self._docker.connect_container_network(
                            instance.container_id,
                            net.docker_network_id,
                            ipv4_address=attachment.ip_address,
                        )
                return
            instance.container_id = None

        latest = self._revisions.list_revisions(instance.id)
        revision_label = str(latest[0].revision_number) if latest else "0"
        endpoints: list[dict[str, str | None]] = []
        for net, attachment in zip(networks, attachments, strict=False):
            if not net.docker_network_id:
                continue
            endpoints.append(
                {
                    "network_id": net.docker_network_id,
                    "ipv4_address": attachment.ip_address,
                }
            )
        container_id = self._docker.create_managed_container(
            name=instance.container_name or f"ax-haproxy-{instance.id[:8]}",
            image=instance.image,
            instance_id=instance.id,
            service_type=instance.service_type,
            host_config_dir=config_dir,
            network_endpoints=endpoints,
            restart_policy=instance.restart_policy,
            revision=revision_label,
        )
        instance.container_id = container_id
