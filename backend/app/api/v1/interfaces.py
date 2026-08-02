from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.db.session import get_db
from app.schemas.interfaces import (
    InterfaceRescanResponse,
    LldpNeighborRead,
    LldpStatusRead,
    LldpUpdate,
    PendingChangeRead,
    PhysicalInterfaceApplyResult,
    PhysicalInterfaceRead,
    PhysicalInterfaceUpdate,
    PromoteManagementResult,
)
from app.services.audit.service import AuditService
from app.services.networking.discovery import InterfaceDiscoveryService
from app.services.networking.host import HostNetworkAdapter, HostNetworkError
from app.services.networking.mutation import InterfaceMutationService
from app.services.networking.pending_runtime import get_pending_store
from app.services.networking.safety import InterfaceSafetyError
from app.services.networking.sysfs import SysfsInterfaceScanner

router = APIRouter(prefix="/interfaces", tags=["interfaces"])


def get_interface_service(
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> InterfaceDiscoveryService:
    scanner = SysfsInterfaceScanner(settings.host_sysfs_root)
    return InterfaceDiscoveryService(db=db, scanner=scanner)


def get_host_net(settings: Settings = Depends(get_settings)) -> HostNetworkAdapter:
    return HostNetworkAdapter(use_host_nsenter=settings.host_net_nsenter)


def get_mutation_service(
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
    discovery: InterfaceDiscoveryService = Depends(get_interface_service),
    host_net: HostNetworkAdapter = Depends(get_host_net),
) -> InterfaceMutationService:
    return InterfaceMutationService(
        db=db,
        discovery=discovery,
        host_net=host_net,
        pending=get_pending_store(),
        data_dir=settings.data_dir,
    )


def _enrich_interface(
    interface: PhysicalInterfaceRead,
    *,
    port_modes: dict[str, str] | None = None,
) -> PhysicalInterfaceRead:
    modes = port_modes if port_modes is not None else {}
    mode = modes.get(interface.name)
    data = interface.model_dump()
    data["lldp_mode"] = mode
    return PhysicalInterfaceRead.model_validate(data)


def _lldp_status(host_net: HostNetworkAdapter) -> LldpStatusRead:
    status = host_net.lldp_daemon_status()
    neighbors = [
        LldpNeighborRead(
            local_port=item.local_port,
            chassis_name=item.chassis_name,
            chassis_id=item.chassis_id,
            port_id=item.port_id,
            port_description=item.port_description,
            system_description=item.system_description,
            mgmt_ips=list(item.mgmt_ips),
        )
        for item in host_net.list_lldp_neighbors()
    ]
    port_modes = host_net.get_lldp_port_modes()
    return LldpStatusRead(
        installed=status.installed,
        enabled=status.enabled,
        active=status.active,
        detail=status.detail,
        neighbors=neighbors,
        port_modes=port_modes,
    )


@router.get("", response_model=list[PhysicalInterfaceRead])
def list_interfaces(
    service: InterfaceDiscoveryService = Depends(get_interface_service),
    host_net: HostNetworkAdapter = Depends(get_host_net),
) -> list[PhysicalInterfaceRead]:
    port_modes = host_net.get_lldp_port_modes()
    return [
        _enrich_interface(PhysicalInterfaceRead.model_validate(item), port_modes=port_modes)
        for item in service.list_interfaces()
    ]


@router.get("/lldp", response_model=LldpStatusRead)
def get_lldp_status(
    host_net: HostNetworkAdapter = Depends(get_host_net),
) -> LldpStatusRead:
    return _lldp_status(host_net)


@router.put("/lldp", response_model=LldpStatusRead)
def update_lldp(
    payload: LldpUpdate,
    host_net: HostNetworkAdapter = Depends(get_host_net),
    db: Session = Depends(get_db),
) -> LldpStatusRead:
    try:
        host_net.set_lldp_daemon(enabled=payload.enabled)
    except HostNetworkError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    AuditService(db).record(
        event_type="interface.lldp",
        resource_type="lldp",
        resource_id="host",
        payload={"enabled": payload.enabled},
        commit=True,
    )
    return _lldp_status(host_net)


@router.post("/rescan", response_model=InterfaceRescanResponse)
def rescan_interfaces(
    service: InterfaceDiscoveryService = Depends(get_interface_service),
    host_net: HostNetworkAdapter = Depends(get_host_net),
) -> InterfaceRescanResponse:
    interfaces, stats = service.rescan()
    port_modes = host_net.get_lldp_port_modes()
    return InterfaceRescanResponse(
        discovered=stats["discovered"],
        created=stats["created"],
        updated=stats["updated"],
        removed=stats["removed"],
        interfaces=[
            _enrich_interface(PhysicalInterfaceRead.model_validate(item), port_modes=port_modes)
            for item in interfaces
        ],
    )


@router.post("/confirm-change/{change_id}", response_model=PendingChangeRead)
def confirm_interface_change(
    change_id: str,
    mutation: InterfaceMutationService = Depends(get_mutation_service),
) -> PendingChangeRead:
    try:
        change = mutation.confirm_change(change_id)
    except InterfaceSafetyError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=exc.message) from exc
    return PendingChangeRead(
        id=change.id,
        interface_id=change.interface_id,
        interface_name=change.interface_name,
        rollback_at=change.rollback_at,
        confirmed=change.confirmed,
    )


