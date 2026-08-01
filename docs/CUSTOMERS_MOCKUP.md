# Customers / Applications mockup

Frontend-only product layer that sits above Catalog blueprints and dataplane instances:

**Customer (tenant) → Application → Resources**

## Routes

| Path | Purpose |
|------|---------|
| `/customers` | Customer list |
| `/customers/:customerId` | Applications for one customer |
| `/customers/:customerId/apps/:appId` | Resources (VIP, instances, pools, certs, notes) |

## Demo data

- **Kunde A / `app-web`**: geo-redundant web — 2 sites, HAProxy+FRR per site, ~50+50 pool members (counts, not 100 rows). Catalog link: `geo-redundant-lb`.
- **Kunde B / `horizon`**: Horizon UAG integration — VIP, HAProxy, 4 UAG pool members, ACME certificate note. Catalog link: `horizon-uag`.

## Boundaries

- No tenant API, database, or RBAC.
- Does not create HAProxy/FRR/VIP/certificates.
- Real deployables remain HAProxy and FRR via Instances / Catalog create flow.

## Tenancy mode (Settings)

Under **Settings → Tenancy** (`/settings?section=tenancy`), choose:

| Mode | Nav item |
|------|----------|
| Off | Hidden |
| Internal service areas | **Tjenesteområder** / Service areas |
| Customers (MSP) | **Kunder** / Customers |

Stored in browser `localStorage` only (`axionet-tenancy-mode`). Default: `customers`.

## Source

- `frontend/src/features/customers/`
- `frontend/src/features/tenancy/`
- `frontend/src/pages/CustomersPage.tsx`
- `frontend/src/pages/CustomerDetailPage.tsx`
- `frontend/src/pages/ApplicationDetailPage.tsx`
