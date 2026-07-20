from __future__ import annotations

from jinja2 import Template

from app.plugins.haproxy.schemas import HaproxyConfig

HAPROXY_TEMPLATE = Template(
    """\
global
    log stdout format raw local0
    stats socket /var/lib/haproxy/admin.sock mode 660 level admin expose-fd listeners
    stats socket ipv4@127.0.0.1:9999 level admin
    master-worker

defaults
    log global
    mode {{ config.mode }}
    option httplog
    timeout connect {{ config.timeout_connect }}
    timeout client {{ config.timeout_client }}
    timeout server {{ config.timeout_server }}

frontend stats
    bind *:{{ config.stats_port }}
    mode http
    stats enable
    stats uri /stats
    stats refresh 10s
    stats show-legends
    stats show-node

{% for frontend in config.frontends -%}
frontend {{ frontend.name }}
{% if frontend.certificate %}
    bind {{ frontend.bind_address }}:{{ frontend.bind_port }} ssl crt /usr/local/etc/haproxy/certs/{{ frontend.certificate }}.pem
{% else %}
    bind {{ frontend.bind_address }}:{{ frontend.bind_port }}
{% endif %}
    mode {{ frontend.mode }}
{% for acl in config.acls if acl.frontend == frontend.name %}
    acl {{ acl.name }} {{ acl.expression }}
{% endfor %}
{% for acl in config.acls if acl.frontend == frontend.name and acl.use_backend %}
    use_backend {{ acl.use_backend }} if {{ acl.name }}
{% endfor %}
    default_backend {{ frontend.default_backend }}

{% endfor -%}
{% for backend in config.backends -%}
backend {{ backend.name }}
    mode {{ backend.mode }}
    balance {{ backend.balance }}
{% for server in backend.servers %}
    server {{ server.name }} {{ server.address }}:{{ server.port }} weight {{ server.weight }}{% if server.check %} check inter {{ server.inter_ms }}ms rise {{ server.rise }} fall {{ server.fall }}{% endif %}
{% endfor %}

{% endfor -%}
"""
)


def render_haproxy_config(config: HaproxyConfig) -> str:
    return HAPROXY_TEMPLATE.render(config=config).strip() + "\n"
