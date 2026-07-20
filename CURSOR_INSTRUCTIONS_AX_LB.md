# AxioNet Load Balancer – utviklingsinstruksjoner for Cursor

## 1. Formål

Bygg en modulær, Linux-basert ADC- og lastbalanseringsplattform for gjenbrukte Citrix NetScaler SDX 14000-appliances.

Løsningen skal starte som et minimalt kontrollplan hvor kun følgende kjører:

- FastAPI-basert API
- React-basert GUI
- Docker Engine på verten

Alle dataplan-tjenester skal aktiveres, konfigureres og administreres fra GUI/API. Eksempler:

- HAProxy
- Varnish
- Nginx
- Coraza eller ModSecurity-basert WAF
- FRR
- PowerDNS
- Prometheus
- Grafana
- senere eventuelt VPN/IPsec, QAT-akselerasjon og andre nettverkstjenester

Systemet skal støtte flere uavhengige instanser av samme tjeneste. Eksempel:

- flere HAProxy-instanser
- egne IP-adresser per instans
- egne VLAN-tilkoblinger
- egne fysiske porter
- separate konfigurasjoner
- separat status, logging og livssyklus

Prosjektet skal behandles som et lite kontrollplan for nettverkstjenester, ikke som et enkelt GUI rundt `docker run`.

---

## 2. Overordnet arkitektur

Skill tydelig mellom kontrollplan og dataplan.

### Kontrollplan

- FastAPI
- React + TypeScript
- Tailwind CSS
- database
- servicekatalog
- konfigurasjonsgenerator
- validering
- Docker-administrasjon
- nettverksadministrasjon
- status og logging
- reconciliation-loop

### Dataplan

Dynamisk opprettede containere:

```text
ax-haproxy-<instance-id>
ax-varnish-<instance-id>
ax-nginx-<instance-id>
ax-frr-<instance-id>
ax-waf-<instance-id>
```

En blank installasjon skal bare starte:

```text
ax-api
ax-gui
```

Dataplan-containere skal bare finnes når brukeren har opprettet og aktivert en serviceinstans.

---

## 3. Teknologistakk

### Backend

Bruk:

- Python 3.12 eller nyere
- FastAPI
- Pydantic v2
- SQLAlchemy 2.x
- Alembic
- SQLite i første versjon
- `docker` Python SDK for Docker Engine API
- `pyroute2` for Linux-nettverk
- `httpx`
- `asyncio`
- Jinja2 for generering av konfigurasjonsfiler
- strukturert logging
- pytest
- ruff
- mypy

Ikke bruk `subprocess` mot Docker CLI der Docker SDK dekker behovet.

Bruk `subprocess` kun der det er nødvendig, og kapsle det bak tydelige adaptere med timeout, feilhåndtering og testbarhet.

### Frontend

Bruk:

- React
- TypeScript
- Vite
- Tailwind CSS
- React Router
- TanStack Query
- React Hook Form
- Zod
- Zustand bare dersom lokal GUI-state faktisk trenger det
- Vitest
- Testing Library
- Playwright for ende-til-ende-testing

Frontend skal være en egen container og konsumere FastAPI via `/api/v1`.

---

## 4. Viktige designprinsipper

### 4.1 Desired state og actual state

GUI/API skal ikke direkte bety «kjør denne Docker-kommandoen».

API-et lagrer ønsket tilstand:

```text
desired_state = running
actual_state = stopped
```

En reconciliation-loop sørger for at faktisk tilstand nærmer seg ønsket tilstand.

Eksempel:

1. Brukeren aktiverer en HAProxy-instans.
2. API lagrer `desired_state=running`.
3. Reconciler:
   - validerer konfigurasjon
   - renderer `haproxy.cfg`
   - kjører HAProxy config check
   - oppretter nødvendige nettverk
   - oppretter container
   - kobler nettverk
   - starter container
   - utfører health check
   - oppdaterer `actual_state`

