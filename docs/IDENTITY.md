# Identity (fase 1 + 2)

AxioNet LB skiller **plattform-login** (management-GUI) fra **app-/kunde-IdP** (Catalog Identity & MFA).

## Plattform-login

### Lokal break-glass

- `POST /api/v1/auth/login` med `Admin` eller `Admin@internal`
- Suffix `internal` er reservert og peker alltid på lokal brukerdatabase
- Bootstrap-admin opprettes ved oppstart

### UPN → auth-kilde

| UPN | Ruting |
|-----|--------|
| `bruker` eller `bruker@internal` | Lokal passord-login |
| `bruker@contoso.com` | OIDC-kilde bundet til suffix `contoso.com` |

Admin konfigurerer under **System → Identity**:

1. **Kilder** — innebygd `Local` + valgfrie OIDC-kilder (issuer, client id/secret)
2. **UPN-suffixer** — bind f.eks. `contoso.com` → OIDC-kilde
3. **App IdP** — se under (ikke GUI-login)

SSO-flyt:

1. `GET /api/v1/auth/oidc/start?upn=...` (public)
2. IdP authorize → `GET /api/v1/auth/oidc/callback`
3. Upsert lokal user på `(auth_source_id, oidc_sub)`, map IdP-grupper (navnematch) → lokale groups
4. Redirect til GUI med `?oidc_token=...`

Miljøvariabler:

- `AX_GUI_PUBLIC_URL` — GUI-origin etter OIDC-callback (f.eks. `http://192.168.50.195`)
- `AX_AUTH_PUBLIC_BASE_URL` — valgfri eksplisitt API-base for `redirect_uri`

### Roller

`admin` | `operator` | `viewer`. Effektiv rolle = max(egen, grupper).

### Mutasjons-RBAC

Håndheves sentralt for alle ikke-GET kall under `/api/v1` (etter autentisering):

| Rolle | Tillat |
|-------|--------|
| **viewer** | Kun lesing (GET) + `POST /auth/logout` |
| **operator** | Dataplane-mutasjoner (instances, VIPs, networks, interfaces, HAProxy, FRR, dashboards, revisions restore, …) |
| **admin** | Alt over + identity (`/users`, `/groups`, `/auth-sources`) + destruktivt system (`POST /system/orphans/prune`, `…/promote-management`) |

Identity-routere har fortsatt `require_roles("admin")` (inkl. GET). GUI viser lese-banner for viewer og skjuler/deaktiverer mutasjonskontroller.

## App Identity & MFA (kunde)

**App IdP**-definisjoner under Identity er metadata for kundetjenester (Catalog «Identity & MFA»). De deployer **ikke** Keycloak og brukes **ikke** til plattform-login.

Senere kan Catalog/Customers knytte en app-IdP til en kundeapplikasjon.

## AD

Bruk OIDC mot IdP som snakker med AD (Entra ID, eller Keycloak med AD federation). Ren LDAP-bind er ikke i scope ennå; samme UPN-routing kan senere peke på en `ldap`-kilde.

## Ikke i scope

- Keycloak-container deploy
- MFA/TOTP for lokal login
- Full SAML SP
- Session revocation / refresh tokens
