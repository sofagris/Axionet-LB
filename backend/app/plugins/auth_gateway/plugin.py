from __future__ import annotations

from app.plugins.auth_gateway.schemas import AuthGatewayConfig
from app.plugins.base import ContainerSpec, ValidationResult
from app.services.docker.client import DockerClientAdapter


class AuthGatewayPlugin:
    service_type = "auth-gateway"

    def normalize_configuration(self, configuration: dict | None) -> dict:
        cfg = AuthGatewayConfig.from_dict(configuration)
        data = cfg.model_dump()
        if not data.get("cookie_secret"):
            data["cookie_secret"] = cfg.ensure_cookie_secret()
        return AuthGatewayConfig.from_dict(data).model_dump()

    def apply_network_hints(self, configuration: dict, attachment_ips: list[str]) -> dict:
        cfg = AuthGatewayConfig.from_dict(configuration)
        data = cfg.model_dump()
        if not cfg.redirect_url and attachment_ips:
            data["redirect_url"] = f"http://{attachment_ips[0]}:{cfg.http_port}/oauth2/callback"
        if not data.get("cookie_secret"):
            data["cookie_secret"] = cfg.ensure_cookie_secret()
        return AuthGatewayConfig.from_dict(data).model_dump()

    def render(self, configuration: dict) -> str:
        cfg = AuthGatewayConfig.from_dict(configuration)
        lines = [
            f"upstream={cfg.upstream_url}",
            f"issuer={cfg.oidc_issuer_url}",
            f"client_id={cfg.client_id}",
            f"http_port={cfg.http_port}",
            f"redirect_url={cfg.redirect_url or ''}",
        ]
        return "\n".join(lines) + "\n"

    def render_files(self, configuration: dict) -> dict[str, str]:
        cfg = AuthGatewayConfig.from_dict(configuration)
        cookie = cfg.ensure_cookie_secret()
        # Minimal cfg for operators inspecting the bind mount; runtime uses env.
        content = "\n".join(
            [
                f"http_address = \"0.0.0.0:{cfg.http_port}\"",
                f'upstream = "{cfg.upstream_url}"',
                f'oidc_issuer_url = "{cfg.oidc_issuer_url}"',
                f'client_id = "{cfg.client_id}"',
                f'email_domains = ["{cfg.email_domains}"]',
                f'cookie_secret = "{cookie}"',
                "provider = \"keycloak-oidc\"",
                "",
            ]
        )
        return {
            "oauth2-proxy.cfg": content,
            "README.txt": (
                "Auth Gateway (oauth2-proxy) managed by AxioNet.\n"
                "HAProxy VIP should point at this instance :4180; upstream_url is the legacy app.\n"
            ),
        }

    def validate(
        self,
        docker: DockerClientAdapter,
        *,
        image: str,
        configuration: dict,
        extra_files: dict[str, str] | None = None,
    ) -> ValidationResult:
        _ = docker, image, extra_files
        try:
            cfg = AuthGatewayConfig.from_dict(configuration)
        except Exception as exc:  # noqa: BLE001
            return ValidationResult(ok=False, output=str(exc))
        if not cfg.upstream_url:
            return ValidationResult(ok=False, output="upstream_url is required")
        if not cfg.oidc_issuer_url:
            return ValidationResult(ok=False, output="oidc_issuer_url is required")
        if not cfg.client_id or not cfg.client_secret:
            return ValidationResult(ok=False, output="client_id and client_secret are required")
        return ValidationResult(ok=True, output="auth-gateway configuration ok")

    def container_spec(self, configuration: dict | None = None) -> ContainerSpec:
        cfg = AuthGatewayConfig.from_dict(configuration)
        cookie = cfg.ensure_cookie_secret()
        env: dict[str, str] = {
            "OAUTH2_PROXY_PROVIDER": "keycloak-oidc",
            "OAUTH2_PROXY_HTTP_ADDRESS": f"0.0.0.0:{cfg.http_port}",
            "OAUTH2_PROXY_UPSTREAMS": cfg.upstream_url,
            "OAUTH2_PROXY_OIDC_ISSUER_URL": cfg.oidc_issuer_url,
            "OAUTH2_PROXY_CLIENT_ID": cfg.client_id,
            "OAUTH2_PROXY_CLIENT_SECRET": cfg.client_secret,
            "OAUTH2_PROXY_COOKIE_SECRET": cookie,
            "OAUTH2_PROXY_EMAIL_DOMAINS": cfg.email_domains,
            "OAUTH2_PROXY_COOKIE_SECURE": "true" if cfg.cookie_secure else "false",
            "OAUTH2_PROXY_PASS_ACCESS_TOKEN": "false",
            "OAUTH2_PROXY_PASS_USER_HEADERS": "true" if cfg.pass_user_headers else "false",
            "OAUTH2_PROXY_SET_XAUTHREQUEST": "true" if cfg.set_xauthrequest else "false",
            "OAUTH2_PROXY_SKIP_PROVIDER_BUTTON": "true",
            "OAUTH2_PROXY_CODE_CHALLENGE_METHOD": "S256",
        }
        if cfg.redirect_url:
            env["OAUTH2_PROXY_REDIRECT_URL"] = cfg.redirect_url
        return ContainerSpec(
            config_bind="/etc/oauth2-proxy",
            volume_mode="ro",
            command=None,
            environment=env,
        )

    def reload_signal(self) -> str | None:
        return None
