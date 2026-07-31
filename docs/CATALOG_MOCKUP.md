# Catalog taxonomy and mockups

This document describes the **frontend catalog mockup** and **LCD / front-panel mockup** introduced for product design. They do not deploy new dataplane services.

## Catalog taxonomy

| Kind | Meaning | Primary action (mock unless noted) |
|------|---------|--------------------------------------|
| `service` | Single local dataplane/network service | Create instance / Create service |
| `core-service` | Platform service others depend on | Create service / Configure |
| `stack` | Curated multi-service deploy | Deploy stack |
| `blueprint` | Wizard that generates multiple resources | Start wizard |
| `integration` | Template against an external/existing product | Configure integration |
| `provider` | External platform via API credentials | Connect / Manage |

Categories: Traffic, Core services, Security, Observability, Blueprints, Providers.

## Deployability in this phase

- **HAProxy** and **FRR** keep the real create flow (`/instances/new?type=…`) when the API marks them enabled.
- All other catalog items are **design previews** only: drawers, architecture sketches, and mock action dialogs. No containers are created and no secrets are stored.
- **PowerDNS** is the DNS direction (Authoritative, Recursor, Platform stack). There is **no BIND** catalog entry. PowerDNS Views are labelled experimental in the mockup.
- **Cloudflare** is a **provider** (external account/API), not a local container.
- **Apache Guacamole** is a multi-component **blueprint**.
- **Omnissa Horizon UAG** is an **integration** toward an existing UAG/Horizon deployment.

## LCD / front panel

Under **Settings → Front panel / LCD** (`/settings?section=front-panel`):

- Mock connection: `/dev/ttyUSB0`, FTDI, 19200 8N1, 16×2
- Preview with line length and brightness limits
- Keypad mapping and mock key test
- **Startup / EEPROM** is marked **experimental / not implemented** with **read capability only** — no EEPROM write controls

## Related source

- `frontend/src/features/catalog/`
- `frontend/src/features/settings/front-panel/`
- Spec: `CURSOR_CATALOG_BLUEPRINTS_LCD_MOCKUP.md`
