from __future__ import annotations

import ipaddress
import logging
import re
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.network import Network
from app.models.service_instance import ServiceInstance
from app.models.service_vip import ServiceVip
from app.plugins.frr.schemas import FrrConfig
from app.plugins.haproxy.schemas import HaproxyConfig
from app.schemas.instances import NetworkAttachmentCreate, NetworkAttachmentUpdate
from app.schemas.vips import VipCreate, VipUpdate
from app.services.audit.service import AuditService
from app.services.instances.attachments import normalize_host_ip
from app.services.instances.service import InstanceService

logger = logging.getLogger(__name__)

NAME_RE = re.compile(r"^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$")


def vip_announce_prefix(address: str) -> str:
    host = normalize_host_ip(address)
    return str(ipaddress.ip_network(f"{host}/{32 if ipaddress.ip_address(host).version == 4 else 128}"))


class VipService:
    def __init__(self, db: Session, instances: InstanceService) -> None:
        self._db = db
        self._instances = instances
        self._audit = AuditService(db)

    def list_vips(self) -> list[ServiceVip]:
        return list(self._db.scalars(select(ServiceVip).order_by(ServiceVip.name)))

    def get_vip(self, vip_id: str) -> ServiceVip | None:
        return self._db.get(ServiceVip, vip_id)

    def create_vip(self, payload: VipCreate) -> ServiceVip:
        address = normalize_host_ip(payload.address)
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
            haproxy_instance_id=haproxy.id,
            frr_instance_id=frr.id,
            network_id=network.id,
            enabled=payload.enabled,
            advertise=payload.advertise,
            attached=False,
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
                payload={"name": vip.name, "address": vip.address},
                result="error",
            )
            self._db.commit()
            self._db.refresh(vip)
            return vip

        self._audit.record(
            event_type="vip.create",
            resource_type="vip",
            resource_id=vip.id,
            payload={"name": vip.name, "address": vip.address},
        )
        self._db.commit()
        self._db.refresh(vip)
        return vip

    def update_vip(self, vip: ServiceVip, payload: VipUpdate) -> ServiceVip:
        updates = payload.model_dump(exclude_unset=True)
        bind_frontends = updates.pop("bind_frontends", None)
        if "name" in updates and updates["name"] != vip.name:
            self._validate_name(updates["name"])
            self._assert_unique_name(updates["name"], exclude_id=vip.id)
            vip.name = updates["name"]
        if "address" in updates:
            address = normalize_host_ip(updates["address"])
            if address != vip.address:
                self._assert_unique_address(address, exclude_id=vip.id)
                # Withdraw old prefix before changing address
                if vip.advertised:
                    self._set_frr_announce(vip, announce=False)
                    vip.advertised = False
                vip.address = address
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
            payload={"name": vip.name, "enabled": vip.enabled, "advertise": vip.advertise},
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

    def _reconcile(self, vip: ServiceVip, *, bind_frontends: bool = False) -> None:
        should_live = vip.enabled
        should_announce = should_live and vip.advertise

        if should_live:
            self._ensure_haproxy_attachment(vip, attach=True)
            vip.attached = True
            if bind_frontends:
                self._bind_haproxy_frontends(vip)
        else:
            if vip.advertised:
                self._set_frr_announce(vip, announce=False)
                vip.advertised = False
            vip.last_error = None
            vip.updated_at = datetime.now(UTC)
            return

        if should_announce:
            self._set_frr_announce(vip, announce=True)
            vip.advertised = True
        elif vip.advertised:
            self._set_frr_announce(vip, announce=False)
            vip.advertised = False

        vip.last_error = None
        vip.updated_at = datetime.now(UTC)

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
