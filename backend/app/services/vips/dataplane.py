from __future__ import annotations

import logging

from docker.errors import DockerException

from app.services.docker.client import DockerClientAdapter

logger = logging.getLogger(__name__)


class FrrVipDataplane:
    """Manage VIP on FRR loopback and DNAT/MASQUERADE to HAProxy (M9.2 routed mode)."""

    def __init__(self, docker: DockerClientAdapter) -> None:
        self._docker = docker

    def ensure(
        self,
        *,
        container_id: str,
        vip_id: str,
        vip_address: str,
        backend_ip: str,
    ) -> None:
        comment = self._comment(vip_id)
        self._ensure_lo_address(container_id, vip_address)
        self._ensure_dnat(container_id, comment=comment, vip_address=vip_address, backend_ip=backend_ip)
        self._ensure_masquerade(container_id, comment=comment, backend_ip=backend_ip)

    def teardown(
        self,
        *,
        container_id: str,
        vip_id: str,
        vip_address: str,
        backend_ip: str | None = None,
    ) -> None:
        comment = self._comment(vip_id)
        try:
            self._remove_tagged_nat_rules(container_id, comment=comment)
        except DockerException as exc:
            logger.warning("Failed to remove NAT rules for VIP %s: %s", vip_id, exc)
        try:
            self._remove_lo_address(container_id, vip_address)
        except DockerException as exc:
            logger.warning("Failed to remove lo VIP %s: %s", vip_address, exc)

    @staticmethod
    def _comment(vip_id: str) -> str:
        return f"ax-vip-{vip_id[:8]}"

    def _ensure_lo_address(self, container_id: str, vip_address: str) -> None:
        cidr = f"{vip_address}/32"
        try:
            self._docker.exec_in_container(
                container_id,
                ["ip", "addr", "add", cidr, "dev", "lo"],
            )
        except DockerException as exc:
            text = str(exc).lower()
            if "file exists" in text or "already assigned" in text:
                return
            raise RuntimeError(f"Failed to add VIP on FRR lo: {exc}") from exc

    def _remove_lo_address(self, container_id: str, vip_address: str) -> None:
        cidr = f"{vip_address}/32"
        try:
            self._docker.exec_in_container(
                container_id,
                ["ip", "addr", "del", cidr, "dev", "lo"],
            )
        except DockerException as exc:
            text = str(exc).lower()
            if "cannot find" in text or "not found" in text or "no such" in text:
                return
            raise

    def _ensure_dnat(
        self,
        container_id: str,
        *,
        comment: str,
        vip_address: str,
        backend_ip: str,
    ) -> None:
        self._require_iptables(container_id)
        for protocol in ("tcp", "udp"):
            rule = [
                "PREROUTING",
                "-p",
                protocol,
                "-d",
                vip_address,
                "-m",
                "comment",
                "--comment",
                comment,
                "-j",
                "DNAT",
                "--to-destination",
                backend_ip,
            ]
            if self._nat_rule_exists(container_id, rule):
                continue
            self._docker.exec_in_container(
                container_id,
                ["iptables", "-t", "nat", "-A", *rule],
            )

    def _ensure_masquerade(self, container_id: str, *, comment: str, backend_ip: str) -> None:
        rule = [
            "POSTROUTING",
            "-d",
            backend_ip,
            "-m",
            "comment",
            "--comment",
            comment,
            "-j",
            "MASQUERADE",
        ]
        if self._nat_rule_exists(container_id, rule):
            return
        self._docker.exec_in_container(
            container_id,
            ["iptables", "-t", "nat", "-A", *rule],
        )

    def _remove_tagged_nat_rules(self, container_id: str, *, comment: str) -> None:
        self._require_iptables(container_id)
        for chain in ("PREROUTING", "POSTROUTING"):
            listing = self._docker.exec_in_container(
                container_id,
                ["iptables", "-t", "nat", "-S", chain],
            )
            for line in listing.splitlines():
                if comment not in line:
                    continue
                parts = line.split()
                if len(parts) < 2 or parts[0] != "-A":
                    continue
                delete_args = ["iptables", "-t", "nat", "-D", *parts[1:]]
                try:
                    self._docker.exec_in_container(container_id, delete_args)
                except DockerException as exc:
                    logger.warning("iptables delete failed (%s): %s", delete_args, exc)

    def _nat_rule_exists(self, container_id: str, rule: list[str]) -> bool:
        try:
            self._docker.exec_in_container(
                container_id,
                ["iptables", "-t", "nat", "-C", *rule],
            )
            return True
        except DockerException:
            return False

    def _require_iptables(self, container_id: str) -> None:
        try:
            self._docker.exec_in_container(container_id, ["iptables", "-V"])
        except DockerException as exc:
            raise RuntimeError(
                "FRR container lacks iptables; rebuild with axionet/frr:10.2.6 "
                f"(docker compose --profile tools build frr). Detail: {exc}"
            ) from exc
