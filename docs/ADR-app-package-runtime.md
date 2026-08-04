# ADR: Declarative package runtime (axionet.app/v1)

**Status:** Accepted  
**Date:** 2026-08-05

## Context

App packages previously described Catalog/Designer only. Control-plane create required a named Python plugin (`serviceType` → image + `container_spec`). Third-party App Store packages need a way to declare how the container runs without shipping executable code.

## Decision

Optional `runtime` object on `axionet-app.json`:

- `image`, `defaultVersion`, `configBind` (required when `runtime` is present)
- optional `volumeMode`, `entrypoint`, `command`
- `{field}` placeholders in entrypoint/command resolve from instance configuration (dot paths like `origin.address`)
- optional `config/templates/*` files with `{{field}}` substitution become `render_files` outputs

`GenericPackagePlugin` implements `ServicePlugin` from an installed package’s `runtime`. **Named plugins registered in the control plane always win** for the same `serviceType`.

Executable code remains forbidden in packages.

## Consequences

- Schema: `docs/schemas/axionet-app-v1.schema.json` → `runtime`
- Catalog overlays enabled definitions from packages that declare `runtime`
- Registry falls back to generic when no named plugin exists
- Related: [ADR-app-store-github.md](ADR-app-store-github.md) (multi-store + Ed25519 trust)
