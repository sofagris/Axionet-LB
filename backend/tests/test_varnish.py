from app.plugins.varnish.plugin import VarnishPlugin
from app.plugins.varnish.schemas import VarnishConfig


EXAMPLE = {
    "name": "varnish-edge",
    "bind": "*:6081",
    "storage_size": "256m",
    "ttl_default": "120s",
    "origin": {
        "address": "10.0.0.20",
        "port": 80,
        "host_header": "app.example.com",
    },
}


def test_varnish_normalize_defaults() -> None:
    plugin = VarnishPlugin()
    data = plugin.normalize_configuration(None)
    cfg = VarnishConfig.from_dict(data)
    assert cfg.bind == "*:6081"
    assert cfg.storage_size == "256m"
    assert cfg.origin.port == 80


def test_varnish_validate_rejects_bad_bind() -> None:
    plugin = VarnishPlugin()
    bad = plugin.validate(
        docker=None,  # type: ignore[arg-type]
        image="varnish:7.6",
        configuration={**EXAMPLE, "bind": "not-a-bind"},
    )
    assert bad.ok is False

    ok = plugin.validate(docker=None, image="varnish:7.6", configuration=EXAMPLE)  # type: ignore[arg-type]
    assert ok.ok is True


def test_varnish_renders_vcl_and_container_spec() -> None:
    plugin = VarnishPlugin()
    files = plugin.render_files(EXAMPLE)
    vcl = files["default.vcl"]
    assert 'backend origin' in vcl
    assert '.host = "10.0.0.20"' in vcl
    assert '.port = "80"' in vcl
    assert 'set req.http.host = "app.example.com"' in vcl
    assert "set beresp.ttl = 120s;" in vcl

    spec = plugin.container_spec(EXAMPLE)
    assert spec.config_bind == "/etc/varnish"
    assert spec.entrypoint == ["varnishd"]
    assert spec.command == [
        "-F",
        "-a",
        ":6081",
        "-f",
        "/etc/varnish/default.vcl",
        "-s",
        "malloc,256m",
    ]
