# Lokal autentisering (Identity fase 1)

AxioNet LB bruker **lokal brukerdatabase** for plattform-login. Dette er break-glass: lokal admin skal alltid fungere, også når OIDC/Keycloak legges til i fase 2.

## Roller

Låste plattformroller:

| Rolle | Betydning |
|-------|-----------|
| `admin` | Full tilgang, inkl. bruker-/gruppeadministrasjon |
| `operator` | Drift (fase 1: samme API-tilgang som innlogget; finmasket RBAC kommer senere) |
| `viewer` | Lesetilgang (samme merknad) |

**Effektiv rolle** = høyeste blant brukerens egen `role` og rollene til gruppene brukeren er medlem av (`admin` > `operator` > `viewer`).

## Datamodell

- `users`: lokal konto (`auth_source=local`), valgfri `email` / `display_name`
- `groups`: navn, beskrivelse, `role`
- `user_groups`: medlemskap

Bootstrap-admin opprettes ved oppstart hvis den mangler (`AX_AUTH_DEFAULT_ADMIN_USERNAME` / `AX_AUTH_DEFAULT_ADMIN_PASSWORD`, default `Admin` / `Password`).

## API

| Endepunkt | Tilgang |
|-----------|---------|
| `POST /api/v1/auth/login` | Offentlig (lokal passord) |
| `GET /api/v1/auth/me` | Innlogget — returnerer `groups[]` og `effective_role` |
| `/api/v1/users/*` | `effective_role === admin` |
| `/api/v1/groups/*` | `effective_role === admin` |

### Beskyttelse

- Kan ikke deaktivere **bootstrap-admin**
- Kan ikke deaktivere eller nedgradere den **siste aktive lokale admin** (basert på brukerens egen `role=admin`)

## GUI

**System → Brukere** er synlig bare når `effective_role === admin`. Der administreres brukere, grupper og medlemskap.

## Fase 2 (ikke implementert)

- Valgfri OIDC-login (f.eks. Keycloak)
- Upsert av lokal bruker på `oidc_sub`
- Mapping IdP-grupper → lokale groups/roles
- Lokal `POST /api/v1/auth/login` forblir aktiv

## Ikke i scope

- MFA/TOTP for lokal login
- Tenant-scoped RBAC
- Session-revocation / refresh tokens
- Keycloak-container deploy
