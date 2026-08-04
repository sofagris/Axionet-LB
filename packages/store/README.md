# Axionet App Store index

This folder holds the **axionet.store/v1** index consumed by Catalog.

- Local / image: `index.v1.json`
- GitHub (default remote):  
  `https://raw.githubusercontent.com/sofagris/Axionet-LB/main/packages/store/index.v1.json`

Operators can add more HTTPS indexes under **Settings → App Stores** (`{data_dir}/app-store/sources.json`). Higher priority wins on package id collisions.

HTTPS archives may include `signatureUrl` (Ed25519 detached). Trust policy lives in Settings (`allowUnsignedPackages` + trusted public keys).

See [ADR-app-store-github.md](../../docs/ADR-app-store-github.md) and [ADR-app-package-runtime.md](../../docs/ADR-app-package-runtime.md).
