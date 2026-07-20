from app.plugins.haproxy.renderer import render_haproxy_config
from app.plugins.haproxy.schemas import HaproxyConfig


def test_render_default_haproxy_config() -> None:
    rendered = render_haproxy_config(HaproxyConfig())
    assert "master-worker" in rendered
    assert "ipv4@127.0.0.1:9999" in rendered
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
    assert "server s1 10.0.0.5:80 weight 100 check inter 2000ms rise 2 fall 3" in rendered


def test_render_httpchk() -> None:
    config = HaproxyConfig.model_validate(
        {
            "backends": [
                {
                    "name": "app",
                    "mode": "http",
                    "httpchk": True,
                    "httpchk_method": "GET",
                    "httpchk_uri": "/healthz",
                    "httpchk_expect_status": 200,
                    "servers": [{"name": "s1", "address": "10.0.0.5", "port": 80}],
                },
                {
                    "name": "tcp_be",
                    "mode": "tcp",
                    "httpchk": True,
                    "httpchk_uri": "/ignored",
                    "servers": [{"name": "s1", "address": "10.0.0.6", "port": 443}],
                },
            ],
        }
    )
    rendered = render_haproxy_config(config)
    assert "option httpchk GET /healthz" in rendered
    assert "http-check expect status 200" in rendered
    # TCP backends must not emit HTTP check directives even if flagged.
    tcp_section = rendered.split("backend tcp_be", 1)[1]
    assert "option httpchk" not in tcp_section


def test_render_compression_and_stick_table() -> None:
    config = HaproxyConfig.model_validate(
        {
            "mode": "http",
            "compression": True,
            "compression_algo": "gzip",
            "compression_type": "text/html application/json",
            "backends": [
                {
                    "name": "app",
                    "stick_table": True,
                    "stick_table_type": "ip",
                    "stick_table_size": "50k",
                    "stick_table_expire": "15m",
                    "stick_on": "src",
                    "servers": [{"name": "s1", "address": "10.0.0.5", "port": 80}],
                },
                {
                    "name": "by_header",
                    "stick_table": True,
                    "stick_table_type": "string",
                    "stick_table_key_len": 64,
                    "stick_table_size": "10k",
                    "stick_table_expire": "1h",
                    "stick_on": "hdr(X-Request-Id)",
                    "servers": [{"name": "s1", "address": "10.0.0.7", "port": 80}],
                },
            ],
        }
    )
    rendered = render_haproxy_config(config)
    assert "compression algo gzip" in rendered
    assert "compression type text/html application/json" in rendered
    assert "stick-table type ip size 50k expire 15m" in rendered
    assert "stick on src" in rendered
    assert "stick-table type string len 64 size 10k expire 1h" in rendered
    assert "stick on hdr(X-Request-Id)" in rendered

    tcp = HaproxyConfig.model_validate({"mode": "tcp", "compression": True})
    tcp_rendered = render_haproxy_config(tcp)
    assert "compression algo" not in tcp_rendered


def test_render_tls_and_acls() -> None:
    config = HaproxyConfig.model_validate(
        {
            "frontends": [
                {
                    "name": "web",
                    "bind_port": 443,
                    "default_backend": "app",
                    "certificate": "site",
                }
            ],
            "backends": [{"name": "app"}, {"name": "api"}],
            "certificates": [{"name": "site", "filename": "certs/site.pem"}],
            "acls": [
                {
                    "name": "is_api",
                    "frontend": "web",
                    "expression": "path_beg /api",
                    "use_backend": "api",
                }
            ],
        }
    )
    rendered = render_haproxy_config(config)
    assert "ssl crt /usr/local/etc/haproxy/certs/site.pem" in rendered
    assert "acl is_api path_beg /api" in rendered
    assert "use_backend api if is_api" in rendered
