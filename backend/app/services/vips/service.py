from __future__ import annotations

import ipaddress
import logging
import re
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.network import Network
from app.models.service_instance import ActualState, HealthStatus, ServiceInstance
from app.models.service_vip import ServiceVip
from app.plugins.frr.schemas import FrrConfig
from app.plugins.haproxy.schemas import HaproxyConfig
from app.schemas.instances import NetworkAttachmentCreate, NetworkAttachmentUpdate
from app.schemas.vips import VipCreate, VipUpdate
from app.services.audit.service import AuditService
from app.services.instances.attachments import normalize_host_ip
from app.services.instances.service import InstanceService
from app.services.vips.dataplane import FrrVipDataplane

logger = logging.getLogger(__name__)

NAME_RE = re.compile(r"^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$")
VALID_MODES = {"same_l2", "routed"}


def vip_announce_prefix(address: str) -> str:
    host = normalize_host_ip(address)
    return str(ipaddress.ip_network(f"{host}/{32 if ipaddress.ip_address(host).version == 4 else 128}"))


def haproxy_ready_for_announce(haproxy: ServiceInstance) -> bool:
    """True when HAProxy can accept VIP traffic (M9.1)."""
    if haproxy.actual_state != ActualState.RUNNING.value:
        return False
    if haproxy.health_status == HealthStatus.UNHEALTHY.value:
        return False
    return True