@router.get("/{interface_id}", response_model=PhysicalInterfaceRead)
def get_interface(
    interface_id: str,
    service: InterfaceDiscoveryService = Depends(get_interface_service),
    host_net: HostNetworkAdapter = Depends(get_host_net),
) -> PhysicalInterfaceRead:
    interface = service.get_interface(interface_id)
    if interface is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Interface not found")
    port_modes = host_net.get_lldp_port_modes()
    return _enrich_interface(PhysicalInterfaceRead.model_validate(interface), port_modes=port_modes)


@router.patch("/{interface_id}", response_model=PhysicalInterfaceApplyResult)
def update_interface(
    interface_id: str,
    payload: PhysicalInterfaceUpdate,
    service: InterfaceDiscoveryService = Depends(get_interface_service),
    mutation: InterfaceMutationService = Depends(get_mutation_service),
    host_net: HostNetworkAdapter = Depends(get_host_net),
    db: Session = Depends(get_db),
) -> PhysicalInterfaceApplyResult:
    interface = service.get_interface(interface_id)
    if interface is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Interface not found")
    live_fields = any(
        [
            payload.mtu is not None,
            payload.administrative_state is not None,
            payload.speed_mbps is not None,
            payload.speed_autoneg is True,
            payload.lldp_mode is not None,
        ]
    )
    try:
        if live_fields:
            result = mutation.apply_update(interface, payload)
        else:
            updated = service.update_interface(
                interface,
                description=payload.description,
                exclusive_use=payload.exclusive_use,
            )
            result = PhysicalInterfaceApplyResult(
                interface=PhysicalInterfaceRead.model_validate(updated),
            )
    except InterfaceSafetyError as exc:
        code = status.HTTP_400_BAD_REQUEST
        if exc.code == "confirm_required":
            code = status.HTTP_409_CONFLICT
        raise HTTPException(status_code=code, detail={"code": exc.code, "message": exc.message}) from exc
    db.commit()
    db.refresh(interface)
    port_modes = host_net.get_lldp_port_modes()
    result.interface = _enrich_interface(
        PhysicalInterfaceRead.model_validate(interface),
        port_modes=port_modes,
    )
    return result


@router.post("/{interface_id}/promote-management", response_model=PromoteManagementResult)
def promote_management(
    interface_id: str,
    service: InterfaceDiscoveryService = Depends(get_interface_service),
    mutation: InterfaceMutationService = Depends(get_mutation_service),
    host_net: HostNetworkAdapter = Depends(get_host_net),
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> PromoteManagementResult:
    interface = service.get_interface(interface_id)
    if interface is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Interface not found")
    try:
        result = mutation.promote_management(interface)
    except InterfaceSafetyError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": exc.code, "message": exc.message},
        ) from exc
    AuditService(db).record(
        event_type="interface.promote_management",
        resource_type="interface",
        resource_id=interface.id,
        payload={"name": interface.name, "bind_ip": result.management_bind_ip},
        commit=False,
    )
    db.commit()
    db.refresh(interface)

    # Ensure macvlan management network on this NIC for Catalog services (Keycloak, …).
    try:
        from app.services.docker.client import create_docker_adapter
        from app.services.networking.networks import NetworkService

        net_svc = NetworkService(
            db=db,
            docker=create_docker_adapter(settings),
            host_net=host_net,
        )
        mgmt_net = net_svc.ensure_management_network(interface)
        if mgmt_net is not None:
            result.management_network_id = mgmt_net.id
            result.management_network_name = mgmt_net.name
    except Exception:  # noqa: BLE001 — promote must succeed even if network ensure fails
        import logging

        logging.getLogger(__name__).exception(
            "Failed to ensure management network after promote of %s",
            interface.name,
        )

    port_modes = host_net.get_lldp_port_modes()
    result.interface = _enrich_interface(
        PhysicalInterfaceRead.model_validate(interface),
        port_modes=port_modes,
    )
    return result
