# ADR: GitHub App Store index (axionet.store/v1)

**Status:** Accepted  
**Date:** 2026-08-04

## Context

App packages use [ADR-app-package-contract.md](ADR-app-package-contract.md) (`axionet.app/v1`). Catalog already overlays installed packages. We need a **store index** so Catalog can show what is available to install, and a path from a future GitHub-hosted index to the control-plane package directory.

## Decision

### Index document

Published as `packages/store/index.v1.json` in this monorepo and served from GitHub raw:

`https://raw.githubusercontent.com/sofagris/Axionet-LB/main/packages/store/index.v1.json`

Control plane loads the index via `AXIONET_STORE_INDEX_URL` when set; on failure it falls back to the bundled file (`AXIONET_STORE_INDEX` / `packages/store/index.v1.json`).

```text
apiVersion: axionet.store/v1
name: human store title
packages[]:
  id, version, name, summary
  source: bundled | github
  path?: relative dir under packages/apps (bundled)
  archiveUrl?: https URL to a zip/tarball of one package directory (github)
  repository?: git URL (documentation)
```

### Install flow

1. Operator picks a store entry in Catalog → App Store.
2. Control plane installs into `AXIONET_APPS_DIR` (writable), seeding from `AXIONET_APPS_SEED_DIR` on first boot.
3. **bundled:** copy package folder from seed (idempotent).
4. **github / archiveUrl:** download HTTPS archive, locate `axionet-app.json`, validate against package schemas, copy into apps dir.
5. Catalog / Designer re-read packages (no GUI redeploy).

### Security (v1)

- Only `https://` archive URLs.
- Package must pass `axionet.app/v1` validation (no executables).
- Install is an authenticated mutating API.

## Consequences

- Schema: `docs/schemas/axionet-store-v1.schema.json`
- API: `GET /api/v1/app-packages/store` (includes `indexSource` / `indexUrl`), `POST /api/v1/app-packages/install`
- Catalog UI lists store entries with install status and shows whether the index came from GitHub or the offline bundle
- A dedicated apps org/repo can replace the monorepo raw URL without changing package layout

## References

- Package contract: [ADR-app-package-contract.md](ADR-app-package-contract.md)
- Index: `packages/store/index.v1.json`
- Env: `AXIONET_STORE_INDEX_URL`, `AXIONET_STORE_INDEX`
