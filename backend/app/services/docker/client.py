from __future__ import annotations

import logging
from typing import Any

import docker
from docker.errors import APIError, DockerException, NotFound
from docker.types import IPAMConfig, IPAMPool

from app.core.config import Settings
from app.models.network import NetworkType

logger = logging.getLogger(__name__)

MANAGED_LABEL = "axionet.managed"


class DockerClientAdapter:
    """Thin adapter so Docker socket usage stays behind one boundary."""

    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._client: docker.DockerClient | None = None

    def _get_client(self) -> docker.DockerClient:
        if self._client is None:
            timeout = self._settings.docker_timeout_seconds
            if self._settings.docker_host:
                self._client = docker.DockerClient(
                    base_url=self._settings.docker_host,
                    timeout=timeout,
                )
            else:
                self._client = docker.from_env(timeout=timeout)
        return self._client

    def ping(self) -> None:
        client = self._get_client()
        if not client.ping():
            raise DockerException("Docker daemon did not respond to ping")

    def network_exists(self, network_id: str) -> bool:
        try:
            self._get_client().networks.get(network_id)
            return True
        except NotFound:
            return False
        except DockerException:
            return False

    def create_managed_network(
        self,
        *,
        name: str,
        network_type: NetworkType,
        network_id: str,
        parent_device: str | None,
        subnet: str | None,
        gateway: str | None,
        ip_range: str | None,
        mtu: int | None,
    ) -> str:
        client = self._get_client()
        labels = {
            MANAGED_LABEL: "true",
            "axionet.network_id": network_id,
            "axionet.network_type": network_type.value,
        }
        ipam = None
        if subnet:
            pool_kwargs: dict[str, Any] = {"subnet": subnet}
            if gateway:
                pool_kwargs["gateway"] = gateway
            if ip_range:
                pool_kwargs["iprange"] = ip_range
            ipam = IPAMConfig(pool_configs=[IPAMPool(**pool_kwargs)])

        options: dict[str, str] = {}
        if mtu is not None:
            options["com.docker.network.driver.mtu"] = str(mtu)

        driver = "bridge"
        if network_type in {NetworkType.IPVLAN_L2, NetworkType.UNTAGGED_ACCESS}:
            driver = "ipvlan"
            if not parent_device:
                raise DockerException("ipvlan network requires parent_device")
            options["parent"] = parent_device
            options["ipvlan_mode"] = "l2"
        elif network_type == NetworkType.IPVLAN_L3:
            driver = "ipvlan"
            if not parent_device:
                raise DockerException("ipvlan network requires parent_device")
            options["parent"] = parent_device
            options["ipvlan_mode"] = "l3"
        elif network_type == NetworkType.MACVLAN:
            driver = "macvlan"
            if not parent_device:
                raise DockerException("macvlan network requires parent_device")
            options["parent"] = parent_device
        elif network_type in {NetworkType.BRIDGE, NetworkType.MANAGEMENT}:
            driver = "bridge"

        try:
            network = client.networks.create(
                name=name,
                driver=driver,
                options=options or None,
                ipam=ipam,
                labels=labels,
                check_duplicate=True,
            )
        except APIError as exc:
            raise DockerException(str(exc)) from exc
        return network.id

    def remove_managed_network(self, network_id: str) -> None:
        client = self._get_client()
        try:
            network = client.networks.get(network_id)
        except NotFound:
            return
        labels = network.attrs.get("Labels") or {}
        if labels.get(MANAGED_LABEL) != "true":
            raise DockerException(
                f"Refusing to delete Docker network {network_id}: missing {MANAGED_LABEL}=true"
            )
        network.remove()

    def close(self) -> None:
        if self._client is not None:
            self._client.close()
            self._client = None


def create_docker_adapter(settings: Settings) -> DockerClientAdapter:
    return DockerClientAdapter(settings)
