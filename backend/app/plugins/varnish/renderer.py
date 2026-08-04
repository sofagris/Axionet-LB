from __future__ import annotations

from app.plugins.varnish.schemas import VarnishConfig


def _vcl_string(value: str) -> str:
    return value.replace("\\", "\\\\").replace('"', '\\"')


def render_default_vcl(cfg: VarnishConfig) -> str:
    host = _vcl_string(cfg.origin.address)
    port = str(cfg.origin.port)
    ttl = _vcl_string(cfg.ttl_default)
    lines = [
        "vcl 4.1;",
        "",
        f"# Managed by AxioNet — instance {cfg.name}",
        "backend origin {",
        f'  .host = "{host}";',
        f'  .port = "{port}";',
        "}",
        "",
        "sub vcl_recv {",
        "  set req.backend_hint = origin;",
    ]
    if cfg.origin.host_header:
        hh = _vcl_string(cfg.origin.host_header)
        lines.append(f'  set req.http.host = "{hh}";')
    lines.extend(
        [
            "}",
            "",
            "sub vcl_backend_response {",
            f"  set beresp.ttl = {ttl};",
            "}",
            "",
        ]
    )
    return "\n".join(lines)


def render_varnish_files(cfg: VarnishConfig) -> dict[str, str]:
    return {
        "default.vcl": render_default_vcl(cfg),
        "README.txt": (
            f"Varnish instance '{cfg.name}' managed by AxioNet.\n"
            f"Listen: {cfg.bind}  Storage: malloc,{cfg.storage_size}\n"
            f"Origin: {cfg.origin.address}:{cfg.origin.port}\n"
        ),
    }
