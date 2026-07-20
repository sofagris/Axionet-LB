from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.db.session import get_db
from app.schemas.interfaces import (
    InterfaceRescanResponse,
    PhysicalInterfaceRead,
    PhysicalInterfaceUpdate,
)
from app.services.networking.discovery import InterfaceDiscoveryService
from app.services.networking.sysfs import SysfsInterfaceScanner

router = APIRouter(prefix="/interfaces", tags=["interfaces"])


def get_interface_service(
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> InterfaceDiscoveryService:
    scanner = SysfsInterfaceScanner(settings.host_sysfs_root)
    return InterfaceDiscoveryService(db=db, scanner=scanner)


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


@router.get("/{interface_id}", response_model=PhysicalInterfaceRead)
def get_interface(
    interface_id: str,
    service: InterfaceDiscoveryService = Depends(get_interface_service),
) -> PhysicalInterfaceRead:
    interface = service.get_interface(interface_id)
    if interface is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Interface not found")
    return PhysicalInterfaceRead.model_validate(interface)


@router.patch("/{interface_id}", response_model=PhysicalInterfaceRead)
def update_interface(
    interface_id: str,
    payload: PhysicalInterfaceUpdate,
    service: InterfaceDiscoveryService = Depends(get_interface_service),
    db: Session = Depends(get_db),
) -> PhysicalInterfaceRead:
    interface = service.get_interface(interface_id)
    if interface is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Interface not found")
    updated = service.update_interface(
        interface,
        description=payload.description,
        administrative_state=payload.administrative_state.value
        if payload.administrative_state is not None
        else None,
        exclusive_use=payload.exclusive_use,
    )
    db.commit()
    db.refresh(updated)
    return PhysicalInterfaceRead.model_validate(updated)