### 4.2 Idempotens

Alle operasjoner skal være idempotente:

- opprettelse av eksisterende Docker-nettverk skal ikke feile ukontrollert
- samme reconcile-pass skal ikke lage duplikater
- restart av API skal rekonstruere tilstand fra databasen og Docker
- orphaned containere og nettverk skal kunne identifiseres

### 4.3 Versjonert konfigurasjon

All tjenestekonfigurasjon skal versjoneres.

Hver endring skal gi en `ConfigRevision`.

En revision skal inneholde:

- strukturert konfigurasjon
- rendret konfigurasjonsfil
- valideringsstatus
- tidspunkt
- bruker
- deployment-status
- eventuell feil
- mulighet for rollback

### 4.4 Minst mulig privilegier

I første MVP kan backend få tilgang til:

```text
/var/run/docker.sock
```

Dette betyr i praksis root-lignende kontroll over verten.

Arkitekturen skal derfor være forberedt på å splitte ut en lokal privilegert agent senere:

```text
GUI
  ↓
FastAPI control plane
  ↓ Unix socket
ax-agent
  ↓
Docker, VLAN, interfaces, namespaces
```

Ikke bygg systemet slik at Docker-socket-avhengigheten lekker gjennom hele kodebasen.

---

## 5. Foreslått prosjektstruktur

```text
ax-lb/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   └── v1/
│   │   ├── core/
│   │   ├── db/
│   │   ├── models/
│   │   ├── schemas/
│   │   ├── repositories/
│   │   ├── services/
│   │   │   ├── docker/
│   │   │   ├── networking/
│   │   │   ├── reconciliation/
│   │   │   ├── discovery/
│   │   │   └── configuration/
│   │   ├── plugins/
│   │   │   └── haproxy/
│   │   │       ├── definition.py
│   │   │       ├── models.py
│   │   │       ├── schemas.py
│   │   │       ├── renderer.py
│   │   │       ├── validator.py
│   │   │       ├── runtime.py
│   │   │       └── templates/
│   │   ├── workers/
│   │   └── main.py
│   ├── alembic/
│   ├── tests/
│   ├── pyproject.toml
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── api/
│   │   ├── components/
│   │   ├── features/
│   │   ├── layouts/
│   │   ├── pages/
│   │   ├── routes/
│   │   ├── hooks/
│   │   ├── schemas/
│   │   └── types/
│   ├── tests/
│   ├── package.json
│   ├── vite.config.ts
│   └── Dockerfile
├── compose.yaml
├── docs/
├── scripts/
├── packaging/
└── README.md
```

---

## 6. Datamodell

Bruk UUID-er som primærnøkler for API-ressurser.

### 6.1 PhysicalInterface

Representerer fysiske Linux-interface.

Felter:

```text
id
name
mac_address
pci_address
numa_node
speed_mbps
driver
description
mtu
link_state
administrative_state
exclusive_use
discovered_at
updated_at
```

Interface-data kan hentes fra:

- `/sys/class/net`
- `/sys/bus/pci`
- `ethtool`
- `pyroute2`
- `lspci` bare via en isolert adapter dersom nødvendig

### 6.2 Network

Representerer et logisk nettverk.

Felter:

```text
id
name
network_type
parent_interface_id
vlan_id
subnet
gateway
ip_range
mtu
docker_network_id
enabled
created_at
updated_at
```

Støtt minst:

```text
management
bridge
ipvlan-l2
ipvlan-l3
macvlan
untagged-access
```

Senere:

```text
exclusive-interface
sriov-vf
dpdk
af-xdp
```

### 6.3 ServiceDefinition

Tjenestekatalog.

Felter:

```text
service_type
display_name
description
container_image
default_version
configuration_schema
network_requirements
health_check_definition
supported_actions
plugin_version
enabled
```

Eksempler:

