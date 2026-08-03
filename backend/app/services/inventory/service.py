from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.load_balancer import LoadBalancer
from app.models.placement_domain import PlacementDomain
from app.models.site import Site
from app.schemas.inventory import (
    LoadBalancerCreate,
    LoadBalancerUpdate,
    PlacementDomainCreate,
    PlacementDomainUpdate,
    SiteCreate,
    SiteUpdate,
)
from app.services.networking.bind_env import read_mgmt_bind_ip


class InventoryService:
    def __init__(self, db: Session) -> None:
        self._db = db

    # --- Sites ---

    def list_sites(self) -> list[Site]:
        return list(self._db.scalars(select(Site).order_by(Site.name.asc())).all())

    def get_site(self, site_id: str) -> Site | None:
        return self._db.get(Site, site_id)

    def create_site(self, payload: SiteCreate) -> Site:
        name = payload.name.strip()
        if self._db.scalar(select(Site).where(Site.name == name)) is not None:
            raise ValueError(f"Site name already exists: {name}")
        site = Site(name=name, description=payload.description)
        self._db.add(site)
        self._db.commit()
        self._db.refresh(site)
        return site

    def update_site(self, site: Site, payload: SiteUpdate) -> Site:
        data = payload.model_dump(exclude_unset=True)
        if "name" in data and data["name"] is not None:
            name = data["name"].strip()
            clash = self._db.scalar(select(Site).where(Site.name == name, Site.id != site.id))
            if clash is not None:
                raise ValueError(f"Site name already exists: {name}")
            site.name = name
        if "description" in data:
            site.description = data["description"]
        site.updated_at = datetime.now(UTC)
        self._db.add(site)
        self._db.commit()
        self._db.refresh(site)
        return site

    def delete_site(self, site: Site) -> None:
        self._db.delete(site)
        self._db.commit()

    # --- Placement domains ---

    def list_placement_domains(self) -> list[PlacementDomain]:
        return list(
            self._db.scalars(select(PlacementDomain).order_by(PlacementDomain.name.asc())).all()
        )

    def get_placement_domain(self, domain_id: str) -> PlacementDomain | None:
        return self._db.get(PlacementDomain, domain_id)

    def _validate_site_id(self, site_id: str | None) -> None:
        if site_id is None:
            return
        if self.get_site(site_id) is None:
            raise ValueError(f"Site not found: {site_id}")

    def create_placement_domain(self, payload: PlacementDomainCreate) -> PlacementDomain:
        name = payload.name.strip()
        if self._db.scalar(select(PlacementDomain).where(PlacementDomain.name == name)) is not None:
            raise ValueError(f"Placement domain name already exists: {name}")
        kind = payload.kind
        site_id = payload.site_id if kind == "site" else None
        self._validate_site_id(site_id)
        icon = payload.icon or ("shared" if kind == "shared" else "site")
        domain = PlacementDomain(
            name=name,
            kind=kind,
            description=payload.description,
            icon=icon,
            site_id=site_id,
        )
        self._db.add(domain)
        self._db.commit()
        self._db.refresh(domain)
        return domain

    def update_placement_domain(
        self, domain: PlacementDomain, payload: PlacementDomainUpdate
    ) -> PlacementDomain:
        data = payload.model_dump(exclude_unset=True)
        if "name" in data and data["name"] is not None:
            name = data["name"].strip()
            clash = self._db.scalar(
                select(PlacementDomain).where(
                    PlacementDomain.name == name, PlacementDomain.id != domain.id
                )
            )
            if clash is not None:
                raise ValueError(f"Placement domain name already exists: {name}")
            domain.name = name
        if "kind" in data and data["kind"] is not None:
            domain.kind = data["kind"]
        if "description" in data:
            domain.description = data["description"]
        if "icon" in data:
            domain.icon = data["icon"]
        if "site_id" in data:
            site_id = data["site_id"]
            if domain.kind == "shared":
                site_id = None
            self._validate_site_id(site_id)
            domain.site_id = site_id
        if domain.kind == "shared":
            domain.site_id = None
        domain.updated_at = datetime.now(UTC)
        self._db.add(domain)
        self._db.commit()
        self._db.refresh(domain)
        return domain

    def delete_placement_domain(self, domain: PlacementDomain) -> None:
        self._db.delete(domain)
        self._db.commit()

    def ensure_placement_domain_by_name(
        self,
        name: str,
        *,
        kind: str = "site",
        site_id: str | None = None,
        description: str | None = None,
    ) -> PlacementDomain:
        """Find by case-insensitive name or create. Used by Designer migrate."""
        trimmed = name.strip()
        for domain in self.list_placement_domains():
            if domain.name.strip().lower() == trimmed.lower():
                return domain
        return self.create_placement_domain(
            PlacementDomainCreate(
                name=trimmed,
                kind="shared" if kind == "shared" else "site",
                site_id=site_id,
                description=description,
            )
        )

    # --- Load balancers ---

    def list_load_balancers(self) -> list[LoadBalancer]:
        self.ensure_local_load_balancer()
        return list(
            self._db.scalars(
                select(LoadBalancer).order_by(
                    LoadBalancer.is_local.desc(), LoadBalancer.name.asc()
                )
            ).all()
        )

    def get_load_balancer(self, lb_id: str) -> LoadBalancer | None:
        return self._db.get(LoadBalancer, lb_id)

    def get_local_load_balancer(self) -> LoadBalancer | None:
        return self._db.scalar(select(LoadBalancer).where(LoadBalancer.is_local.is_(True)))

    def ensure_local_load_balancer(self) -> LoadBalancer:
        existing = self.get_local_load_balancer()
        settings = get_settings()
        mgmt_ip = read_mgmt_bind_ip(settings.data_dir)
        if existing is not None:
            # Refresh IP from management bind when empty or outdated default.
            if mgmt_ip and (not existing.ip_address or existing.ip_address != mgmt_ip):
                # Only auto-fill when local IP was never set by user / was empty.
                if not existing.ip_address:
                    existing.ip_address = mgmt_ip
                    existing.updated_at = datetime.now(UTC)
                    self._db.add(existing)
                    self._db.commit()
                    self._db.refresh(existing)
            return existing

        lb = LoadBalancer(
            name=settings.app_name.strip() or "Axionet LB",
            description="This appliance (local Axionet-LB)",
            ip_address=mgmt_ip,
            is_local=True,
        )
        self._db.add(lb)
        self._db.commit()
        self._db.refresh(lb)
        return lb

    def create_load_balancer(self, payload: LoadBalancerCreate) -> LoadBalancer:
        if payload.is_local:
            raise ValueError("Cannot create another local load balancer; use the existing local row")
        self._validate_site_id(payload.site_id)
        lb = LoadBalancer(
            name=payload.name.strip(),
            description=payload.description,
            ip_address=payload.ip_address.strip() if payload.ip_address else None,
            site_id=payload.site_id,
            is_local=False,
        )
        self._db.add(lb)
        self._db.commit()
        self._db.refresh(lb)
        return lb

    def update_load_balancer(self, lb: LoadBalancer, payload: LoadBalancerUpdate) -> LoadBalancer:
        data = payload.model_dump(exclude_unset=True)
        if "name" in data and data["name"] is not None:
            lb.name = data["name"].strip()
        if "description" in data:
            lb.description = data["description"]
        if "ip_address" in data:
            raw = data["ip_address"]
            lb.ip_address = raw.strip() if isinstance(raw, str) and raw.strip() else None
        if "site_id" in data:
            self._validate_site_id(data["site_id"])
            lb.site_id = data["site_id"]
        lb.updated_at = datetime.now(UTC)
        self._db.add(lb)
        self._db.commit()
        self._db.refresh(lb)
        return lb

    def delete_load_balancer(self, lb: LoadBalancer) -> None:
        if lb.is_local:
            raise ValueError("Cannot delete the local load balancer")
        self._db.delete(lb)
        self._db.commit()
