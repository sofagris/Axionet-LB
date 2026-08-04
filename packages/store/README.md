# Axionet App Store index

This folder holds the **axionet.store/v1** index consumed by Catalog.

- Local / image: `index.v1.json`
- GitHub (default remote):  
  `https://raw.githubusercontent.com/sofagris/Axionet-LB/main/packages/store/index.v1.json`

Set `AXIONET_STORE_INDEX_URL` on the API to point at a raw JSON index. If the URL is unreachable, the control plane falls back to the bundled file.

See [ADR-app-store-github.md](../../docs/ADR-app-store-github.md).
