"""Tests for macvlan host shim address selection and OIDC UPN rebind."""

from __future__ import annotations

import pytest

from app.services.networking.host import HostNetworkError
from app.services.networking.macvlan_host import pick_shim_address


def test_pick_shim_address_prefers_high_end() -> None:
    addr = pick_shim_address(
        "192.168.50.0/24",
        reserved={"192.168.50.1", "192.168.50.195", "192.168.50.50"},
    )
    assert str(addr) == "192.168.50.254"


def test_pick_shim_address_skips_occupied_high_end() -> None:
    addr = pick_shim_address(
        "192.168.50.0/24",
        reserved={"192.168.50.1", "192.168.50.254", "192.168.50.253"},
    )
    assert str(addr) == "192.168.50.252"


def test_pick_shim_address_exhausted() -> None:
    reserved = {f"192.168.50.{i}" for i in range(1, 255)}
    with pytest.raises(HostNetworkError, match="No free address"):
        pick_shim_address("192.168.50.0/24", reserved=reserved)
