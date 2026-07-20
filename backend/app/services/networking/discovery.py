from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.physical_interface import PhysicalInterface
from app.services.networking.sysfs import DiscoveredInterface, SysfsInterfaceScanner


class InterfaceRepository:
    def __init__(self, db: Session) -> None:
        self._db = db

    def list_all(self) -> list[PhysicalInterface]:
        stmt = select(PhysicalInterface).order_by(PhysicalInterface.name)
        return list(self._db.scalars(stmt))

    def get(self, interface_id: str) -> PhysicalInterface | None:
        return self._db.get(PhysicalInterface, interface_id)

    def get_by_name(self, name: str) -> PhysicalInterface | None:
        stmt = select(PhysicalInterface).where(PhysicalInterface.name == name)
        return self._db.scalars(stmt).first()

    def add(self, interface: PhysicalInterface) -> PhysicalInterface:
        self._db.add(interface)
        self._db.flush()
        return interface

    def delete(self, interface: PhysicalInterface) -> None:
        self._db.delete(interface)
        self._db.flush()


class InterfaceDiscoveryService:
    def __init__(self, db: Session, scanner: SysfsInterfaceScanner) -> None:
        self._db = db
        self._repo = InterfaceRepository(db)
        self._scanner = scanner

    def list_interfaces(self) -> list[PhysicalInterface]:
        return self._repo.list_all()

    def get_interface(self, interface_id: str) -> PhysicalInterface | None:
        return self._repo.get(interface_id)

    def update_interface(
        self,
        interface: PhysicalInterface,
        *,
        description: str | None = None,
        administrative_state: str | None = None,
        exclusive_use: bool | None = None,
    ) -> PhysicalInterface:
        if description is not None:
            interface.description = description
        if administrative_state is not None:
            interface.administrative_state = administrative_state
        if exclusive_use is not None:
            interface.exclusive_use = exclusive_use
        interface.updated_at = datetime.now(UTC)
        self._db.flush()
        return interface

    def rescan(self) -> tuple[list[PhysicalInterface], dict[str, int]]:
        discovered = self._scanner.scan()
        existing = {item.name: item for item in self._repo.list_all()}
        seen: set[str] = set()
        created = 0
        updated = 0

        for item in discovered:
            seen.add(item.name)
            current = existing.get(item.name)
            if current is None:
                self._repo.add(self._from_discovered(item))
                created += 1
            else:
                self._apply_discovered(current, item)
                updated += 1

        removed = 0
        for name, interface in existing.items():
            if name not in seen:
                self._repo.delete(interface)
                removed += 1

        self._db.commit()
        interfaces = self._repo.list_all()
        stats = {
            "discovered": len(discovered),
            "created": created,
            "updated": updated,
            "removed": removed,
        }
        return interfaces, stats

    def _from_discovered(self, item: DiscoveredInterface) -> PhysicalInterface:
        now = datetime.now(UTC)
        return PhysicalInterface(
            name=item.name,
            mac_address=item.mac_address,
            pci_address=item.pci_address,
            numa_node=item.numa_node,
            speed_mbps=item.speed_mbps,
            driver=item.driver,
            mtu=item.mtu,
            link_state=item.link_state,
            discovered_at=now,
            updated_at=now,
        )

    def _apply_discovered(self, interface: PhysicalInterface, item: DiscoveredInterface) -> None:
        interface.mac_address = item.mac_address
        interface.pci_address = item.pci_address
        interface.numa_node = item.numa_node
        interface.speed_mbps = item.speed_mbps
        interface.driver = item.driver
        interface.mtu = item.mtu
        interface.link_state = item.link_state
        interface.updated_at = datetime.now(UTC)