```text
haproxy
varnish
nginx
frr
powerdns
prometheus
grafana
```

### 6.4 ServiceInstance

En konkret tjenesteinstans.

Felter:

```text
id
name
service_type
desired_state
actual_state
image
image_version
restart_policy
configuration
last_error
health_status
created_at
updated_at
started_at
stopped_at
```

Gyldige desired states:

```text
running
stopped
deleted
```

Gyldige actual states:

```text
unknown
pending
creating
starting
running
degraded
stopping
stopped
error
deleting
```

### 6.5 NetworkAttachment

Knytter en serviceinstans til et logisk nettverk.

Felter:

```text
id
service_instance_id
network_id
ip_address
gateway
dns_servers
interface_alias
attachment_order
created_at
```

En HAProxy-instans skal kunne ha flere tilkoblinger:

```text
frontend0 → VLAN 100
backend0  → VLAN 200
mgmt0     → management
```

### 6.6 ConfigRevision

Felter:

```text
id
service_instance_id
revision_number
configuration
rendered_configuration
validation_status
validation_output
deployment_status
created_by
created_at
deployed_at
```

### 6.7 AuditEvent

Logg administrative handlinger:

```text
id
event_type
actor
resource_type
resource_id
payload
result
created_at
```

---

## 7. API-design

Bruk prefix:

```text
/api/v1
```

### System

```text
GET  /api/v1/system
GET  /api/v1/system/health
GET  /api/v1/system/capabilities
```

### Interfaces

```text
GET   /api/v1/interfaces
GET   /api/v1/interfaces/{id}
POST  /api/v1/interfaces/rescan
PATCH /api/v1/interfaces/{id}
```

### Networks

```text
GET    /api/v1/networks
POST   /api/v1/networks
GET    /api/v1/networks/{id}
PATCH  /api/v1/networks/{id}
DELETE /api/v1/networks/{id}
POST   /api/v1/networks/{id}/validate
```

### Service definitions

```text
GET /api/v1/service-definitions
GET /api/v1/service-definitions/{service_type}
```

### Service instances

```text
GET    /api/v1/instances
POST   /api/v1/instances
GET    /api/v1/instances/{id}
PATCH  /api/v1/instances/{id}
DELETE /api/v1/instances/{id}

POST /api/v1/instances/{id}/start
POST /api/v1/instances/{id}/stop
POST /api/v1/instances/{id}/restart
POST /api/v1/instances/{id}/reload
POST /api/v1/instances/{id}/validate
POST /api/v1/instances/{id}/reconcile

GET /api/v1/instances/{id}/status
GET /api/v1/instances/{id}/logs
GET /api/v1/instances/{id}/metrics
```

### Revisions

```text
GET  /api/v1/instances/{id}/revisions
GET  /api/v1/instances/{id}/revisions/{revision_id}
POST /api/v1/instances/{id}/revisions/{revision_id}/restore
```

### HAProxy-spesifikke ressurser

```text
GET/POST/PATCH/DELETE /api/v1/instances/{id}/haproxy/frontends
GET/POST/PATCH/DELETE /api/v1/instances/{id}/haproxy/backends
GET/POST/PATCH/DELETE /api/v1/instances/{id}/haproxy/servers
GET/POST/PATCH/DELETE /api/v1/instances/{id}/haproxy/certificates
GET/POST/PATCH/DELETE /api/v1/instances/{id}/haproxy/maps
GET/POST/PATCH/DELETE /api/v1/instances/{id}/haproxy/acls
```

Ikke legg all HAProxy-konfigurasjon i ett ustrukturert tekstfelt.

Tillat avansert råkonfigurasjon senere, men hovedmodellen skal være strukturert.

---

## 8. Docker-integrasjon

Opprett et abstraksjonslag:

```python
class ContainerRuntime(Protocol):
    async def create_instance(...)
    async def start_instance(...)
    async def stop_instance(...)
    async def remove_instance(...)
    async def inspect_instance(...)
    async def stream_logs(...)
    async def connect_network(...)
    async def disconnect_network(...)
```

