from app.plugins.haproxy.renderer import render_haproxy_config
from app.plugins.haproxy.schemas import HaproxyConfig


def test_render_default_haproxy_config() -> None:
    rendered = render_haproxy_config(HaproxyConfig())
    assert "master-worker" in rendered
    assert "frontend main" in rendered
    assert "backend app" in rendered
    assert "bind *:80" in rendered
    assert "stats uri /stats" in rendered


def test_render_custom_ports() -> None:
    config = HaproxyConfig.model_validate(
        {
            "frontends": [{"name": "web", "bind_port": 8080, "default_backend": "app"}],
            "backends": [
                {
                    "name": "app",
                    "servers": [{"name": "s1", "address": "10.0.0.5", "port": 80}],
                }
            ],
        }
    )
    rendered = render_haproxy_config(config)
    assert "bind *:8080" in rendered
    assert "server s1 10.0.0.5:80 check" in rendered
