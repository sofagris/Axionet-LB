from __future__ import annotations

import logging
from typing import Any
from pathlib import Path
import uuid

import docker
from docker.errors import APIError, ContainerError, DockerException, ImageNotFound, NotFound
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

    def run_ephemeral(
        self,
        *,
        image: str,
        command: list[str],
        files: dict[str, str],
    ) -> str:
        """Run one-shot container with config files from a host-visible data dir."""
        client = self._get_client()
        self.ensure_image(image)

        validate_root = Path(self._settings.data_dir) / "runtime" / "validate"
        validate_root.mkdir(parents=True, exist_ok=True)
        work = validate_root / str(uuid.uuid4())
        work.mkdir(parents=True, exist_ok=True)
        try:
            content = next(iter(files.values()))
            (work / "haproxy.cfg").write_text(content, encoding="utf-8")
            container = client.containers.create(
                image=image,
                command=command,
                volumes={str(work): {"bind": "/usr/local/etc/haproxy", "mode": "ro"}},
                network_mode="none",
                labels={MANAGED_LABEL: "true", "axionet.purpose": "config-validate"},
            )
            try:
                result = container.wait(timeout=60)
                logs = container.logs(stdout=True, stderr=True).decode("utf-8", errors="replace")
                status_code = int(result.get("StatusCode", 1))
                if status_code != 0:
                    raise ContainerError(container, status_code, command, image, logs.encode())
                return logs.strip()
            finally:
                container.remove(force=True)
        finally:
            for path in sorted(work.rglob("*"), reverse=True):
                if path.is_file():
                    path.unlink(missing_ok=True)
            work.rmdir()

    def ensure_image(self, image: str) -> None:
        client = self._get_client()
        try:
            client.images.get(image)
        except ImageNotFound:
            client.images.pull(image)

    def create_managed_container(
        self,
        *,
        name: str,
        image: str,
        instance_id: str,
        service_type: str,
        host_config_dir: str,
        network_ids: list[str],
        restart_policy: str = "unless-stopped",
        revision: str | None = None,
    ) -> str:
        client = self._get_client()
        self.ensure_image(image)
        labels = {
            MANAGED_LABEL: "true",
            "axionet.instance_id": instance_id,
            "axionet.service_type": service_type,
        }
        if revision is not None:
            labels["axionet.revision"] = revision
        kwargs: dict[str, Any] = {
            "image": image,
            "name": name,
            "detach": True,
            "labels": labels,
            "volumes": {host_config_dir: {"bind": "/usr/local/etc/haproxy", "mode": "ro"}},
            "restart_policy": {"Name": restart_policy},
            "command": ["haproxy", "-W", "-db", "-f", "/usr/local/etc/haproxy/haproxy.cfg"],
        }
        if network_ids:
            kwargs["network"] = network_ids[0]
        try:
            container = client.containers.create(**kwargs)
            for net_id in network_ids[1:]:
                client.networks.get(net_id).connect(container)
            return container.id
        except APIError as exc:
            raise DockerException(str(exc)) from exc

    def start_container(self, container_id: str) -> None:
        try:
            self._get_client().containers.get(container_id).start()
        except NotFound as exc:
            raise DockerException(f"Container not found: {container_id}") from exc
        except APIError as exc:
            raise DockerException(str(exc)) from exc

    def stop_container(self, container_id: str, timeout: int = 10) -> None:
        try:
            self._get_client().containers.get(container_id).stop(timeout=timeout)
        except NotFound:
            return
        except APIError as exc:
            raise DockerException(str(exc)) from exc

    def restart_container(self, container_id: str, timeout: int = 10) -> None:
        try:
            self._get_client().containers.get(container_id).restart(timeout=timeout)
        except NotFound as exc:
            raise DockerException(f"Container not found: {container_id}") from exc
        except APIError as exc:
            raise DockerException(str(exc)) from exc

    def remove_container(self, container_id: str) -> None:
        try:
            container = self._get_client().containers.get(container_id)
            labels = container.labels or {}
            if labels.get(MANAGED_LABEL) != "true":
                raise DockerException(
                    f"Refusing to remove container {container_id}: missing {MANAGED_LABEL}=true"
                )
            container.remove(force=True)
        except NotFound:
            return
        except APIError as exc:
            raise DockerException(str(exc)) from exc

    def inspect_container(self, container_id: str) -> dict[str, Any] | None:
        try:
            container = self._get_client().containers.get(container_id)
            return container.attrs
        except NotFound:
            return None

    def container_logs(self, container_id: str, *, tail: int = 200) -> str:
        try:
            container = self._get_client().containers.get(container_id)
            raw = container.logs(tail=tail, stdout=True, stderr=True)
            return raw.decode("utf-8", errors="replace")
        except NotFound as exc:
            raise DockerException(f"Container not found: {container_id}") from exc

    def connect_container_network(
        self,
        container_id: str,
        network_id: str,
        ipv4_address: str | None = None,
    ) -> None:
        network = self._get_client().networks.get(network_id)
        kwargs: dict[str, Any] = {}
        if ipv4_address:
            kwargs["ipv4_address"] = ipv4_address
        try:
            network.connect(container_id, **kwargs)
        except APIError as exc:
            if "already exists" not in str(exc).lower():
                raise DockerException(str(exc)) from exc

    def run_network_sidecar(
        self,
        *,
        image: str,
        network_container_id: str,
        command: list[str],
    ) -> str:
        """Run a one-shot helper sharing the target container network namespace."""
        client = self._get_client()
        self.ensure_image(image)
        try:
            output = client.containers.run(
                image=image,
                command=command,
                network_mode=f"container:{network_container_id}",
                remove=True,
                labels={MANAGED_LABEL: "true", "axionet.purpose": "runtime-probe"},
            )
        except APIError as exc:
            raise DockerException(str(exc)) from exc
        if isinstance(output, bytes):
            return output.decode("utf-8", errors="replace")
        return str(output)

    def close(self) -> None:
        if self._client is not None:
            self._client.close()
            self._client = None


def create_docker_adapter(settings: Settings) -> DockerClientAdapter:
    return DockerClientAdapter(settings)
