from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.db.session import get_db
from app.models.network import NetworkType
from app.schemas.networks import (
    NetworkCreate,
    NetworkRead,
    NetworkUpdate,
    NetworkValidationResult,
)
from app.services.audit.service import AuditService
from app.services.docker.client import DockerClientAdapter, create_docker_adapter
from app.services.networking.host import HostNetworkAdapter
from app.services.networking.networks import NetworkService

router = APIRouter(prefix="/networks", tags=["networks"])


def get_docker_adapter(settings: Settings = Depends(get_settings)) -> DockerClientAdapter:
    return create_docker_adapter(settings)


def get_host_net_adapter(settings: Settings = Depends(get_settings)) -> HostNetworkAdapter:
    return HostNetworkAdapter(use_host_nsenter=settings.host_net_nsenter)


def get_network_service(
    db: Session = Depends(get_db),
    docker: DockerClientAdapter = Depends(get_docker_adapter),
    host_net: HostNetworkAdapter = Depends(get_host_net_adapter),
) -> NetworkService:
    return NetworkService(db=db, docker=docker, host_net=host_net)


def _to_read(network_tuple: tuple) -> NetworkRead:
    network, docker_exists = network_tuple
    data = NetworkRead.model_validate(network)
    return data.model_copy(update={"docker_exists": docker_exists})


@router.get("", response_model=list[NetworkRead])
def list_networks(service: NetworkService = Depends(get_network_service)) -> list[NetworkRead]:
    return [_to_read(item) for item in service.list_networks()]


@router.post("", response_model=NetworkRead, status_code=status.HTTP_201_CREATED)
def create_network(
    payload: NetworkCreate,
    service: NetworkService = Depends(get_network_service),
    db: Session = Depends(get_db),
) -> NetworkRead:
    try:
        network = service.create_network(payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc
    AuditService(db).record(
        event_type="network.create",
        resource_type="network",
        resource_id=network.id,
        payload={"name": network.name, "vlan_id": network.vlan_id},
        commit=True,
    )
    found = service.get_network(network.id)
    assert found is not None
    return _to_read(found)


@router.post("/validate", response_model=NetworkValidationResult)
def validate_network_payload(
    payload: NetworkCreate,
    service: NetworkService = Depends(get_network_service),
) -> NetworkValidationResult:
    return service.validate_create(payload)


@router.get("/{network_id}", response_model=NetworkRead)
def get_network(
    network_id: str,
    service: NetworkService = Depends(get_network_service),
) -> NetworkRead:
    found = service.get_network(network_id)
    if found is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Network not found")
    return _to_read(found)


@router.patch("/{network_id}", response_model=NetworkRead)
def update_network(
    network_id: str,
    payload: NetworkUpdate,
    service: NetworkService = Depends(get_network_service),
) -> NetworkRead:
    found = service.get_network(network_id)
    if found is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Network not found")
    network, _ = found
    updated = service.update_network(network, payload)
    refreshed = service.get_network(updated.id)
    assert refreshed is not None
    return _to_read(refreshed)


@router.delete("/{network_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_network(
    network_id: str,
    service: NetworkService = Depends(get_network_service),
    db: Session = Depends(get_db),
) -> None:
    found = service.get_network(network_id)
    if found is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Network not found")
    network, _ = found
    name = network.name
    try:
        service.delete_network(network)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc
    AuditService(db).record(
        event_type="network.delete",
        resource_type="network",
        resource_id=network_id,
        payload={"name": name},
        commit=True,
    )


@router.post("/{network_id}/validate", response_model=NetworkValidationResult)
def validate_existing_network(
    network_id: str,
    service: NetworkService = Depends(get_network_service),
) -> NetworkValidationResult:
    found = service.get_network(network_id)
    if found is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Network not found")
    network, docker_exists = found
    issues = []
    if network.enabled and not docker_exists:
        from app.schemas.networks import NetworkValidationIssue

        issues.append(
            NetworkValidationIssue(
                code="docker_missing",
                message="Enabled network has no corresponding Docker network",
                severity="error",
            )
        )
    if network.last_error:
        from app.schemas.networks import NetworkValidationIssue

        issues.append(
            NetworkValidationIssue(
                code="last_error",
                message=network.last_error,
                severity="error",
            )
        )
    # Structural re-check without self collisions
    payload = NetworkCreate(
        name=f"__validate_{network.id}",
        network_type=NetworkType(network.network_type),
        parent_interface_id=network.parent_interface_id,
        vlan_id=network.vlan_id,
        subnet=network.subnet,
        gateway=network.gateway,
        ip_range=network.ip_range,
        mtu=network.mtu,
        enabled=network.enabled,
    )
    structural = service.validate_create(payload)
    for issue in structural.issues:
        if issue.code in {"duplicate_name", "overlapping_subnet", "duplicate_vlan_parent"}:
            continue
        issues.append(issue)
    return NetworkValidationResult(
        valid=all(issue.severity != "error" for issue in issues),
        issues=issues,
    )
