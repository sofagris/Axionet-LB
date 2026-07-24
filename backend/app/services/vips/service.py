from __future__ import annotations

import ipaddress
import logging
import re
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models.network import Network
from app.models.service_instance import ActualState, HealthStatus, ServiceInstance
from app.models.service_vip import ServiceVip
from app.models.service_vip_link import ServiceVipLink
from app.plugins.frr.schemas import FrrConfig
from app.plugins.haproxy.schemas import HaproxyConfig
from app.schemas.instances import NetworkAttachmentCreate, NetworkAttachmentUpdate
from app.schemas.vips import VipCreate, VipLinkCreate, VipUpdate
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


def frr_ready_for_announce(frr: ServiceInstance) -> bool:
    return frr.actual_state == ActualState.RUNNING.value


class VipService:
    def __init__(self, db: Session, instances: InstanceService) -> None:
        self._db = db
        self._instances = instances
        self._audit = AuditService(db)
        self._dataplane = FrrVipDataplane(instances._docker)

    def list_vips(self) -> list[ServiceVip]:
        return list(
            self._db.scalars(
                select(ServiceVip)
                .options(selectinload(ServiceVip.links))
                .order_by(ServiceVip.name)
            )
        )

    def get_vip(self, vip_id: str) -> ServiceVip | None:
        return self._db.scalar(
            select(ServiceVip)
            .where(ServiceVip.id == vip_id)
            .options(selectinload(ServiceVip.links))
        )

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

        link_specs = self._normalize_link_specs(
            primary=VipLinkCreate(
                frr_instance_id=payload.frr_instance_id,
                network_id=payload.network_id,
            ),
            extra=payload.links,
        )
        for spec in link_specs:
            self._resolve_frr_network(spec.frr_instance_id, spec.network_id)

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

        for spec in link_specs:
            self._db.add(
                ServiceVipLink(
                    vip_id=vip.id,
                    frr_instance_id=spec.frr_instance_id,
                    network_id=spec.network_id,
                )
            )
        self._db.flush()
        self._db.refresh(vip, attribute_names=["links"])

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
            return self.get_vip(vip.id) or vip

        self._audit.record(
            event_type="vip.create",
            resource_type="vip",
            resource_id=vip.id,
            payload={
                "name": vip.name,
                "address": vip.address,
                "mode": vip.mode,
                "links": len(link_specs),
            },
        )
        self._db.commit()
        return self.get_vip(vip.id) or vip

    def update_vip(self, vip: ServiceVip, payload: VipUpdate) -> ServiceVip:
        vip = self.get_vip(vip.id) or vip
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
                self._teardown_dataplane_all(vip)
                for link in self._links(vip):
                    if link.advertised:
                        self._set_frr_announce_on(link.frr_instance_id, vip.address, announce=False)
                        link.advertised = False
                vip.advertised = False
                vip.address = address
        if "mode" in updates and updates["mode"] in VALID_MODES:
            if updates["mode"] != vip.mode:
                self._teardown_dataplane_all(vip)
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
        if "frr_instance_id" in updates or "network_id" in updates:
            new_frr = updates.get("frr_instance_id", vip.frr_instance_id)
            new_net = updates.get("network_id", vip.network_id)
            self._resolve_frr_network(new_frr, new_net)
            vip.frr_instance_id = new_frr
            vip.network_id = new_net
            self._ensure_primary_link(vip, frr_id=new_frr, network_id=new_net)
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
            return self.get_vip(vip.id) or vip

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
        return self.get_vip(vip.id) or vip

    def add_link(self, vip: ServiceVip, payload: VipLinkCreate) -> ServiceVip:
        vip = self.get_vip(vip.id) or vip
        self._resolve_frr_network(payload.frr_instance_id, payload.network_id)
        for link in self._links(vip):
            if (
                link.frr_instance_id == payload.frr_instance_id
                and link.network_id == payload.network_id
            ):
                raise ValueError("Dataplane link already exists on this VIP")
        self._db.add(
            ServiceVipLink(
                vip_id=vip.id,
                frr_instance_id=payload.frr_instance_id,
                network_id=payload.network_id,
            )
        )
        self._db.flush()
        self._db.refresh(vip, attribute_names=["links"])
        try:
            self._reconcile(vip)
        except (ValueError, RuntimeError) as exc:
            vip.last_error = str(exc)
            vip.updated_at = datetime.now(UTC)
            self._audit.record(
                event_type="vip.link.add",
                resource_type="vip",
                resource_id=vip.id,
                payload={
                    "frr_instance_id": payload.frr_instance_id,
                    "network_id": payload.network_id,
                },
                result="error",
            )
            self._db.commit()
            return self.get_vip(vip.id) or vip

        self._audit.record(
            event_type="vip.link.add",
            resource_type="vip",
            resource_id=vip.id,
            payload={
                "frr_instance_id": payload.frr_instance_id,
                "network_id": payload.network_id,
            },
        )
        self._db.commit()
        return self.get_vip(vip.id) or vip

    def remove_link(self, vip: ServiceVip, link_id: str) -> ServiceVip:
        vip = self.get_vip(vip.id) or vip
        links = self._links(vip)
        if len(links) <= 1:
            raise ValueError("Cannot remove the last dataplane link")
        target = next((item for item in links if item.id == link_id), None)
        if target is None:
            raise ValueError("Dataplane link not found")

        if target.advertised:
            self._set_frr_announce_on(target.frr_instance_id, vip.address, announce=False)
        if vip.mode == "routed" and target.dataplane_ready:
            self._teardown_dataplane_on(vip, target.frr_instance_id)

        was_primary = (
            target.frr_instance_id == vip.frr_instance_id
            and target.network_id == vip.network_id
        )
        self._db.delete(target)
        self._db.flush()
        self._db.expire(vip, ["links"])
        vip = self.get_vip(vip.id) or vip

        if was_primary:
            primary = self._links(vip)[0]
            vip.frr_instance_id = primary.frr_instance_id
            vip.network_id = primary.network_id

        try:
            self._reconcile(vip)
        except (ValueError, RuntimeError) as exc:
            vip.last_error = str(exc)
            vip.updated_at = datetime.now(UTC)
            self._audit.record(
                event_type="vip.link.remove",
                resource_type="vip",
                resource_id=vip.id,
                payload={"link_id": link_id},
                result="error",
            )
            self._db.commit()
            return self.get_vip(vip.id) or vip

        self._audit.record(
            event_type="vip.link.remove",
            resource_type="vip",
            resource_id=vip.id,
            payload={"link_id": link_id},
        )
        self._db.commit()
        return self.get_vip(vip.id) or vip

    def delete_vip(self, vip: ServiceVip) -> None:
        vip = self.get_vip(vip.id) or vip
        vip_id = vip.id
        name = vip.name
        try:
            for link in self._links(vip):
                if link.advertised:
                    self._set_frr_announce_on(link.frr_instance_id, vip.address, announce=False)
            self._teardown_dataplane_all(vip)
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
                select(ServiceVip)
                .where(ServiceVip.haproxy_instance_id == haproxy_instance_id)
                .options(selectinload(ServiceVip.links))
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
        self._ensure_links_present(vip)
        links = self._links(vip)
        should_live = vip.enabled
        haproxy = self._instances.get_instance(vip.haproxy_instance_id)
        ready = bool(haproxy and haproxy_ready_for_announce(haproxy))
        should_announce = should_live and vip.advertise and ready
        mode = vip.mode if vip.mode in VALID_MODES else "same_l2"

        if not should_live:
            for link in links:
                self._set_frr_announce_on(link.frr_instance_id, vip.address, announce=False)
                link.advertised = False
                if mode == "routed":
                    self._teardown_dataplane_on(vip, link.frr_instance_id)
                    link.dataplane_ready = False
            vip.advertised = False
            vip.dataplane_ready = False
            vip.last_error = None
            vip.updated_at = datetime.now(UTC)
            self._sync_primary_from_links(vip)
            return

        if mode == "same_l2":
            self._ensure_haproxy_attachment(vip, attach=True)
            vip.attached = True
            vip.dataplane_ready = False
            if bind_frontends:
                self._bind_haproxy_frontends(vip)
            for link in links:
                frr = self._instances.get_instance(link.frr_instance_id)
                link_ok = should_announce and bool(frr and frr_ready_for_announce(frr))
                self._set_frr_announce_on(link.frr_instance_id, vip.address, announce=link_ok)
                link.advertised = link_ok
                link.dataplane_ready = False
                link.updated_at = datetime.now(UTC)
            vip.advertised = any(link.advertised for link in links)
        else:
            vip.attached = False
            backend_ip = None
            if should_announce:
                backend_ip = self._resolve_backend_ip(vip)
                vip.backend_ip = backend_ip
            for link in links:
                frr = self._instances.get_instance(link.frr_instance_id)
                link_ok = should_announce and bool(frr and frr_ready_for_announce(frr))
                if link_ok and backend_ip:
                    self._set_frr_announce_on(link.frr_instance_id, vip.address, announce=True)
                    self._ensure_routed_dataplane_on(vip, link.frr_instance_id, backend_ip=backend_ip)
                    link.advertised = True
                    link.dataplane_ready = True
                else:
                    self._set_frr_announce_on(link.frr_instance_id, vip.address, announce=False)
                    self._teardown_dataplane_on(vip, link.frr_instance_id)
                    link.advertised = False
                    link.dataplane_ready = False
                link.updated_at = datetime.now(UTC)
            vip.advertised = any(link.advertised for link in links)
            vip.dataplane_ready = any(link.dataplane_ready for link in links)

        vip.last_error = None
        vip.updated_at = datetime.now(UTC)
        self._sync_primary_from_links(vip)

    def _links(self, vip: ServiceVip) -> list[ServiceVipLink]:
        if vip.links is not None:
            return list(vip.links)
        return list(
            self._db.scalars(
                select(ServiceVipLink)
                .where(ServiceVipLink.vip_id == vip.id)
                .order_by(ServiceVipLink.created_at)
            )
        )

    def _ensure_links_present(self, vip: ServiceVip) -> None:
        links = self._links(vip)
        if links:
            return
        self._db.add(
            ServiceVipLink(
                vip_id=vip.id,
                frr_instance_id=vip.frr_instance_id,
                network_id=vip.network_id,
                attached=vip.attached,
                dataplane_ready=vip.dataplane_ready,
                advertised=vip.advertised,
            )
        )
        self._db.flush()
        self._db.refresh(vip, attribute_names=["links"])

    def _ensure_primary_link(self, vip: ServiceVip, *, frr_id: str, network_id: str) -> None:
        links = self._links(vip)
        if not links:
            self._db.add(
                ServiceVipLink(
                    vip_id=vip.id,
                    frr_instance_id=frr_id,
                    network_id=network_id,
                )
            )
            self._db.flush()
            self._db.refresh(vip, attribute_names=["links"])
            return
        primary = links[0]
        if primary.frr_instance_id == frr_id and primary.network_id == network_id:
            return
        # Prefer updating primary in place when no duplicate would result.
        clash = next(
            (
                item
                for item in links[1:]
                if item.frr_instance_id == frr_id and item.network_id == network_id
            ),
            None,
        )
        if clash is not None:
            # Drop old primary; clash becomes the primary ordering-wise after recreate.
            self._db.delete(primary)
            self._db.flush()
        else:
            primary.frr_instance_id = frr_id
            primary.network_id = network_id
            primary.updated_at = datetime.now(UTC)
        self._db.flush()
        self._db.expire(vip, ["links"])
        self._db.refresh(vip, attribute_names=["links"])

    def _sync_primary_from_links(self, vip: ServiceVip) -> None:
        links = self._links(vip)
        if not links:
            return
        primary = links[0]
        vip.frr_instance_id = primary.frr_instance_id
        vip.network_id = primary.network_id

    @staticmethod
    def _normalize_link_specs(
        *,
        primary: VipLinkCreate,
        extra: list[VipLinkCreate],
    ) -> list[VipLinkCreate]:
        seen: set[tuple[str, str]] = set()
        result: list[VipLinkCreate] = []
        for spec in [primary, *extra]:
            key = (spec.frr_instance_id, spec.network_id)
            if key in seen:
                continue
            seen.add(key)
            result.append(spec)
        return result

    def _resolve_backend_ip(self, vip: ServiceVip) -> str:
        if vip.backend_ip:
            return normalize_host_ip(vip.backend_ip)
        haproxy = self._instances.get_instance(vip.haproxy_instance_id)
        if haproxy is None:
            raise ValueError(f"HAProxy instance not found: {vip.haproxy_instance_id}")
        attachments = self._instances.list_attachments(haproxy.id)
        # Prefer attachment on any of the VIP link networks, then primary, then any IP.
        link_nets = {link.network_id for link in self._links(vip)} | {vip.network_id}
        on_net = next(
            (
                item
                for item in attachments
                if item.network_id in link_nets and item.ip_address
            ),
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

    def _ensure_routed_dataplane_on(
        self,
        vip: ServiceVip,
        frr_instance_id: str,
        *,
        backend_ip: str,
    ) -> None:
        frr = self._instances.get_instance(frr_instance_id)
        if frr is None or not frr.container_id:
            raise RuntimeError("FRR instance has no container for routed VIP dataplane")
        self._dataplane.ensure(
            container_id=frr.container_id,
            vip_id=vip.id,
            vip_address=vip.address,
            backend_ip=backend_ip,
        )

    def _teardown_dataplane_on(self, vip: ServiceVip, frr_instance_id: str) -> None:
        if vip.mode != "routed":
            return
        frr = self._instances.get_instance(frr_instance_id)
        if frr is None or not frr.container_id:
            return
        self._dataplane.teardown(
            container_id=frr.container_id,
            vip_id=vip.id,
            vip_address=vip.address,
            backend_ip=vip.backend_ip,
        )

    def _teardown_dataplane_all(self, vip: ServiceVip) -> None:
        if vip.mode != "routed":
            vip.dataplane_ready = False
            return
        for link in self._links(vip):
            self._teardown_dataplane_on(vip, link.frr_instance_id)
            link.dataplane_ready = False
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

    def _set_frr_announce_on(self, frr_instance_id: str, address: str, *, announce: bool) -> None:
        frr = self._instances.get_instance(frr_instance_id)
        if frr is None:
            raise ValueError(f"FRR instance not found: {frr_instance_id}")
        config = FrrConfig.from_dict(frr.configuration)
        prefix = vip_announce_prefix(address)
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

    def _resolve_frr_network(
        self,
        frr_id: str,
        network_id: str,
    ) -> tuple[ServiceInstance, Network]:
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
        return frr, network

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
        frr, network = self._resolve_frr_network(frr_id, network_id)
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
