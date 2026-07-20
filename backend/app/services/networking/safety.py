from __future__ import annotations

from dataclasses import dataclass

from app.models.physical_interface import AdministrativeState, LinkState, PhysicalInterface
from app.schemas.interfaces import PhysicalInterfaceUpdate


class InterfaceSafetyError(ValueError):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.message = message


@dataclass(frozen=True, slots=True)
class SafetyDecision:
    requires_confirm: bool
    requires_pending_rollback: bool
    reasons: tuple[str, ...]


class InterfaceSafetyService:
    """Hard rules so control-plane access cannot be cut by accident."""

    def evaluate_update(
        self,
        interface: PhysicalInterface,
        payload: PhysicalInterfaceUpdate,
    ) -> SafetyDecision:
        reasons: list[str] = []
        requires_confirm = False
        requires_pending = False

        disabling = (
            payload.administrative_state == AdministrativeState.DISABLED
            and interface.administrative_state != AdministrativeState.DISABLED.value
        )
        if disabling:
            if interface.is_management:
                raise InterfaceSafetyError(
                    "mgmt_admin_down_forbidden",
                    "Cannot disable the management interface",
                )
            requires_confirm = True
            requires_pending = True
            reasons.append("administrative_state=disabled")

        if payload.mtu is not None and payload.mtu != interface.mtu:
            if payload.mtu < 1280:
                requires_confirm = True
                reasons.append("mtu_below_1280")
                if not interface.is_management:
                    requires_pending = True
            elif interface.is_management:
                requires_confirm = True
                reasons.append("mgmt_mtu_change")

        speed_change = payload.speed_mbps is not None or payload.speed_autoneg is True
        if speed_change:
            requires_confirm = True
            reasons.append("speed_change")
            if not interface.is_management:
                requires_pending = True

        if requires_confirm and not payload.confirm:
            raise InterfaceSafetyError(
                "confirm_required",
                "This change requires confirm=true: " + ", ".join(reasons),
            )

        return SafetyDecision(
            requires_confirm=requires_confirm,
            requires_pending_rollback=requires_pending,
            reasons=tuple(reasons),
        )

    def evaluate_promote(self, interface: PhysicalInterface, ipv4: list[str]) -> None:
        if interface.link_state != LinkState.UP.value:
            raise InterfaceSafetyError(
                "mgmt_link_down",
                "Management interface must have link_state=up",
            )
        if not ipv4:
            raise InterfaceSafetyError(
                "mgmt_no_ipv4",
                "Management interface must have at least one IPv4 address",
            )
