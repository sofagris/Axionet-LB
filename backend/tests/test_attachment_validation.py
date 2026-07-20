import ipaddress

import pytest
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.db.base import Base
from app.models.network import Network, NetworkType
from app.models.network_attachment import NetworkAttachment
from app.models.service_instance import ActualState, DesiredState, HealthStatus, ServiceInstance
from app.schemas.instances import NetworkAttachmentCreate
from app.services.instances.attachments import validate_network_attachments


@pytest.fixture()
def db() -> Session:
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    session = sessionmaker(bind=engine, autoflush=False, autocommit=False)()
    session.add(
        Network(
            id="net-1",
            name="lab-bridge",
            network_type=NetworkType.BRIDGE.value,
            subnet="172.30.60.0/24",
            gateway="172.30.60.1",
            docker_network_id="docker-net-1",
            docker_network_name="ax-net-net-1",
            enabled=True,
        )
    )
    session.commit()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)


def test_validate_ip_outside_subnet(db: Session) -> None:
    networks = list(db.scalars(select(Network)))
    with pytest.raises(ValueError, match="outside subnet"):
        validate_network_attachments(
            db,
            [NetworkAttachmentCreate(network_id="net-1", ip_address="10.0.0.8")],
            networks=networks,
        )


def test_validate_duplicate_ip_across_instances(db: Session) -> None:
    networks = list(db.scalars(select(Network)))
    instance = ServiceInstance(
        id="inst-1",
        name="edge-a",
        service_type="haproxy",
        desired_state=DesiredState.STOPPED.value,
        actual_state=ActualState.STOPPED.value,
        image="haproxy:3.2.6",
        image_version="3.2.6",
        configuration={},
        health_status=HealthStatus.UNKNOWN.value,
    )
    db.add(instance)
    db.flush()
    db.add(
        NetworkAttachment(
            service_instance_id=instance.id,
            network_id="net-1",
            ip_address="172.30.60.10",
        )
    )
    db.commit()

    with pytest.raises(ValueError, match="already assigned"):
        validate_network_attachments(
            db,
            [NetworkAttachmentCreate(network_id="net-1", ip_address="172.30.60.10")],
            networks=networks,
        )


def test_validate_accepts_unique_ip_in_subnet(db: Session) -> None:
    networks = list(db.scalars(select(Network)))
    validate_network_attachments(
        db,
        [NetworkAttachmentCreate(network_id="net-1", ip_address="172.30.60.20")],
        networks=networks,
    )
    assert ipaddress.ip_address("172.30.60.20") in ipaddress.ip_network("172.30.60.0/24")
