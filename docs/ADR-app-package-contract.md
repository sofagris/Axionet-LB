# ADR: App package contract (axionet.app/v1)

**Status:** Accepted  
**Date:** 2026-08-04

## Context

Catalog should be the place to pull in a new app / integration / service. An App Store on GitHub will eventually publish versioned packages. Before a real package (e.g. Varnish) is published, the on-disk contract must be frozen so Catalog and Designer can consume the same shape without GUI hardcoding.

Related: [ADR-designer-catalog-extensibility.md](ADR-designer-catalog-extensibility.md).

## Decision

An **Axionet app package** is a declarative directory. v1 lives under `packages/apps/<id>/` in this monorepo with the **same layout** as future GitHub App Store releases.

### Package layout (v1)

```text
packages/apps/<id>/
  axionet-app.json              # root manifest (required)
  catalog.json                  # Catalog listing card (required)
  designer.json                 # Designer contract (required for Designer)
  config/
    instance-schema.json        # JSON Schema for instance fields (required)
    desired-state.example.json  # example desired-state document (required)
  assets/
    icon.svg                    # Catalog / Designer icon (required)
  README.md                     # human docs (recommended)
```

Relative paths may be overridden via `files` in `axionet-app.json`; defaults match the layout above.

### Must / may

| Artifact | Required | Purpose |
|----------|----------|---------|
| `axionet-app.json` | yes | Identity, version, capabilities |
| `catalog.json` | yes | Catalog card (name, summary, category, brand, tags, …) |
| `designer.json` | yes* | Component tree, roles/props, apply/detail, hydrate |
| `config/instance-schema.json` | yes | Instance create/edit field contract |
| `config/desired-state.example.json` | yes | Example desired-state payload |
| `assets/icon.svg` | yes | Visual identity |
| `README.md` | recommended | Install notes for humans |
| Executable code (`.py`, scripts, binaries) | **forbidden in v1** | Runtime stays in control plane / adapters |

\*A package without `designer.json` cannot appear on the Designer palette; Catalog listing alone still needs the other required files for a complete installable app. For v1 every package under `packages/apps/` must include `designer.json`.

### Root: `axionet-app.json`

- `apiVersion`: must be `"axionet.app/v1"`
- `id`: package id (directory name should match)
- `serviceType`: control-plane service type key
- `version`: semver string for the package
- `capabilities.hydrate`: `none` | `onDrop` | `poll`
- `capabilities.actions`: list of supported instance actions (mirrors `supported_actions` on service definitions)
- `files` (optional): overrides for `catalog`, `designer`, `instanceSchema`, `desiredStateExample`, `icon`

Unknown hydrate modes or actions that the control plane does not register → treat as install rejected or Catalog `planned` without runtime (backend policy in a later step).

### `catalog.json`

Maps to Catalog listing fields (`name`, `summary`, `description`, `kind`, `category`, `brand`, `tags`, `capabilities`, optional `dependencies` / `requirements` / `primaryAction`).

Do **not** duplicate `flowNodes` / `flowEdges` here. Derive them from `designer.json`:

- `components` → `flowNodes` (`id`, `label`, `role`)
- `chain` → `flowEdges` (`from`, `to`, `label?`)

### `designer.json`

One-to-one with the frontend `DesignerManifest` shape (`catalogId`, `serviceType`, `components`, `chain`, `roles`, optional `hydrate`, `detailPathTemplate`, `applySteps`). `hydrate` on the designer file should match `capabilities.hydrate` on the root when both are set; root is authoritative for capability checks.

### Config rules (v1)

- `instance-schema.json`: JSON Schema Draft 2020-12 for instance create/edit.
- `desired-state.example.json`: illustrative desired-state document conforming to that schema (or a documented subset).
- No executable validate/reconcile code in the package. Named runtime behavior requires a control-plane adapter registered for `serviceType`.

### GitHub App Store (later)

The same directory layout is the release artifact. A future index repo or org may host packages; install copies them into the control plane’s package store and publishes manifests to Catalog / Designer APIs. This ADR does not define the store index protocol.

## Consequences

- Schemas live in `docs/schemas/`; reference package in `packages/apps/_example/`.
- Backend publishes packages via `/api/v1/app-packages` and `/api/v1/app-packages/designer-manifests` (reference dirs prefixed with `_` excluded unless `includeReference=true`).
- Frontend merges remote designer manifests into the local registry (`setRemoteDesignerManifests`); built-in manifests win on id conflicts.
- Catalog overlays package cards from `GET /api/v1/app-packages/catalog` (`mergeCatalogWithPackages`) so listing/detail flow comes from the package.
- First real package: `packages/apps/varnish` (Designer + schema only; runtime still stub/`enabled: false`).
- App Store index: [ADR-app-store-github.md](ADR-app-store-github.md) (`GET /store`, `POST /install`); Catalog shows installable packages.
- Next: GitHub-hosted index/releases as primary source; optional Varnish control-plane adapter.

## References

- Schemas: `docs/schemas/axionet-app-v1.schema.json`, `axionet-app-catalog-v1.schema.json`, `axionet-app-designer-v1.schema.json`
- Example: `packages/apps/_example/`
- Backend: `app/app_packages/`, `app/api/v1/app_packages.py`
- Designer in-repo today: `frontend/src/features/catalog/designerManifests.ts`
