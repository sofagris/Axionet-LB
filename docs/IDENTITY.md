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

### Binding til Customers

Tabell `app_idp_bindings` knytter en App IdP til soft-referanser (`customer_id`, valgfri `application_id`) som matcher mock-IDene under **Kunder** (f.eks. `kunde-a` / `app-web`).

| API | Tilgang |
|-----|---------|
| `GET /api/v1/app-idp-bindings` | Alle innloggede |
| `POST` / `DELETE` | Admin |

GUI: applikasjonsdetalj under Kunder viser binding; Identity → App IdP lar admin sette valgfritt kunde-scope.

## Keycloak (lab)

Valgfri compose-profil for lokal IdP-smoke (ikke produksjons-HA).

```bash
# Start Keycloak (port 8080) ved siden av api/gui
docker compose --profile keycloak up -d

# Koble AxioNet Identity (OIDC-kilde + UPN lab.local + App IdP-metadata)
bash scripts/seed-lab-keycloak-oidc.sh
```

| | |
|--|--|
| Admin console | `http://<mgmt-ip>:8080/` — `KEYCLOAK_ADMIN` / `KEYCLOAK_ADMIN_PASSWORD` (default `admin`/`admin`) |
| Realm | `axionet` (importert fra `deploy/keycloak/axionet-realm.json`) |
| Issuer | `http://<mgmt-ip>:8080/realms/axionet` |
| GUI client | `axionet-gui` / secret `axionet-gui-lab-secret` |
| App client | `axionet-app` (metadata for Customers App IdP) |
| Testbruker | `labuser@lab.local` / `LabPass1!` |
| Break-glass | fortsatt `Admin@internal` |
| Gruppe-mapping | Keycloak `operators` → lokal gruppe `Operators`/`operators` (case-insensitive; rolle `operator`) |

Hostname/port styres av `KEYCLOAK_HOSTNAME` + `KEYCLOAK_HOSTNAME_PORT` (må være nåbar fra **nettleser** og **api-container**).

Realm-JSON skal **ikke** sette `defaultClientScopes` / egen `clientScopes`-liste som erstatter Keycloaks innebygde `profile`/`email` — det gir `invalid_scope` i OIDC authorize. Groups mappes via `protocolMappers` på clienten.

Seed-scriptet sørger for at en lokal Operators-gruppe finnes. OIDC matcher gruppenavn **case-insensitive**. Etter SSO er `effective_role` = `operator` via medlemskap (brukerens egen `role` forblir typisk `viewer`).

### Valgfri lab-OTP (Keycloak)

```bash
ENABLE_LAB_OTP=1 bash scripts/seed-lab-keycloak-oidc.sh
```

Da får `labuser` required action `CONFIGURE_TOTP` og må enrollere authenticator ved neste login. (Gjelder Keycloak-login, ikke lokal `Admin@internal`.)

Ved behov for ren reimport:

```bash
docker compose --profile keycloak stop keycloak
docker compose --profile keycloak rm -f keycloak
docker volume rm -f axionet-lb_keycloak-data
docker compose --profile keycloak up -d keycloak
bash scripts/seed-lab-keycloak-oidc.sh
```

## AD

Bruk OIDC mot IdP som snakker med AD (Entra ID, eller Keycloak med AD federation). Ren LDAP-bind er ikke i scope ennå; samme UPN-routing kan senere peke på en `ldap`-kilde.

## Ikke i scope

- MFA/TOTP for lokal break-glass-login
- Full SAML SP
- Session revocation / refresh tokens
- Keycloak Postgres/HA / AD-federation (lab bruker `start-dev`)
