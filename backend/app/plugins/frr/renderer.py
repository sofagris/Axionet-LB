from __future__ import annotations

from jinja2 import Template

from app.plugins.frr.schemas import FrrConfig

FRR_CONF_TEMPLATE = Template(
    """\
frr version 10.2
frr defaults traditional
hostname {{ config.hostname }}
{% if config.log_stdout %}
log stdout
{% endif %}
!
router bgp {{ config.local_as }}
 bgp router-id {{ config.router_id }}
 no bgp ebgp-requires-policy
 no bgp network import-check
{% for neighbor in config.neighbors %}
 neighbor {{ neighbor.address }} remote-as {{ neighbor.remote_as }}
{% if neighbor.description %}
 neighbor {{ neighbor.address }} description {{ neighbor.description }}
{% endif %}
{% if neighbor.password %}
 neighbor {{ neighbor.address }} password {{ neighbor.password }}
{% endif %}
{% endfor %}
{% for network in config.networks %}
 network {{ network }}
{% endfor %}
exit
!
"""
)

DAEMONS_CONTENT = """\
# AxioNet LB generated daemons file
zebra=yes
bgpd=yes
ospfd=no
ospf6d=no
ripd=no
ripngd=no
isisd=no
pimd=no
ldpd=no
nhrpd=no
eigrpd=no
babeld=no
sharpd=no
staticd=yes
pbrd=no
bfdd=no
fabricd=no
vrrpd=no
pathd=no

vtysh_enable=yes
zebra_options="  -A 127.0.0.1 -s 90000000"
bgpd_options="   -A 127.0.0.1"
staticd_options="  -A 127.0.0.1"
"""

VTYSH_CONF = """\
service integrated-vtysh-config
"""


def render_frr_config(config: FrrConfig) -> str:
    return FRR_CONF_TEMPLATE.render(config=config).strip() + "\n"


def render_frr_files(config: FrrConfig) -> dict[str, str]:
    return {
        "daemons": DAEMONS_CONTENT,
        "frr.conf": render_frr_config(config),
        "vtysh.conf": VTYSH_CONF,
    }
