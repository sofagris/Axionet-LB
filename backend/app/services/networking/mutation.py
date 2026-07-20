from __future__ import annotations

import logging
from datetime import UTC, datetime
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.physical_interface import AdministrativeState, PhysicalInterface
from app.schemas.interfaces import (
    PhysicalInterfaceApplyResult,
    PhysicalInterfaceRead,
    PhysicalInterfaceUpdate,
    PromoteManagementResult,
)
from app.services.networking.bind_env import read_mgmt_bind_ip, write_mgmt_bind_env
from app.services.networking.discovery import InterfaceDiscoveryService
from app.services.networking.host import HostNetworkAdapter, HostNetworkError
from app.services.networking.pending import PendingChange, PendingChangeStore, PendingSnapshot
from app.services.networking.safety import InterfaceSafetyError, InterfaceSafetyService

logger = logging.getLogger(__name__)


class InterfaceMutationService:
    """Apply live NIC changes and manage the management-interface designation."""

    def __init__(
        self,
        db: Session,
        discovery: InterfaceDiscoveryService,
        host_net: HostNetworkAdapter,
        pending: PendingChangeStore,
        *,
        data_dir: str | Path,
    ) -> None:
        self._db = db
        self._discovery = discovery
        self._host = host_net
        self._pending = pending
        self._safety = InterfaceSafetyService()
        self._data_dir = Path(data_dir)

    def apply_update(
        self,
        interface: PhysicalInterface,
        payload: PhysicalInterfaceUpdate,
    ) -> PhysicalInterfaceApplyResult:
        decision = self._safety.evaluate_update(interface, payload)
        previous = PendingSnapshot(
            mtu=interface.mtu,
            administrative_state=interface.administrative_state,
            speed_mbps=interface.speed_mbps,
        )

        try:
            if payload.mtu is not None and payload.mtu != interface.mtu:
                self._host.set_mtu(interface.name, payload.mtu)
            if payload.administrative_state is not None:
                new_state = payload.administrative_state.value
                if new_state != interface.administrative_state:
                    self._host.set_admin_state(
                        interface.name,
                        up=new_state == AdministrativeState.ENABLED.value,
                    )
            if payload.speed_autoneg:
                self._host.set_speed_mbps(interface.name, None)
            elif payload.speed_mbps is not None:
                self._host.set_speed_mbps(interface.name, payload.speed_mbps)
        except HostNetworkError as exc:
            raise InterfaceSafetyError("host_apply_failed", str(exc)) from exc

        # Metadata + refresh discovered fields from sysfs
        self._discovery.update_interface(
            interface,
            description=payload.description,
            administrative_state=payload.administrative_state.value
            if payload.administrative_state is not None
            else None,
            exclusive_use=payload.exclusive_use,
        )
        self._refresh_from_sysfs(interface)
        self._db.flush()

        pending_id = None
        rollback_at = None
        message = None
        if decision.requires_pending_rollback:
            change = self._pending.create(
                interface_id=interface.id,
                interface_name=interface.name,
                previous=previous,
            )
            pending_id = change.id
            rollback_at = change.rollback_at
            message = (
                "Change applied; confirm within the rollback window or it will be reverted"
            )

        return PhysicalInterfaceApplyResult(
            interface=PhysicalInterfaceRead.model_validate(interface),
            pending_change_id=pending_id,
            rollback_at=rollback_at,
            message=message,
        )

    def confirm_change(self, change_id: str) -> PendingChange:
        change = self._pending.confirm(change_id)
        if change is None:
            raise InterfaceSafetyError("pending_not_found", "Pending change not found or already closed")
        return change

    def promote_management(self, interface: PhysicalInterface) -> PromoteManagementResult:
        ipv4 = self._host.list_ipv4_addresses(interface.name)
        self._safety.evaluate_promote(interface, ipv4)
        bind_ip = ipv4[0]

        for other in self._discovery.list_interfaces():
            if other.id != interface.id and other.is_management:
                other.is_management = False
                other.updated_at = datetime.now(UTC)

        interface.is_management = True
        interface.updated_at = datetime.now(UTC)
        self._db.flush()
        write_mgmt_bind_env(self._data_dir, bind_ip)

        return PromoteManagementResult(
            interface=PhysicalInterfaceRead.model_validate(interface),
            management_bind_ip=bind_ip,
            compose_hint=(
                f"Export MGMT_BIND_IP={bind_ip} (or source {self._data_dir / 'mgmt-bind.env'}) "
                "and run: docker compose up -d gui"
            ),
            requires_compose_recreate=True,
        )

    def bootstrap_management_if_needed(self) -> PhysicalInterface | None:
        existing = next((item for item in self._discovery.list_interfaces() if item.is_management), None)
        if existing is not None:
            if not read_mgmt_bind_ip(self._data_dir):
                ipv4 = self._host.list_ipv4_addresses(existing.name)
                if ipv4:
                    write_mgmt_bind_env(self._data_dir, ipv4[0])
            return existing

        preferred = self._host.default_route_interface()
        candidate: PhysicalInterface | None = None
        if preferred:
            candidate = next(
                (item for item in self._discovery.list_interfaces() if item.name == preferred),
                None,
            )
        if candidate is None:
            for item in self._discovery.list_interfaces():
                if self._host.list_ipv4_addresses(item.name):
                    candidate = item
                    break
        if candidate is None:
            return None

        try:
            result = self.promote_management(candidate)
            self._db.commit()
            logger.info(
                "Bootstrapped management interface %s bind=%s",
                result.interface.name,
                result.management_bind_ip,
            )
            return candidate
        except InterfaceSafetyError as exc:
            logger.warning("Could not bootstrap management interface: %s", exc.message)
            self._db.rollback()
            return None

    def rollback_change(self, change: PendingChange) -> None:
        interface = self._discovery.get_interface(change.interface_id)
        if interface is None:
            logger.warning("Rollback skipped; interface %s gone", change.interface_id)
            return
        prev = change.previous
        try:
            if prev.mtu is not None:
                self._host.set_mtu(interface.name, prev.mtu)
            self._host.set_admin_state(
                interface.name,
                up=prev.administrative_state != AdministrativeState.DISABLED.value,
            )
            try:
                self._host.set_speed_mbps(interface.name, prev.speed_mbps)
            except HostNetworkError:
                self._host.set_speed_mbps(interface.name, None)
        except HostNetworkError:
            logger.exception("Host rollback failed for %s", interface.name)
            return

        self._discovery.update_interface(
            interface,
            administrative_state=prev.administrative_state,
        )
        self._refresh_from_sysfs(interface)
        self._db.commit()
        logger.info("Rolled back interface %s change %s", interface.name, change.id)

    def _refresh_from_sysfs(self, interface: PhysicalInterface) -> None:
        discovered = {item.name: item for item in self._discovery._scanner.scan()}  # noqa: SLF001
        item = discovered.get(interface.name)
        if item is None:
            return
        interface.mtu = item.mtu
        interface.speed_mbps = item.speed_mbps
        interface.link_state = item.link_state
        interface.updated_at = datetime.now(UTC)

    def management_summary(self) -> tuple[PhysicalInterface | None, str | None]:
        mgmt = next((item for item in self._discovery.list_interfaces() if item.is_management), None)
        bind_ip = read_mgmt_bind_ip(self._data_dir)
        if bind_ip is None and mgmt is not None:
            ipv4 = self._host.list_ipv4_addresses(mgmt.name)
            bind_ip = ipv4[0] if ipv4 else None
        return mgmt, bind_ip
