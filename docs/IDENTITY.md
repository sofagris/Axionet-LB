# Identity

AxioNet LB skiller **plattform-login** (management-GUI) fra **app-/kunde-IdP**.

## Målarkitektur: Keycloak mgmt vs apps

```
Management-nett          App / dataplane-nett
─────────────────        ────────────────────
AxioNet GUI/API   ←OIDC─ Keycloak (mgmt)      Keycloak (apps) ─OIDC→ kundeapper
     ↑                         │                     │
 break-glass              kun management        egne realms
 Admin@internal           (ikke internett)      per tenant
```

| Instans | Catalog | Nettverk | Bruk |
|---------|---------|----------|------|
| `keycloak-mgmt` | Keycloak (Management) | **Kun** `management` | Plattform-SSO, admin console |
| `keycloak-apps` | Keycloak (Apps) | Bridge / ipvlan / macvlan osv. | Kundetjenester, App IdP-issuer |

### Management-interface → management-nettverk

- **Interfaces:** én NIC markeres MGMT (`eno1`, bind-IP).
- Ved **promote** / API-bootstrap opprettes (eller gjenbrukes) Docker-nettverket `management` (type `management`, **macvlan** på MGMT-NIC, subnet fra NIC-CIDR).
- Keycloak-mgmt attaches til dette nettverket med egen LAN-IP (ikke hostens bind-IP).
- **Host-shim:** Docker macvlan isolerer parent-NIC fra egne macvlan-containere. API oppretter `ax-mgmt-shim` på MGMT-NIC og `/32`-ruter til attachment-IPer, slik at control plane (OIDC token/JWKS) når IdP. `curl` fra host til Keycloak-IP feiler uten denne shimen.

- **Realms** gir logisk isolasjon (brukere/klienter), **ikke** nettverksisolasjon.
- Management-IdP skal **ikke** eksponeres mot internett; hold den på management-LAN.
- Deploy via **Catalog → Create instance**. Etter deploy: Instances → Keycloak-detalj → **Wire platform OIDC** (admin).

### Compose-profil `keycloak` (utfases)

Compose-sidecar `ax-keycloak` (port 8080 på host) er **lab-fallback**. Når Catalog `keycloak-mgmt` kjører på management-macvlan:

```bash
docker compose --profile keycloak stop keycloak
docker compose --profile keycloak rm -f keycloak
```

Ikke kjør begge samtidig hvis du fortsatt publiserer host `:8080`.

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
3. **App IdP** — metadata for kundetjenester (ikke GUI-login)

SSO-flyt:

1. `GET /api/v1/auth/oidc/start?upn=...` (public)
2. IdP authorize → `GET /api/v1/auth/oidc/callback`
3. Upsert lokal user på `(auth_source_id, oidc_sub)`, map IdP-grupper (case-insensitive navnematch) → lokale groups
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
| **operator** | Dataplane-mutasjoner (instances inkl. Keycloak, VIPs, networks, interfaces, HAProxy, FRR, …) |
| **admin** | Alt over + identity (`/users`, `/groups`, `/auth-sources`, Keycloak **wire-platform-oidc**) + destruktivt system |

## App Identity (kunde)

**App IdP**-definisjoner under Identity er metadata for kundetjenester. De brukes **ikke** til plattform-login. Når `keycloak-apps` er deployet, pek issuer mot den instansens realm-URL via **Wire App IdP** på instansdetaljen.

### Legacy app front door (auth-gateway)

Apper som ikke snakker OIDC selv skal ikke eksponeres direkte. Bruk Catalog-tjenesten **Auth Gateway** (`oauth2-proxy`):

```
Browser → HAProxy VIP → auth-gateway (:4180) → legacy upstream
                 ↘ OIDC ↗
              Keycloak (apps)
```

1. Deploy `keycloak-apps` på app-/dataplane-nett; **Wire App IdP** (valgfri binding til kunde/app-mock).
2. Deploy `auth-gateway` med `oidc_issuer_url` = apps-issuer og `upstream_url` = legacy-app.
3. Opprett HAProxy VIP/backend mot gateway attachment-IP:4180.

Autentiserte forespørsler til upstream får bl.a. `X-Forwarded-User`, `X-Forwarded-Email`, `X-Forwarded-Groups`.

`secure-web-frontend` i Catalog er fortsatt et blueprint-konsept; de deploybare byggesteinene er `keycloak-apps` + `auth-gateway` (+ HAProxy).

### Binding til Customers

Tabell `app_idp_bindings` knytter en App IdP til soft-referanser (`customer_id`, valgfri `application_id`) som matcher mock-IDene under **Kunder** (f.eks. `kunde-a` / `app-web`).

| API | Tilgang |
|-----|---------|
| `GET /api/v1/app-idp-bindings` | Alle innloggede |
| `POST` / `DELETE` | Admin |

## Keycloak instance API

| Metode | Sti | Merknad |
|--------|-----|---------|
| GET | `/api/v1/instances/{id}/keycloak/overview` | Issuer, admin console, attachment-IP |
| POST | `/api/v1/instances/{id}/keycloak/wire-platform-oidc` | Admin; kun `keycloak-mgmt` |
| POST | `/api/v1/instances/{id}/keycloak/wire-app-idp` | Admin; kun `keycloak-apps` |
| GET | `/api/v1/instances/{id}/auth-gateway/overview` | Listen/upstream/issuer for auth-gateway |

## Keycloak (lab compose — fallback)

Valgfri compose-profil for rask IdP-smoke uten Catalog-deploy.

```bash
docker compose --profile keycloak up -d
bash scripts/seed-lab-keycloak-oidc.sh
```

| | |
|--|--|
| Admin console | `http://<mgmt-ip>:8080/` — default `admin`/`admin` |
| Realm | `axionet` |
| Testbruker | `labuser@lab.local` / `LabPass1!` |
| Break-glass | `Admin@internal` |
| Gruppe-mapping | Keycloak `operators` → lokal `Operators` (case-insensitive) |

Valgfri OTP: `ENABLE_LAB_OTP=1 bash scripts/seed-lab-keycloak-oidc.sh`

## AD

Bruk OIDC mot IdP som snakker med AD (Entra ID, eller Keycloak med AD federation). Ren LDAP-bind er ikke i scope ennå.

## Ikke i scope

- MFA/TOTP for lokal break-glass-login
- Full SAML SP
- Session revocation / refresh tokens
- Keycloak Postgres/HA (instanser bruker `start-dev` i denne fasen)