Første implementasjon:

```text
DockerContainerRuntime
```

Ikke spre direkte kall til Docker SDK utover kodebasen.

Merk alle ressurser med labels:

```text
axionet.managed=true
axionet.instance_id=<uuid>
axionet.service_type=haproxy
axionet.revision=<revision>
```

Container-navn:

```text
ax-haproxy-<kort-uuid>
```

Nettverksnavn:

```text
ax-net-<network-id>
```

---

## 9. Linux-nettverk

### 9.1 Standardvalg

Bruk `ipvlan-l2` som standard for serviceinstanser.

Fordeler:

- flere containere kan bruke samme fysiske interface/VLAN
- færre MAC-adresser mot switch
- egne IP-adresser per container
- samme portnummer kan brukes i flere HAProxy-instanser

### 9.2 VLAN

Eksempel:

```text
enp4s0f0
└── enp4s0f0.100
    └── Docker ipvlan network
        ├── HAProxy A: 10.100.0.10
        └── HAProxy B: 10.100.0.11
```

### 9.3 Untagged port

Tillat opprettelse av nettverk direkte på parent-interface uten VLAN-tag.

### 9.4 Eksklusiv port

Ikke implementer i første MVP.

Planlegg datamodellen slik at en serviceinstans senere kan få:

- eksklusivt fysisk interface
- network namespace move
- SR-IOV VF
- DPDK-bound port

### 9.5 Sikkerhetsregler

Valider alltid:

- overlappende subnett
- dupliserte IP-adresser
- VLAN ID 1–4094
- ugyldig gateway
- parent-interface finnes
- parent-interface er ikke management-interface dersom dette kan kutte kontrolltilgang
- nettverk er ikke i bruk før sletting

---

## 10. HAProxy-plugin

HAProxy skal være første fullstendige tjenesteplugin.

### 10.1 Instanskatalog

```text
/var/lib/ax-lb/instances/<uuid>/
├── config/
│   └── haproxy.cfg
├── certs/
├── maps/
├── errors/
├── runtime/
│   └── admin.sock
└── logs/
```

### 10.2 Container

Bruk offisielt HAProxy-image med eksplisitt versjon.

Ikke bruk `latest`.

Eksempel:

```text
haproxy:3.2
```

Start i master-worker-modus.

### 10.3 Runtime socket

Konfigurer:

```haproxy
global
    stats socket /run/haproxy/admin.sock mode 660 level admin
```

API skal kunne hente:

- frontend status
- backend status
- server status
- sessions
- connection rate
- errors
- health state

Støtt senere:

- enable server
- disable server
- drain server
- set weight
- clear counters

### 10.4 Konfigurasjonsvalidering

Før deployment:

```text
haproxy -c -f /etc/haproxy/haproxy.cfg
```

Deployment skal avbrytes dersom valideringen feiler.

Valideringsfeilen skal lagres i `ConfigRevision.validation_output`.

### 10.5 Reload

Bruk kontrollert reload og unngå unødvendig nedetid.

MVP kan restarte container ved behov, men arkitekturen skal støtte HAProxy reload senere.

### 10.6 Første HAProxy-modell

Støtt:

- global defaults
- frontend
- backend
- server
- TCP- og HTTP-mode
- bind address
- bind port
- health checks
- roundrobin
- leastconn
- source
- TLS termination
- sertifikatbinding
- basic timeouts
- stats/runtime socket

---

## 11. Reconciliation-loop

Implementer som separat serviceklasse.

Pseudo-logikk:

```python
while True:
    instances = repository.list_reconcilable_instances()

    for instance in instances:
        try:
            await reconciler.reconcile(instance)
        except Exception as exc:
            await repository.mark_error(instance.id, str(exc))

    await asyncio.sleep(interval)
```

