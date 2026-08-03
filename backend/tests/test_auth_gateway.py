from app.plugins.auth_gateway.plugin import AuthGatewayPlugin
from app.plugins.auth_gateway.schemas import AuthGatewayConfig


def test_auth_gateway_requires_issuer_and_upstream() -> None:
    plugin = AuthGatewayPlugin()
    bad = plugin.validate(
        docker=None,  # type: ignore[arg-type]
        image="quay.io/oauth2-proxy/oauth2-proxy:v7.8.1",
        configuration={"upstream_url": "", "oidc_issuer_url": ""},
    )
    assert bad.ok is False

    ok = plugin.validate(
        docker=None,  # type: ignore[arg-type]
        image="quay.io/oauth2-proxy/oauth2-proxy:v7.8.1",
        configuration={
            "upstream_url": "http://10.0.0.10:80",
            "oidc_issuer_url": "http://10.0.0.20:8080/realms/axionet",
            "client_id": "axionet-app",
            "client_secret": "secret",
        },
    )
    assert ok.ok is True


def test_auth_gateway_container_env() -> None:
    plugin = AuthGatewayPlugin()
    cfg = {
        "upstream_url": "http://10.0.0.10:80",
        "oidc_issuer_url": "http://10.0.0.20:8080/realms/axionet",
        "client_id": "axionet-app",
        "client_secret": "secret",
        "cookie_secret": "abcdefghijklmnopqrstuvwxyz012345",
        "redirect_url": "http://10.0.0.30:4180/oauth2/callback",
    }
    spec = plugin.container_spec(cfg)
    assert spec.config_bind == "/etc/oauth2-proxy"
    assert spec.environment["OAUTH2_PROXY_PROVIDER"] == "keycloak-oidc"
    assert spec.environment["OAUTH2_PROXY_UPSTREAMS"] == "http://10.0.0.10:80"
    assert spec.environment["OAUTH2_PROXY_PASS_USER_HEADERS"] == "true"


def test_normalize_fills_cookie_secret() -> None:
    plugin = AuthGatewayPlugin()
    data = plugin.normalize_configuration({"upstream_url": "http://x", "oidc_issuer_url": "http://y"})
    cfg = AuthGatewayConfig.from_dict(data)
    assert cfg.cookie_secret and len(cfg.cookie_secret) >= 16
