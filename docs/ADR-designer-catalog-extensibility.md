# ADR: Designer ↔ Catalog extensibility

**Status:** Accepted  
**Date:** 2026-08-04

## Context

Designer is becoming a stable canvas (lanes, groups, visuals, HAProxy live sync). New Catalog services will arrive via an “App Store” style flow. Today several designer concerns are hardcoded per `serviceType` (`DESIGNER_SERVICE_TREES`, `componentProps` switches, HAProxy-only hydrate, apply step specials, instance route whitelists). That makes adding a service a frontend code change instead of a package declaration.

## Decision

Split responsibilities into three layers:

1. **Catalog / App package (declarative)** — metadata plus a **Designer manifest** (component tree, chain, props schema per role, optional apply-step templates, capability flags). One source of truth for what the canvas can drop and edit.
2. **Control-plane adapters (code, optional)** — live config, hydrate, desired-state, poll sync. Registered as `serviceType → adapter`. HAProxy stays an adapter; skeleton-only services need no adapter.
3. **Designer canvas (generic)** — drop, group, lane, validate unbound/planned, properties rendering from schema. No `if (serviceType === "haproxy")` in canvas code; call adapters only when capabilities say so.

### Rules for new services

- **Minimum to appear in Designer:** designer manifest (tree + props) + detail route template.
- **Live sync is optional** — not required for Catalog listing.
- **Runtime logic lives in the service/adapter**, not in the canvas.
- **Visual annotations** (Internet, User, Group, Client) stay config-free.
- Identity visuals (User/Group) may later gain a Keycloak adapter without changing canvas core.

### Stay as code (adapters)

HAProxy fetch, fingerprint, poll, and graph↔config mapping. These are domain-rich and should remain named adapters, not JSON.

## Consequences

- Step 1 (this change): consolidate trees + role props into `catalog/designerManifests.ts`; Designer modules become thin readers.
- Later: capability registry, declarative applySteps/detailPath, backend-published manifests for App Store plugins without GUI redeploy.
- Catalog `flowNodes` / `flowEdges` remain marketing/blueprint previews until they are derived from or replaced by the designer manifest.

## References

- Frontend: `features/catalog/designerManifests.ts`, `features/designer/*`
- Backend today: `plugins/catalog.py` service definitions (no designer fields yet)