class VipService:
    def __init__(self, db: Session, instances: InstanceService) -> None:
        self._db = db
        self._instances = instances
        self._audit = AuditService(db)
        self._dataplane = FrrVipDataplane(instances._docker)

    def list_vips(self) -> list[ServiceVip]:
        return list(self._db.scalars(select(ServiceVip).order_by(ServiceVip.name)))

    def get_vip(self, vip_id: str) -> ServiceVip | None:
        return self._db.get(ServiceVip, vip_id)

    def create_vip(self, payload: VipCreate) -> ServiceVip:
        address = normalize_host_ip(payload.address)
        mode = payload.mode if payload.mode in VALID_MODES else "same_l2"
        backend_ip = normalize_host_ip(payload.backend_ip) if payload.backend_ip else None
        self._validate_name(payload.name)
        self._assert_unique_name(payload.name)
        self._assert_unique_address(address)
        haproxy, frr, network = self._resolve_refs(
            payload.haproxy_instance_id,
            payload.frr_instance_id,
            payload.network_id,
        )

        vip = ServiceVip(
            name=payload.name,
            address=address,
            mode=mode,
            backend_ip=backend_ip,
            haproxy_instance_id=haproxy.id,
            frr_instance_id=frr.id,
            network_id=network.id,
            enabled=payload.enabled,
            advertise=payload.advertise,
            attached=False,
            dataplane_ready=False,
            advertised=False,
        )
        self._db.add(vip)
        self._db.flush()

        try:
            self._reconcile(vip, bind_frontends=payload.bind_frontends)
        except (ValueError, RuntimeError) as exc:
            vip.last_error = str(exc)
            vip.updated_at = datetime.now(UTC)
            self._audit.record(
                event_type="vip.create",
                resource_type="vip",
                resource_id=vip.id,
                payload={"name": vip.name, "address": vip.address, "mode": vip.mode},
                result="error",
            )
            self._db.commit()
            self._db.refresh(vip)
            return vip

        self._audit.record(
            event_type="vip.create",
            resource_type="vip",
            resource_id=vip.id,
            payload={"name": vip.name, "address": vip.address, "mode": vip.mode},
        )
        self._db.commit()
        self._db.refresh(vip)
        return vip

    def update_vip(self, vip: ServiceVip, payload: VipUpdate) -> ServiceVip:
        updates = payload.model_dump(exclude_unset=True)
        bind_frontends = updates.pop("bind_frontends", None)
        old_address = vip.address
        old_mode = vip.mode
        old_backend = vip.backend_ip

        if "name" in updates and updates["name"] != vip.name:
            self._validate_name(updates["name"])
            self._assert_unique_name(updates["name"], exclude_id=vip.id)
            vip.name = updates["name"]
        if "address" in updates:
            address = normalize_host_ip(updates["address"])
            if address != vip.address:
                self._assert_unique_address(address, exclude_id=vip.id)
                self._teardown_dataplane(vip)
                if vip.advertised:
                    self._set_frr_announce(vip, announce=False)
                    vip.advertised = False
                vip.address = address
        if "mode" in updates and updates["mode"] in VALID_MODES:
            if updates["mode"] != vip.mode:
                self._teardown_dataplane(vip)
                if vip.mode == "same_l2":
                    try:
                        self._ensure_haproxy_attachment(vip, attach=False)
                    except (ValueError, RuntimeError):
                        pass
                vip.mode = updates["mode"]
        if "backend_ip" in updates:
            vip.backend_ip = (
                normalize_host_ip(updates["backend_ip"]) if updates["backend_ip"] else None
            )
        if "haproxy_instance_id" in updates:
            vip.haproxy_instance_id = updates["haproxy_instance_id"]
        if "frr_instance_id" in updates:
            vip.frr_instance_id = updates["frr_instance_id"]
        if "network_id" in updates:
            vip.network_id = updates["network_id"]
        if "enabled" in updates:
            vip.enabled = updates["enabled"]
        if "advertise" in updates:
            vip.advertise = updates["advertise"]

        _ = (old_address, old_mode, old_backend)
        self._resolve_refs(vip.haproxy_instance_id, vip.frr_instance_id, vip.network_id)

        try:
            self._reconcile(vip, bind_frontends=bool(bind_frontends))
        except (ValueError, RuntimeError) as exc:
            vip.last_error = str(exc)
            vip.updated_at = datetime.now(UTC)
            self._audit.record(
                event_type="vip.update",
                resource_type="vip",
                resource_id=vip.id,
                payload={"name": vip.name},
                result="error",
            )
            self._db.commit()
            self._db.refresh(vip)
            return vip

        self._audit.record(
            event_type="vip.update",
            resource_type="vip",
            resource_id=vip.id,
            payload={
                "name": vip.name,
                "enabled": vip.enabled,
                "advertise": vip.advertise,
                "mode": vip.mode,
            },
        )
        self._db.commit()
        self._db.refresh(vip)
        return vip

    def delete_vip(self, vip: ServiceVip) -> None:
        vip_id = vip.id
        name = vip.name
        try:
            if vip.advertised:
                self._set_frr_announce(vip, announce=False)
            self._teardown_dataplane(vip)
            if vip.mode == "same_l2":
                self._ensure_haproxy_attachment(vip, attach=False)
        except (ValueError, RuntimeError) as exc:
            logger.warning("VIP cleanup partially failed for %s: %s", vip_id, exc)

        self._db.delete(vip)
        self._audit.record(
            event_type="vip.delete",
            resource_type="vip",
            resource_id=vip_id,
            payload={"name": name},
        )
        self._db.commit()

    def reconcile_advertise_all(self) -> int:
        """Sync FRR announce/dataplane state for all VIPs (health-gated)."""
        changed = 0
        for vip in self.list_vips():
            before = (vip.advertised, vip.dataplane_ready, vip.attached)
            try:
                self._reconcile(vip)
            except (ValueError, RuntimeError) as exc:
                vip.last_error = str(exc)
                vip.updated_at = datetime.now(UTC)
                logger.warning("VIP advertise reconcile failed for %s: %s", vip.id, exc)
            if (vip.advertised, vip.dataplane_ready, vip.attached) != before:
                changed += 1
                self._audit.record(
                    event_type="vip.advertise.sync",
                    resource_type="vip",
                    resource_id=vip.id,
                    payload={
                        "name": vip.name,
                        "advertised": vip.advertised,
                        "dataplane_ready": vip.dataplane_ready,
                        "enabled": vip.enabled,
                    },
                )
        if changed:
            self._db.commit()
        return changed

    def sync_for_haproxy_instance(self, haproxy_instance_id: str) -> int:
        """Re-evaluate advertise for VIPs tied to one HAProxy instance."""
        vips = list(
            self._db.scalars(
                select(ServiceVip).where(ServiceVip.haproxy_instance_id == haproxy_instance_id)
            )
        )
        if not vips:
            return 0
        changed = 0
        for vip in vips:
            before = (vip.advertised, vip.dataplane_ready)
            try:
                self._reconcile(vip)
            except (ValueError, RuntimeError) as exc:
                vip.last_error = str(exc)
                vip.updated_at = datetime.now(UTC)
                logger.warning("VIP sync after HAProxy change failed for %s: %s", vip.id, exc)
            if (vip.advertised, vip.dataplane_ready) != before:
                changed += 1
                self._audit.record(
                    event_type="vip.advertise.sync",
                    resource_type="vip",
                    resource_id=vip.id,
                    payload={
                        "name": vip.name,
                        "advertised": vip.advertised,
                        "haproxy_instance_id": haproxy_instance_id,
                    },
                )
        self._db.commit()
        return changed

    def _reconcile(self, vip: ServiceVip, *, bind_frontends: bool = False) -> None:
        should_live = vip.enabled
        haproxy = self._instances.get_instance(vip.haproxy_instance_id)
        ready = bool(haproxy and haproxy_ready_for_announce(haproxy))
        should_announce = should_live and vip.advertise and ready
        mode = vip.mode if vip.mode in VALID_MODES else "same_l2"

        if not should_live:
            self._set_frr_announce(vip, announce=False)
            vip.advertised = False
            self._teardown_dataplane(vip)
            vip.dataplane_ready = False
            if mode == "same_l2":
                # Keep attachment on disable (M9); only withdraw BGP.
                pass
            vip.last_error = None
            vip.updated_at = datetime.now(UTC)
            return

        if mode == "same_l2":
            self._ensure_haproxy_attachment(vip, attach=True)
            vip.attached = True
            vip.dataplane_ready = False
            if bind_frontends:
                self._bind_haproxy_frontends(vip)
            if should_announce:
                self._set_frr_announce(vip, announce=True)
                vip.advertised = True
            else:
                self._set_frr_announce(vip, announce=False)
                vip.advertised = False
        else:
            vip.attached = False
            # Announce (may restart FRR) before programming lo/DNAT so rules survive.
            if should_announce:
                self._set_frr_announce(vip, announce=True)
                vip.advertised = True
                backend_ip = self._resolve_backend_ip(vip)
                vip.backend_ip = backend_ip
                self._ensure_routed_dataplane(vip, backend_ip=backend_ip)
                vip.dataplane_ready = True
            else:
                self._set_frr_announce(vip, announce=False)
                vip.advertised = False
                self._teardown_dataplane(vip)
                vip.dataplane_ready = False

        vip.last_error = None
        vip.updated_at = datetime.now(UTC)

    def _resolve_backend_ip(self, vip: ServiceVip) -> str:
        if vip.backend_ip:
            return normalize_host_ip(vip.backend_ip)
        haproxy = self._instances.get_instance(vip.haproxy_instance_id)
        if haproxy is None:
            raise ValueError(f"HAProxy instance not found: {vip.haproxy_instance_id}")
        attachments = self._instances.list_attachments(haproxy.id)
        on_net = next(
            (item for item in attachments if item.network_id == vip.network_id and item.ip_address),
            None,
        )
        if on_net and on_net.ip_address:
            return normalize_host_ip(on_net.ip_address)
        any_ip = next((item for item in attachments if item.ip_address), None)
        if any_ip and any_ip.ip_address:
            return normalize_host_ip(any_ip.ip_address)
        raise ValueError(
            "routed VIP requires backend_ip or an HAProxy attachment with a static IP"
        )

    def _ensure_routed_dataplane(self, vip: ServiceVip, *, backend_ip: str) -> None:
        frr = self._instances.get_instance(vip.frr_instance_id)
        if frr is None or not frr.container_id:
            raise RuntimeError("FRR instance has no container for routed VIP dataplane")
        self._dataplane.ensure(
            container_id=frr.container_id,
            vip_id=vip.id,
            vip_address=vip.address,
            backend_ip=backend_ip,
        )

    def _teardown_dataplane(self, vip: ServiceVip) -> None:
        if vip.mode != "routed":
            vip.dataplane_ready = False
            return
        frr = self._instances.get_instance(vip.frr_instance_id)
        if frr is None or not frr.container_id:
            vip.dataplane_ready = False
            return
        self._dataplane.teardown(
            container_id=frr.container_id,
            vip_id=vip.id,
            vip_address=vip.address,
            backend_ip=vip.backend_ip,
        )
        vip.dataplane_ready = False

    def _ensure_haproxy_attachment(self, vip: ServiceVip, *, attach: bool) -> None:
        haproxy = self._instances.get_instance(vip.haproxy_instance_id)
        if haproxy is None:
            raise ValueError(f"HAProxy instance not found: {vip.haproxy_instance_id}")

        attachments = self._instances.list_attachments(haproxy.id)
        existing = next((item for item in attachments if item.network_id == vip.network_id), None)

        if attach:
            if existing is None:
                self._instances.add_network_attachment(
                    haproxy,
                    NetworkAttachmentCreate(network_id=vip.network_id, ip_address=vip.address),
                )
            elif existing.ip_address != vip.address:
                self._instances.update_network_attachment(
                    haproxy,
                    existing,
                    NetworkAttachmentUpdate(ip_address=vip.address),
                )
            return

        if existing is not None and existing.ip_address == vip.address:
            self._instances.remove_network_attachment(haproxy, existing)
            vip.attached = False

    def _bind_haproxy_frontends(self, vip: ServiceVip) -> None:
        haproxy = self._instances.get_instance(vip.haproxy_instance_id)
        if haproxy is None:
            raise ValueError(f"HAProxy instance not found: {vip.haproxy_instance_id}")
        config = HaproxyConfig.from_dict(haproxy.configuration)
        changed = False
        next_frontends = []
        for frontend in config.frontends:
            if frontend.bind_address in {"*", vip.address}:
                next_frontends.append(frontend)
                continue
            next_frontends.append(frontend.model_copy(update={"bind_address": vip.address}))
            changed = True
        if not changed:
            return
        data = config.model_dump()
        data["frontends"] = [item.model_dump() for item in next_frontends]
        self._instances.apply_configuration(haproxy, data)

    def _set_frr_announce(self, vip: ServiceVip, *, announce: bool) -> None:
        frr = self._instances.get_instance(vip.frr_instance_id)
        if frr is None:
            raise ValueError(f"FRR instance not found: {vip.frr_instance_id}")
        config = FrrConfig.from_dict(frr.configuration)
        prefix = vip_announce_prefix(vip.address)
        networks = list(config.networks)
        if announce:
            if prefix not in networks:
                networks.append(prefix)
        else:
            networks = [item for item in networks if item != prefix]
        if networks == list(config.networks):
            return
        data = config.model_dump()
        data["networks"] = networks
        self._instances.apply_configuration(frr, data)

    def _resolve_refs(
        self,
        haproxy_id: str,
        frr_id: str,
        network_id: str,
    ) -> tuple[ServiceInstance, ServiceInstance, Network]:
        haproxy = self._instances.get_instance(haproxy_id)
        if haproxy is None:
            raise ValueError(f"HAProxy instance not found: {haproxy_id}")
        if haproxy.service_type != "haproxy":
            raise ValueError(f"Instance is not HAProxy: {haproxy.name}")

        frr = self._instances.get_instance(frr_id)
        if frr is None:
            raise ValueError(f"FRR instance not found: {frr_id}")
        if frr.service_type != "frr":
            raise ValueError(f"Instance is not FRR: {frr.name}")

        network = self._db.get(Network, network_id)
        if network is None:
            raise ValueError(f"Network not found: {network_id}")
        if not network.enabled:
            raise ValueError(f"Network is disabled: {network.name}")
        return haproxy, frr, network

    def _validate_name(self, name: str) -> None:
        if not NAME_RE.match(name):
            raise ValueError("Invalid VIP name")

    def _assert_unique_name(self, name: str, *, exclude_id: str | None = None) -> None:
        existing = self._db.scalar(select(ServiceVip).where(ServiceVip.name == name))
        if existing is not None and existing.id != exclude_id:
            raise ValueError(f"VIP name already exists: {name}")

    def _assert_unique_address(self, address: str, *, exclude_id: str | None = None) -> None:
        existing = self._db.scalar(select(ServiceVip).where(ServiceVip.address == address))
        if existing is not None and existing.id != exclude_id:
            raise ValueError(f"VIP address already exists: {address}")
