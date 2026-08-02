import pytest

from app.models.network import Network, NetworkType
from app.plugins.keycloak.networks import validate_keycloak_networks
from app.plugins.keycloak.schemas import KeycloakConfig
from app.schemas.instances import NetworkAttachmentCreate


def test_mgmt_requires_management_network() -> None:
    nets = [
        Network(
            id="n1",
            name="app-net",
            network_type=NetworkType.BRIDGE.value,
            docker_network_id="d1",
            enabled=True,
        )
    ]
    attachments = [NetworkAttachmentCreate(network_id="n1", ip_address="10.0.0.10")]
    with pytest.raises(ValueError, match="management"):
        validate_keycloak_networks("keycloak-mgmt", nets, attachments)


def test_mgmt_accepts_management_network() -> None:
    nets = [
        Network(
            id="n1",
            name="mgmt",
            network_type=NetworkType.MANAGEMENT.value,
            docker_network_id="d1",
            enabled=True,
        )
    ]
    attachments = [NetworkAttachmentCreate(network_id="n1", ip_address="10.0.0.10")]
    validate_keycloak_networks("keycloak-mgmt", nets, attachments)


def test_apps_allows_bridge() -> None:
    nets = [
        Network(
            id="n1",
            name="app-net",
            network_type=NetworkType.BRIDGE.value,
            docker_network_id="d1",
            enabled=True,
        )
    ]
    attachments = [NetworkAttachmentCreate(network_id="n1", ip_address="10.0.0.10")]
    validate_keycloak_networks("keycloak-apps", nets, attachments)


def test_keycloak_requires_attachment() -> None:
    with pytest.raises(ValueError, match="at least one"):
        validate_keycloak_networks("keycloak-mgmt", [], [])


def test_apply_network_hints_sets_hostname() -> None:
    from app.plugins.keycloak.plugin import KeycloakMgmtPlugin

    plugin = KeycloakMgmtPlugin()
    cfg = plugin.apply_network_hints({}, ["192.168.50.40"])
    assert KeycloakConfig.from_dict(cfg).hostname == "192.168.50.40"
