# ADR: GitHub App Store index (axionet.store/v1)

**Status:** Accepted  
**Date:** 2026-08-04

## Context

App packages use [ADR-app-package-contract.md](ADR-app-package-contract.md) (`axionet.app/v1`). Catalog already overlays installed packages. We need a **store index** so Catalog can show what is available to install, and a path from a future GitHub-hosted index to the control-plane package directory.

## Decision

### Index document

Published as `packages/store/index.v1.json` (bundled with the control plane) and later mirrored from a GitHub App Store repo/release.

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
- API: `GET /api/v1/app-packages/store`, `POST /api/v1/app-packages/install`
- Catalog UI lists store entries with install status
- Dedicated GitHub apps org/repo can later replace the bundled index without changing package layout

## References

- Package contract: [ADR-app-package-contract.md](ADR-app-package-contract.md)
- Index: `packages/store/index.v1.json`
