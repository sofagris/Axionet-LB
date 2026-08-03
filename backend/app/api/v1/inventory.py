from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.core.security import require_roles
from app.db.session import get_db
from app.models.user import User
from app.schemas.inventory import (
    LoadBalancerCreate,
    LoadBalancerRead,
    LoadBalancerUpdate,
    PlacementDomainCreate,
    PlacementDomainRead,
    PlacementDomainUpdate,
    SiteCreate,
    SiteRead,
    SiteUpdate,
)
from app.services.inventory.service import InventoryService

sites_router = APIRouter(prefix="/sites", tags=["sites"])
placement_domains_router = APIRouter(prefix="/placement-domains", tags=["placement-domains"])
load_balancers_router = APIRouter(prefix="/load-balancers", tags=["load-balancers"])


def get_inventory_service(db: Session = Depends(get_db)) -> InventoryService:
    return InventoryService(db=db)


# --- Sites ---


@sites_router.get("", response_model=list[SiteRead])
def list_sites(service: InventoryService = Depends(get_inventory_service)) -> list[SiteRead]:
    return [SiteRead.model_validate(item) for item in service.list_sites()]


@sites_router.post("", response_model=SiteRead, status_code=status.HTTP_201_CREATED)
def create_site(
    payload: SiteCreate,
    _actor: User = Depends(require_roles("admin")),
    service: InventoryService = Depends(get_inventory_service),
) -> SiteRead:
    try:
        site = service.create_site(payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return SiteRead.model_validate(site)


@sites_router.get("/{site_id}", response_model=SiteRead)
def get_site(
    site_id: str,
    service: InventoryService = Depends(get_inventory_service),
) -> SiteRead:
    site = service.get_site(site_id)
    if site is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Site not found")
    return SiteRead.model_validate(site)


@sites_router.patch("/{site_id}", response_model=SiteRead)
def update_site(
    site_id: str,
    payload: SiteUpdate,
    _actor: User = Depends(require_roles("admin")),
    service: InventoryService = Depends(get_inventory_service),
) -> SiteRead:
    site = service.get_site(site_id)
    if site is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Site not found")
    try:
        updated = service.update_site(site, payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return SiteRead.model_validate(updated)


@sites_router.delete("/{site_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_site(
    site_id: str,
    _actor: User = Depends(require_roles("admin")),
    service: InventoryService = Depends(get_inventory_service),
) -> Response:
    site = service.get_site(site_id)
    if site is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Site not found")
    service.delete_site(site)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# --- Placement domains ---


@placement_domains_router.get("", response_model=list[PlacementDomainRead])
def list_placement_domains(
    service: InventoryService = Depends(get_inventory_service),
) -> list[PlacementDomainRead]:
    return [PlacementDomainRead.model_validate(item) for item in service.list_placement_domains()]


@placement_domains_router.post(
    "", response_model=PlacementDomainRead, status_code=status.HTTP_201_CREATED
)
def create_placement_domain(
    payload: PlacementDomainCreate,
    service: InventoryService = Depends(get_inventory_service),
) -> PlacementDomainRead:
    try:
        domain = service.create_placement_domain(payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return PlacementDomainRead.model_validate(domain)


@placement_domains_router.get("/{domain_id}", response_model=PlacementDomainRead)
def get_placement_domain(
    domain_id: str,
    service: InventoryService = Depends(get_inventory_service),
) -> PlacementDomainRead:
    domain = service.get_placement_domain(domain_id)
    if domain is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Placement domain not found")
    return PlacementDomainRead.model_validate(domain)


@placement_domains_router.patch("/{domain_id}", response_model=PlacementDomainRead)
def update_placement_domain(
    domain_id: str,
    payload: PlacementDomainUpdate,
    service: InventoryService = Depends(get_inventory_service),
) -> PlacementDomainRead:
    domain = service.get_placement_domain(domain_id)
    if domain is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Placement domain not found")
    try:
        updated = service.update_placement_domain(domain, payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return PlacementDomainRead.model_validate(updated)


@placement_domains_router.delete("/{domain_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_placement_domain(
    domain_id: str,
    service: InventoryService = Depends(get_inventory_service),
) -> Response:
    domain = service.get_placement_domain(domain_id)
    if domain is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Placement domain not found")
    service.delete_placement_domain(domain)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# --- Load balancers ---


@load_balancers_router.get("", response_model=list[LoadBalancerRead])
def list_load_balancers(
    service: InventoryService = Depends(get_inventory_service),
) -> list[LoadBalancerRead]:
    return [LoadBalancerRead.model_validate(item) for item in service.list_load_balancers()]


@load_balancers_router.post(
    "", response_model=LoadBalancerRead, status_code=status.HTTP_201_CREATED
)
def create_load_balancer(
    payload: LoadBalancerCreate,
    _actor: User = Depends(require_roles("admin")),
    service: InventoryService = Depends(get_inventory_service),
) -> LoadBalancerRead:
    try:
        lb = service.create_load_balancer(payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return LoadBalancerRead.model_validate(lb)


@load_balancers_router.get("/{lb_id}", response_model=LoadBalancerRead)
def get_load_balancer(
    lb_id: str,
    service: InventoryService = Depends(get_inventory_service),
) -> LoadBalancerRead:
    lb = service.get_load_balancer(lb_id)
    if lb is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Load balancer not found")
    return LoadBalancerRead.model_validate(lb)


@load_balancers_router.patch("/{lb_id}", response_model=LoadBalancerRead)
def update_load_balancer(
    lb_id: str,
    payload: LoadBalancerUpdate,
    _actor: User = Depends(require_roles("admin")),
    service: InventoryService = Depends(get_inventory_service),
) -> LoadBalancerRead:
    lb = service.get_load_balancer(lb_id)
    if lb is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Load balancer not found")
    try:
        updated = service.update_load_balancer(lb, payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return LoadBalancerRead.model_validate(updated)


@load_balancers_router.delete("/{lb_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_load_balancer(
    lb_id: str,
    _actor: User = Depends(require_roles("admin")),
    service: InventoryService = Depends(get_inventory_service),
) -> Response:
    lb = service.get_load_balancer(lb_id)
    if lb is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Load balancer not found")
    try:
        service.delete_load_balancer(lb)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return Response(status_code=status.HTTP_204_NO_CONTENT)