Reconciler skal:

1. hente desired state
2. inspisere Docker
3. kontrollere nettverk
4. kontrollere rendret konfigurasjon
5. sammenligne revision
6. utføre nødvendige handlinger
7. oppdatere actual state
8. skrive audit event

Ikke legg all logikk i FastAPI-route handlers.

---

## 12. Frontend-arkitektur

Bruk feature-basert struktur.

```text
src/features/
├── system/
├── interfaces/
├── networks/
├── instances/
├── haproxy/
├── revisions/
└── logs/
```

### 12.1 Hovedsider

- Dashboard
- Physical Interfaces
- Networks / VLAN
- Service Catalog
- Service Instances
- HAProxy instance detail
- Configuration Revisions
- System Logs
- Settings

### 12.2 Dashboard

Vis:

- systemstatus
- antall serviceinstanser
- running/degraded/error
- interfaces up/down
- nettverk
- siste feil
- CPU/minne
- Docker-status

### 12.3 Service Catalog

Vis tilgjengelige tjenester som kort:

- HAProxy
- Varnish
- Nginx
- FRR
- Prometheus
- Grafana

Bare HAProxy trenger full funksjonalitet i første MVP. FRR aktiveres i Milestone 8.

### 12.4 Opprett serviceinstans

Wizard:

1. velg tjenestetype
2. navn og versjon
3. velg nettverk/VLAN
4. angi IP-adresser
5. grunnkonfigurasjon
6. valider
7. opprett som stopped eller running

### 12.5 HAProxy GUI

Egne faner:

- Overview
- Frontends
- Backends
- Servers
- Certificates
- ACLs
- Runtime Status
- Logs
- Revisions

### 12.6 API-klient

Generer TypeScript-typer fra FastAPI OpenAPI dersom mulig.

Bruk TanStack Query for:

- caching
- refetch
- loading states
- mutations
- invalidation

Bruk Zod ved skjema og runtime-validering.

---

## 13. Persistens

Standard datarot:

```text
/var/lib/ax-lb/
```

Struktur:

```text
/var/lib/ax-lb/
├── ax-lb.db
├── instances/
├── certificates/
├── backups/
├── runtime/
└── logs/
```

Konfigurasjon:

```text
/etc/ax-lb/
```

Runtime-data:

```text
/run/ax-lb/
```

---

## 14. Docker Compose for blank installasjon

Første `compose.yaml` skal bare starte:

- backend
- frontend

Eksempel på tjenester:

```yaml
services:
  api:
    build: ./backend
    container_name: ax-api
    restart: unless-stopped
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - /var/lib/ax-lb:/var/lib/ax-lb
      - /run/ax-lb:/run/ax-lb
    networks:
      - control

  gui:
    build: ./frontend
    container_name: ax-gui
    restart: unless-stopped
    depends_on:
      - api
    networks:
      - control
    ports:
      - "80:80"

networks:
  control:
    driver: bridge
```

Vurder om backend trenger host network eller ekstra capabilities for `pyroute2`.

Ikke gi bredere privilegier enn nødvendig uten å dokumentere hvorfor.

---

## 15. Første MVP

Bygg i denne rekkefølgen.

### Milestone 1 – grunnplattform

- FastAPI starter
- React/Tailwind starter
- health endpoint
- SQLite og Alembic
- grunnleggende systemstatus
- Docker engine connectivity
- enkel dashboard-side

### Milestone 2 – interface discovery

- oppdag fysiske interface
- MAC
- driver
- PCI-adresse
- NUMA-node
- link state
- hastighet
- vis i GUI
- rescan-funksjon

### Milestone 3 – nettverk

- opprett Network
- VLAN
- ipvlan-l2
- statisk subnett/gateway
- validering
- opprett Docker-nettverk
- vis faktisk status

### Milestone 4 – HAProxy instance lifecycle

