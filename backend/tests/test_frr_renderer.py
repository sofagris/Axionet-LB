from app.plugins.frr.renderer import render_frr_config, render_frr_files
from app.plugins.frr.schemas import FrrConfig


def test_render_frr_bgp_config() -> None:
    config = FrrConfig(
        hostname="lab-frr",
        router_id="10.50.10.10",
        local_as=65001,
        neighbors=[
            {
                "name": "peer1",
                "address": "10.50.10.1",
                "remote_as": 65000,
                "password": "secret",
                "description": "lab-peer",
            }
        ],
        networks=["203.0.113.0/24"],
    )
    rendered = render_frr_config(config)
    assert "router bgp 65001" in rendered
    assert "bgp router-id 10.50.10.10" in rendered
    assert "neighbor 10.50.10.1 remote-as 65000" in rendered
    assert "neighbor 10.50.10.1 password secret" in rendered
    assert "network 203.0.113.0/24" in rendered

    files = render_frr_files(config)
    assert "bgpd=yes" in files["daemons"]
    assert "frr.conf" in files
    assert "service integrated-vtysh-config" in files["vtysh.conf"]
