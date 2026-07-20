from __future__ import annotations

import ipaddress
import re

from app.models.network import Network, NetworkType
from app.models.physical_interface import PhysicalInterface
from app.schemas.networks import NetworkCreate, NetworkValidationIssue, NetworkValidationResult

NAME_RE = re.compile(r"^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$")


class NetworkValidator:
    def validate_create(
        self,
        payload: NetworkCreate,
        *,
        existing_networks: list[Network],
        parent: PhysicalInterface | None,
    ) -> NetworkValidationResult:
        issues: list[NetworkValidationIssue] = []

        if not NAME_RE.match(payload.name):
            issues.append(
                NetworkValidationIssue(
                    code="invalid_name",
                    message="Name must start with alphanumeric and contain only [A-Za-z0-9._-]",
                )
            )

        if any(net.name == payload.name for net in existing_networks):
            issues.append(
                NetworkValidationIssue(code="duplicate_name", message="Network name already exists")
            )

        needs_parent = payload.network_type in {
            NetworkType.IPVLAN_L2,
            NetworkType.IPVLAN_L3,
            NetworkType.MACVLAN,
            NetworkType.UNTAGGED_ACCESS,
        }
        if needs_parent and not payload.parent_interface_id:
            issues.append(
                NetworkValidationIssue(
                    code="parent_required",
                    message="parent_interface_id is required for this network type",
                )
            )
        if needs_parent and payload.parent_interface_id and parent is None:
            issues.append(
                NetworkValidationIssue(
                    code="parent_not_found",
                    message="Parent physical interface was not found",
                )
            )

        if payload.network_type == NetworkType.UNTAGGED_ACCESS and payload.vlan_id is not None:
            issues.append(
                NetworkValidationIssue(
                    code="vlan_not_allowed",
                    message="untagged-access networks must not set vlan_id",
                )
            )

        if payload.vlan_id is not None and not (1 <= payload.vlan_id <= 4094):
            issues.append(
                NetworkValidationIssue(
                    code="invalid_vlan",
                    message="vlan_id must be between 1 and 4094",
                )
            )

        if payload.network_type in {NetworkType.IPVLAN_L2, NetworkType.IPVLAN_L3, NetworkType.MACVLAN}:
            if payload.vlan_id is None and payload.network_type != NetworkType.UNTAGGED_ACCESS:
                # vlan optional for ipvlan = untagged on parent; OK
                pass

        if parent is not None and parent.exclusive_use:
            issues.append(
                NetworkValidationIssue(
                    code="parent_exclusive",
                    message="Parent interface is marked exclusive_use",
                )
            )

        if (
            payload.network_type != NetworkType.MANAGEMENT
            and parent is not None
            and parent.is_management
        ):
            issues.append(
                NetworkValidationIssue(
                    code="management_interface_parent",
                    message="Management interface cannot be used as dataplane network parent",
                )
            )

        subnet = self._parse_network(payload.subnet, "subnet", issues)
        if payload.ip_range:
            ip_range = self._parse_network(payload.ip_range, "ip_range", issues)
            if subnet is not None and ip_range is not None and not ip_range.subnet_of(subnet):
                issues.append(
                    NetworkValidationIssue(
                        code="ip_range_outside_subnet",
                        message="ip_range must be within subnet",
                    )
                )

        if payload.gateway:
            try:
                gateway = ipaddress.ip_address(payload.gateway)
            except ValueError:
                issues.append(
                    NetworkValidationIssue(code="invalid_gateway", message="gateway is not a valid IP")
                )
            else:
                if subnet is not None and gateway not in subnet:
                    issues.append(
                        NetworkValidationIssue(
                            code="gateway_outside_subnet",
                            message="gateway must be inside subnet",
                        )
                    )

        if subnet is not None:
            for other in existing_networks:
                if not other.subnet:
                    continue
                try:
                    other_net = ipaddress.ip_network(other.subnet, strict=False)
                except ValueError:
                    continue
                if subnet.overlaps(other_net):
                    issues.append(
                        NetworkValidationIssue(
                            code="overlapping_subnet",
                            message=f"Subnet overlaps existing network '{other.name}' ({other.subnet})",
                        )
                    )

        if (
            payload.vlan_id is not None
            and payload.parent_interface_id
            and any(
                net.parent_interface_id == payload.parent_interface_id
                and net.vlan_id == payload.vlan_id
                for net in existing_networks
            )
        ):
            issues.append(
                NetworkValidationIssue(
                    code="duplicate_vlan_parent",
                    message="A network with this parent interface and VLAN already exists",
                )
            )

        if payload.network_type != NetworkType.MANAGEMENT and parent is not None:
            for net in existing_networks:
                if (
                    net.network_type == NetworkType.MANAGEMENT.value
                    and net.parent_interface_id == parent.id
                ):
                    issues.append(
                        NetworkValidationIssue(
                            code="management_parent",
                            message="Parent interface is used by a management network",
                        )
                    )

        errors = [issue for issue in issues if issue.severity == "error"]
        return NetworkValidationResult(valid=len(errors) == 0, issues=issues)

    def _parse_network(
        self,
        value: str | None,
        field: str,
        issues: list[NetworkValidationIssue],
    ) -> ipaddress.IPv4Network | ipaddress.IPv6Network | None:
        if not value:
            if field == "subnet":
                # bridge/management may omit subnet
                return None
            return None
        try:
            return ipaddress.ip_network(value, strict=False)
        except ValueError:
            issues.append(
                NetworkValidationIssue(code=f"invalid_{field}", message=f"{field} is not a valid CIDR")
            )
            return None
