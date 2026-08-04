# ADR: GitHub / multi-source App Store (axionet.store/v1)

**Status:** Accepted  
**Date:** 2026-08-04 (updated 2026-08-05)

## Context

App packages use [ADR-app-package-contract.md](ADR-app-package-contract.md) (`axionet.app/v1`). Catalog overlays installed packages. Operators need **multiple store indexes** (first-party + third-party) and a trust policy for HTTPS archives.

## Decision

### Index document

```text
apiVersion: axionet.store/v1
name: human store title
packages[]:
  id, version, name, summary
  source: bundled | github
  path?: relative dir under packages/apps (bundled)
  archiveUrl?: https URL to a zip/tarball of one package directory
  signatureUrl?: https URL to detached Ed25519 signature over archive bytes
  repository?: git URL (documentation)
```

If `signatureUrl` is omitted, installers may try `archiveUrl + ".sig"`.

### Multiple sources

Operator-configured sources live under `{data_dir}/app-store/sources.json`:

```text
{ id, name, indexUrl, enabled, priority }
```

`GET /store` merges all **enabled** sources. Dedup by package `id`: **higher `priority` wins**; equal priority → first listed source wins. Each entry carries `storeId` / `storeName`.

Bootstrap: if `sources.json` is missing, seed from `AXIONET_STORE_INDEX_URL` (and keep bundled file fallback per source when a URL fails).

### Trust (Ed25519)

`{data_dir}/app-store/trust.json`:

```text
allowUnsignedPackages: bool   # default true (lab / bundled-friendly)
keys[]: { id, name, publicKey }  # raw Ed25519 public key, base64 (32 bytes)
```

Install rules:

1. **Bundled/seed** copy: signature not required (internal seed).
2. **HTTPS archive**: if a signature is present → must verify against a trusted key. If no signature → only allowed when `allowUnsignedPackages` is true.
3. Always: `https://` only, `axionet.app/v1` validation, no executables.

### Install flow

1. Operator picks a store entry in Catalog → App Store (or Settings).
2. Control plane installs into `AXIONET_APPS_DIR`, seeding from `AXIONET_APPS_SEED_DIR` on first boot.
3. **bundled:** copy from seed (idempotent).
4. **github / archiveUrl:** download archive (+ signature), verify trust policy, validate package, copy into apps dir.
5. Catalog / Designer / service catalog re-read packages.

## Consequences

- Schema: `docs/schemas/axionet-store-v1.schema.json` (`signatureUrl`)
- API: store merge + `/api/v1/app-store/sources` + `/api/v1/app-store/trust`
- Settings UI: App Stores tab (sources, allow unsigned, trusted keys)
- Runtime for third-party create: [ADR-app-package-runtime.md](ADR-app-package-runtime.md)

## References

- Package contract: [ADR-app-package-contract.md](ADR-app-package-contract.md)
- Index example: `packages/store/index.v1.json`
- Env (bootstrap): `AXIONET_STORE_INDEX_URL`, `AXIONET_STORE_INDEX`
