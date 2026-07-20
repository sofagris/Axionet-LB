from __future__ import annotations

import logging
import re
from datetime import UTC, datetime

from docker.errors import DockerException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.network import Network, NetworkType
from app.models.network_attachment import NetworkAttachment
from app.models.physical_interface import PhysicalInterface
from app.schemas.networks import NetworkCreate, NetworkUpdate, NetworkValidationResult
from app.services.docker.client import DockerClientAdapter
from app.services.networking.host import HostNetworkAdapter, HostNetworkError
from app.services.networking.validation import NetworkValidator

logger = logging.getLogger(__name__)

SAFE_NAME_RE = re.compile(r"^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$")


class NetworkService:
    def __init__(
        self,
        db: Session,
        docker: DockerClientAdapter,
        host_net: HostNetworkAdapter,
        validator: NetworkValidator | None = None,
    ) -> None:
        self._db = db
        self._docker = docker
        self._host_net = host_net
        self._validator = validator or NetworkValidator()

    def list_networks(self) -> list[tuple[Network, bool]]:
        networks = list(self._db.scalars(select(Network).order_by(Network.name)))
        return [(net, self._docker_exists(net)) for net in networks]

    def get_network(self, network_id: str) -> tuple[Network, bool] | None:
        network = self._db.get(Network, network_id)
        if network is None:
            return None
        return network, self._docker_exists(network)

    def validate_create(self, payload: NetworkCreate) -> NetworkValidationResult:
        parent = self._get_parent(payload.parent_interface_id)
        existing = list(self._db.scalars(select(Network)))
        return self._validator.validate_create(payload, existing_networks=existing, parent=parent)

    def create_network(self, payload: NetworkCreate) -> Network:
        result = self.validate_create(payload)
        if not result.valid:
            messages = "; ".join(issue.message for issue in result.issues if issue.severity == "error")
            raise ValueError(messages)

        parent = self._get_parent(payload.parent_interface_id)
        network = Network(
            name=payload.name,
            network_type=payload.network_type.value,
            parent_interface_id=payload.parent_interface_id,
            vlan_id=payload.vlan_id,
            subnet=payload.subnet,
            gateway=payload.gateway,
            ip_range=payload.ip_range,
            mtu=payload.mtu,
            enabled=payload.enabled,
        )
        self._db.add(network)
        self._db.flush()

        docker_name = f"ax-net-{network.id}"
        network.docker_network_name = docker_name

        try:
            parent_device = self._resolve_parent_device(payload, parent)
            network.parent_device = parent_device
            docker_id = self._docker.create_managed_network(
                name=docker_name,
                network_type=payload.network_type,
                network_id=network.id,
                parent_device=parent_device,
                subnet=payload.subnet,
                gateway=payload.gateway,
                ip_range=payload.ip_range,
                mtu=payload.mtu,
            )
            network.docker_network_id = docker_id
            network.last_error = None
        except (DockerException, HostNetworkError, ValueError) as exc:
            self._db.rollback()
            logger.exception("Failed to provision network %s", payload.name)
            raise RuntimeError(str(exc)) from exc

        network.updated_at = datetime.now(UTC)
        self._db.commit()
        self._db.refresh(network)
        return network

    def update_network(self, network: Network, payload: NetworkUpdate) -> Network:
        if payload.enabled is not None:
            network.enabled = payload.enabled
        if payload.mtu is not None:
            network.mtu = payload.mtu
        network.updated_at = datetime.now(UTC)
        self._db.commit()
        self._db.refresh(network)
        return network

    def delete_network(self, network: Network) -> None:
        in_use = self._db.scalars(
            select(NetworkAttachment).where(NetworkAttachment.network_id == network.id).limit(1)
        ).first()
        if in_use is not None:
            raise ValueError("Network is in use by one or more service instances")
        if network.docker_network_id:
            try:
                self._docker.remove_managed_network(network.docker_network_id)
            except DockerException as exc:
                raise RuntimeError(str(exc)) from exc
        self._db.delete(network)
        self._db.commit()

    def _docker_exists(self, network: Network) -> bool:
        if not network.docker_network_id:
            return False
        return self._docker.network_exists(network.docker_network_id)

    def _get_parent(self, parent_interface_id: str | None) -> PhysicalInterface | None:
        if not parent_interface_id:
            return None
        return self._db.get(PhysicalInterface, parent_interface_id)

    def _resolve_parent_device(
        self,
        payload: NetworkCreate,
        parent: PhysicalInterface | None,
    ) -> str | None:
        if parent is None:
            return None
        if not SAFE_NAME_RE.match(parent.name):
            raise ValueError(f"Unsafe parent interface name: {parent.name}")

        if payload.network_type == NetworkType.UNTAGGED_ACCESS or (
            payload.network_type
            in {NetworkType.IPVLAN_L2, NetworkType.IPVLAN_L3, NetworkType.MACVLAN}
            and payload.vlan_id is None
        ):
            return parent.name

        if payload.vlan_id is not None:
            ensured = self._host_net.ensure_vlan_subinterface(parent.name, payload.vlan_id)
            return ensured.device_name

        return parent.name
