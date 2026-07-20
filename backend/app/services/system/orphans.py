from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from docker.errors import DockerException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.network import Network
from app.models.service_instance import ServiceInstance
from app.services.audit.service import AuditService
from app.services.docker.client import DockerClientAdapter


class OrphanService:
    """Detect managed Docker resources that no longer match control-plane DB rows."""

    def __init__(self, db: Session, docker: DockerClientAdapter) -> None:
        self._db = db
        self._docker = docker
        self._audit = AuditService(db)

    def scan(self) -> dict[str, Any]:
        instances = list(self._db.scalars(select(ServiceInstance)))
        networks = list(self._db.scalars(select(Network)))

        known_instance_ids = {item.id for item in instances}
        known_container_ids = {item.container_id for item in instances if item.container_id}
        known_network_ids = {item.id for item in networks}
        known_docker_network_ids = {
            item.docker_network_id for item in networks if item.docker_network_id
        }

        orphan_containers: list[dict[str, Any]] = []
        missing_containers: list[dict[str, Any]] = []
        orphan_networks: list[dict[str, Any]] = []
        missing_networks: list[dict[str, Any]] = []

        try:
            docker_containers = self._docker.list_managed_containers()
            docker_networks = self._docker.list_managed_networks()
            docker_ok = True
            docker_error = None
        except DockerException as exc:
            docker_containers = []
            docker_networks = []
            docker_ok = False
            docker_error = str(exc)

        docker_container_ids = {item["id"] for item in docker_containers}
        docker_network_ids = {item["id"] for item in docker_networks}

        for item in docker_containers:
            labels = item.get("labels") or {}
            instance_id = labels.get("axionet.instance_id")
            if instance_id and instance_id in known_instance_ids:
                continue
            if item["id"] in known_container_ids:
                continue
            orphan_containers.append(
                {
                    "kind": "container",
                    "id": item["id"],
                    "name": item["name"],
                    "status": item["status"],
                    "image": item.get("image") or "",
                    "instance_id": instance_id,
                    "service_type": labels.get("axionet.service_type"),
                    "reason": (
                        "unknown_instance_id"
                        if instance_id and instance_id not in known_instance_ids
                        else "no_db_match"
                    ),
                    "prunable": True,
                }
            )

        for instance in instances:
            if not instance.container_id:
                continue
            if instance.container_id in docker_container_ids:
                continue
            # Only report missing when Docker is reachable; otherwise everything looks missing.
            if not docker_ok:
                break
            missing_containers.append(
                {
                    "kind": "container",
                    "id": instance.container_id,
                    "name": instance.container_name or instance.name,
                    "status": "missing",
                    "image": instance.image,
                    "instance_id": instance.id,
                    "service_type": instance.service_type,
                    "reason": "db_container_missing_in_docker",
                    "prunable": False,
                }
            )

        for item in docker_networks:
            labels = item.get("labels") or {}
            network_id = labels.get("axionet.network_id")
            if network_id and network_id in known_network_ids:
                continue
            if item["id"] in known_docker_network_ids:
                continue
            orphan_networks.append(
                {
                    "kind": "network",
                    "id": item["id"],
                    "name": item["name"],
                    "driver": item.get("driver") or "",
                    "network_id": network_id,
                    "network_type": labels.get("axionet.network_type"),
                    "reason": (
                        "unknown_network_id"
                        if network_id and network_id not in known_network_ids
                        else "no_db_match"
                    ),
                    "prunable": True,
                }
            )

        if docker_ok:
            for network in networks:
                if not network.docker_network_id:
                    continue
                if network.docker_network_id in docker_network_ids:
                    continue
                missing_networks.append(
                    {
                        "kind": "network",
                        "id": network.docker_network_id,
                        "name": network.name,
                        "driver": network.network_type,
                        "network_id": network.id,
                        "network_type": network.network_type,
                        "reason": "db_network_missing_in_docker",
                        "prunable": False,
                    }
                )

        return {
            "docker_ok": docker_ok,
            "docker_error": docker_error,
            "orphan_containers": orphan_containers,
            "orphan_networks": orphan_networks,
            "missing_containers": missing_containers,
            "missing_networks": missing_networks,
            "collected_at": datetime.now(UTC),
        }

    def prune(
        self,
        *,
        container_ids: list[str] | None = None,
        network_ids: list[str] | None = None,
    ) -> dict[str, Any]:
        report = self.scan()
        if not report["docker_ok"]:
            raise RuntimeError(report["docker_error"] or "Docker unavailable")

        prunable_containers = {item["id"]: item for item in report["orphan_containers"]}
        prunable_networks = {item["id"]: item for item in report["orphan_networks"]}

        removed_containers: list[str] = []
        removed_networks: list[str] = []
        errors: list[str] = []

        for container_id in container_ids or []:
            if container_id not in prunable_containers:
                errors.append(f"Container not prunable: {container_id}")
                continue
            try:
                self._docker.remove_container(container_id)
                removed_containers.append(container_id)
                self._audit.record(
                    event_type="orphan.container.prune",
                    resource_type="container",
                    resource_id=container_id,
                    payload=prunable_containers[container_id],
                    commit=False,
                )
            except DockerException as exc:
                errors.append(f"Container {container_id}: {exc}")

        for network_id in network_ids or []:
            if network_id not in prunable_networks:
                errors.append(f"Network not prunable: {network_id}")
                continue
            try:
                self._docker.remove_managed_network(network_id)
                removed_networks.append(network_id)
                self._audit.record(
                    event_type="orphan.network.prune",
                    resource_type="network",
                    resource_id=network_id,
                    payload=prunable_networks[network_id],
                    commit=False,
                )
            except DockerException as exc:
                errors.append(f"Network {network_id}: {exc}")

        self._db.commit()
        return {
            "removed_containers": removed_containers,
            "removed_networks": removed_networks,
            "errors": errors,
        }