- opprett HAProxy-instans
- knytt til ett eller flere nettverk
- generer config
- valider config
- start/stop/restart
- actual state
- container logs

### Milestone 5 – HAProxy strukturert konfigurasjon

- frontends
- backends
- servers
- health checks
- runtime socket
- status i GUI

### Milestone 6 – revisions og rollback

- lagre revision
- vise diff
- deploy revision
- rollback

### Milestone 7 – flere instanser

- flere HAProxy-containere
- samme porter på separate IP-er
- ulike VLAN
- separat status og logging

### Milestone 8 – FRR (BGP MVP)

Første ikke-HAProxy dataplan-plugin. Målet er at FRR kan opprettes, nettkobles, valideres, startes og etablere BGP-peering — uten full VIP/anycast-orkestrering.

#### Plattformkrav (før eller parallelt)

- Tynn service-plugin-kontrakt: definition, schema, render, validate, container-spec (image, volumes, command, capabilities)
- Fjern HAProxy-hardkoding i instance lifecycle / Docker-adapter (type-dispatch)
- Støtte capabilities på dataplan-containere (minst `NET_ADMIN` for FRR)
- Oppdater capabilities/katalog slik at `frr` er enabled

#### FRR-funksjon

- Aktiver FRR i servicekatalog (`frrouting/frr`, pinnet versjon — ikke `latest`)
- Livssyklus: create, start, stop, restart, logs, reconcile
- Nettverk: samme ipvlan-l2-attachments og valgfri statisk IP som øvrige serviceinstanser
- Strukturert config: lokal ASN, router-id, neighbors (IP, remote-AS, valgfri MD5), prefixes/networks å annonsere
- Render til FRR-konfigurasjon på disk under instance data-dir
- Valider config før deploy (ephemeral container / vtysh-sjekk)
- Revisions: gjenbruk eksisterende revision, diff, deploy og rollback
- Minimal runtime-status i GUI (f.eks. BGP summary / neighbor state)
- GUI: wizard-steg for FRR + instance detail (Overview, BGP, Logs, Revisions)
- Tester: unit, API og mock Docker; lab-smoke når testmiljø er klart

#### Akseptansekriterium (lab)

Fra GUI/API:

1. Opprett FRR-instans
2. Knytt til dataplan-VLAN med statisk IP
3. Konfigurer BGP neighbor
4. Start instans
5. Peer går til Established
6. Annonser et lab-test-prefix
7. Prefix er synlig på peer

#### Utenfor Milestone 8

- Automatisk «annonser VIP fra HAProxy-instans»
- Anycast-eierskap / VIP-orkestrering
- VRRP
- Multi-node / config sync
- OSPF (kan komme i en senere del-milepæl)
- IPv6 BGP (kan komme senere)

#### Lab-forutsetninger

Dokumenter og verifiser før lab-smoke:

- Dedikert dataplan-VLAN (ikke bland management med mindre det er bevisst)
- Planlagte IP-er for FRR-container og BGP-peer i samme L2/subnet (enklest)
- Én BGP-peer (FRR/BIRD-VM eller lab-ruter) med lokal ASN, remote ASN og peer-IP
- Lab-only test-prefix som ikke kolliderer med produksjon
- Reachability: ping FRR↔peer; TCP 179 ikke blokkert
- Vert støtter ipvlan-l2 mot parent/VLAN som for HAProxy

---

## 16. Testkrav

### Backend

Skriv tester for:

- modeller og schemas
- repository-lag
- config rendering
- HAProxy validation
- Docker adapter med mocks
- network validation
- reconciliation
- API-endepunkter
- idempotens

### Frontend

Skriv tester for:

- skjemaer
- API-hooks
- instance wizard
- statusvisning
- feiltilstander
- loading states

### Integrasjon

Lag integrasjonstester som:

1. oppretter testnettverk
2. oppretter HAProxy-instans
3. renderer config
4. starter container
5. verifiserer health
6. stopper og sletter instans

