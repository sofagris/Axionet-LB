from app.models.network import Network, NetworkType
from app.models.physical_interface import PhysicalInterface
from app.schemas.networks import NetworkCreate
from app.services.networking.validation import NetworkValidator


def test_validate_ipvlan_requires_parent() -> None:
    validator = NetworkValidator()
    result = validator.validate_create(
        NetworkCreate(
            name="svc-vlan100",
            network_type=NetworkType.IPVLAN_L2,
            vlan_id=100,
            subnet="10.100.0.0/24",
            gateway="10.100.0.1",
        ),
        existing_networks=[],
        parent=None,
    )
    assert result.valid is False
    assert any(issue.code == "parent_required" for issue in result.issues)


def test_validate_overlapping_subnet() -> None:
    validator = NetworkValidator()
    existing = [
        Network(
            id="a",
            name="existing",
            network_type=NetworkType.BRIDGE.value,
            subnet="10.100.0.0/24",
            enabled=True,
        )
    ]
    parent = PhysicalInterface(id="ifc-1", name="eth0")
    result = validator.validate_create(
        NetworkCreate(
            name="overlap",
            network_type=NetworkType.IPVLAN_L2,
            parent_interface_id="ifc-1",
            vlan_id=100,
            subnet="10.100.0.0/25",
            gateway="10.100.0.1",
        ),
        existing_networks=existing,
        parent=parent,
    )
    assert result.valid is False
    assert any(issue.code == "overlapping_subnet" for issue in result.issues)


def test_validate_gateway_must_be_in_subnet() -> None:
    validator = NetworkValidator()
    parent = PhysicalInterface(id="ifc-1", name="eth0")
    result = validator.validate_create(
        NetworkCreate(
            name="bad-gw",
            network_type=NetworkType.BRIDGE,
            subnet="10.0.0.0/24",
            gateway="10.1.0.1",
            parent_interface_id=None,
        ),
        existing_networks=[],
        parent=parent,
    )
    # bridge without parent is fine; gateway check still applies
    assert result.valid is False
    assert any(issue.code == "gateway_outside_subnet" for issue in result.issues)


def test_validate_bridge_ok() -> None:
    validator = NetworkValidator()
    result = validator.validate_create(
        NetworkCreate(
            name="control-bridge",
            network_type=NetworkType.BRIDGE,
            subnet="172.30.0.0/24",
            gateway="172.30.0.1",
        ),
        existing_networks=[],
        parent=None,
    )
    assert result.valid is True
