from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.db.session import get_db
from app.schemas.interfaces import (
    InterfaceRescanResponse,
    PendingChangeRead,
    PhysicalInterfaceApplyResult,
    PhysicalInterfaceRead,
    PhysicalInterfaceUpdate,
    PromoteManagementResult,
)
from app.services.audit.service import AuditService
from app.services.networking.discovery import InterfaceDiscoveryService
from app.services.networking.host import HostNetworkAdapter
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


@router.get("", response_model=list[PhysicalInterfaceRead])
def list_interfaces(
    service: InterfaceDiscoveryService = Depends(get_interface_service),
) -> list[PhysicalInterfaceRead]:
    return [PhysicalInterfaceRead.model_validate(item) for item in service.list_interfaces()]


@router.post("/rescan", response_model=InterfaceRescanResponse)
def rescan_interfaces(
    service: InterfaceDiscoveryService = Depends(get_interface_service),
) -> InterfaceRescanResponse:
    interfaces, stats = service.rescan()
    return InterfaceRescanResponse(
        discovered=stats["discovered"],
        created=stats["created"],
        updated=stats["updated"],
        removed=stats["removed"],
        interfaces=[PhysicalInterfaceRead.model_validate(item) for item in interfaces],
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
) -> PhysicalInterfaceRead:
    interface = service.get_interface(interface_id)
    if interface is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Interface not found")
    return PhysicalInterfaceRead.model_validate(interface)


@router.patch("/{interface_id}", response_model=PhysicalInterfaceApplyResult)
def update_interface(
    interface_id: str,
    payload: PhysicalInterfaceUpdate,
    service: InterfaceDiscoveryService = Depends(get_interface_service),
    mutation: InterfaceMutationService = Depends(get_mutation_service),
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
    result.interface = PhysicalInterfaceRead.model_validate(interface)
    return result


@router.post("/{interface_id}/promote-management", response_model=PromoteManagementResult)
def promote_management(
    interface_id: str,
    service: InterfaceDiscoveryService = Depends(get_interface_service),
    mutation: InterfaceMutationService = Depends(get_mutation_service),
    db: Session = Depends(get_db),
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
    result.interface = PhysicalInterfaceRead.model_validate(interface)
    return result