---

## 17. Kodestandard

### Python

- full typing
- unngå `Any`
- små serviceklasser
- dependency injection
- ingen forretningslogikk i routes
- ingen globale Docker-klienter uten livssyklus
- eksplisitt feilhåndtering
- domenespesifikke exceptions
- async der det faktisk gir verdi

### TypeScript

- `strict: true`
- ingen ukritisk bruk av `any`
- API-responser skal types
- komponenter skal være små
- ikke legg datahenting direkte i presentasjonskomponenter
- gjenbruk skjemaer og typer

### Generelt

- skriv lesbar kode
- ikke overdesign første MVP
- ikke implementer Kubernetes
- ikke implementer egen container runtime
- behold plugin-grenser tydelige
- dokumenter sikkerhetskritiske valg

---

## 18. Sikkerhet

Første versjon kan være administrativt intern, men bygg for senere autentisering.

Planlegg for:

- lokale brukere
- roller
- OIDC
- MFA
- audit log
- CSRF-beskyttelse der relevant
- rate limiting på API
- secrets utenfor database der mulig
- sertifikater med restriktive filrettigheter
- ingen Docker-socket eksponert mot GUI
- ingen vilkårlige shell-kommandoer fra brukerinput

Valider alle navn før de brukes som:

- filnavn
- containernavn
- Docker network-navn
- interface-navn
- template-input

---

## 19. Fremtidige utvidelser

Ikke implementer disse nå, men unngå arkitekturvalg som blokkerer dem:

- to-node cluster
- BGP-annonserte VIP-er (automatisk VIP/anycast knyttet til LB-instanser; grunnleggende BGP-peering er Milestone 8)
- VRRP
- config sync
- PostgreSQL
- intern privilegert agent
- Intel QAT
- SR-IOV
- DPDK
- AF_XDP
- Varnish
- WAF
- PowerDNS/GSLB
- Vault eller intern PKI
- ACME
- Prometheus/Grafana
- frontpanel LCD og knapper
- FreeHCI-integrasjon
- GitOps/Ansible

---

## 20. Cursor-arbeidsmåte

Når Cursor genererer kode:

1. Les denne filen først.
2. Implementer én milestone av gangen.
3. Lag en kort plan før større endringer.
4. Ikke endre arkitektur uten å forklare konsekvensene.
5. Ikke generer store mengder utestet kode i én operasjon.
6. Oppdater tester samtidig med funksjonalitet.
7. Oppdater Alembic-migrasjoner ved modellendringer.
8. Oppdater OpenAPI og frontend-typer ved API-endringer.
9. Behold bakoverkompatibilitet innen samme API-versjon.
10. Logg alle reconcile- og deployment-feil med kontekst.
11. Ikke bruk mock-data i produksjonskode.
12. Ikke hardkod interface-navn, VLAN eller IP-adresser.
13. Ikke bruk Docker `latest` tags.
14. Ikke slett Docker-ressurser som ikke har `axionet.managed=true`.
15. Vis alltid konkrete filer som skal endres før en større refaktorering.

---

## 21. Første oppgave til Cursor

Start med Milestone 1.

Lever:

- prosjektstruktur
- `compose.yaml`
- FastAPI-applikasjon
- `/api/v1/system/health`
- SQLAlchemy/Alembic-oppsett
- React + TypeScript + Vite
- Tailwind CSS
- enkel dashboard-side
- TanStack Query API-klient
- Dockerfiles
- `.env.example`
- pytest-oppsett
- Vitest-oppsett
- ruff/mypy-konfigurasjon
- README med oppstartsinstruksjoner

Krav:

- `docker compose up --build` skal starte API og GUI
- GUI skal vise resultatet fra health-endepunktet
- ingen dataplan-tjenester skal startes
- tester skal kunne kjøres lokalt
- alle images skal ha eksplisitt versjon
