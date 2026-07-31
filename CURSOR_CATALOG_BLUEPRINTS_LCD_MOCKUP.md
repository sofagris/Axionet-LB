# Cursor-oppdrag: utvidet Catalog, Blueprints, Providers og LCD-mockup for AxioNet-LB

## 0. Oppdragets ramme

Dette er en **utvidelse av eksisterende AxioNet-LB**, ikke et nytt prosjekt.


Denne oppgaven er i første omgang en **visuell og interaktiv mockup** som skal gi grunnlag for videre produktdesign. Ikke implementer faktisk installasjon av PowerDNS, Cloudflare, Guacamole, Horizon, Keycloak eller LCD-driver i denne fasen.

Målet er å:

1. gjøre Service Catalog vesentlig rikere og mer intuitiv
2. skille tydelig mellom tjenester, plattformtjenester, blueprints og eksterne providers
3. vise hvordan komplekse løsninger kan beskrives før deployment
4. legge inn en mockup for LCD/frontpanel under Settings
5. bevare eksisterende funksjonalitet for HAProxy og FRR
6. bruke eksisterende AxioNet-design som utgangspunkt, men gi katalogelementene tydeligere identitet

Ikke skriv om hele applikasjonen. Arbeid inkrementelt.

---

# 1. Før du begynner

Utfør denne inspeksjonen først:

1. Les:
   - `README.md`
   - `CURSOR_INSTRUCTIONS_AX_LB.md`
   - frontend routing
   - eksisterende Catalog-side
   - eksisterende Settings-side
   - eksisterende API-klient og typer
   - i18n-strukturen
   - eksisterende testoppsett

2. Finn de faktiske filene som i dag implementerer:
   - Catalog
   - service definitions
   - service cards
   - opprettelse av HAProxy/FRR-instanser
   - Settings
   - navigasjon
   - tema og CSS-variabler

3. Lag en kort endringsplan før kode skrives.

4. Ikke anta filnavnene i dette dokumentet er identiske med repoet. Tilpass implementasjonen til faktisk struktur.

5. Ikke fjern eller svekk eksisterende opprettelsesflyt for HAProxy og FRR.

---

# 2. Produktmodell for katalogen

Catalog skal ikke behandle alle elementer som samme type.

Innfør følgende begreper i frontend-mockupen:

```ts
type CatalogItemKind =
  | "service"
  | "core-service"
  | "stack"
  | "blueprint"
  | "integration"
  | "provider";
```

## 2.1 Service

En enkelt lokal dataplan- eller nettverkstjeneste som normalt gir én instans/container.

Eksempler:

- HAProxy
- FRR
- Varnish
- Nginx
- dnsdist
- PowerDNS Authoritative
- PowerDNS Recursor
- Prometheus
- Alertmanager
- Grafana
- Loki
- Coraza WAF

Primærhandling:

```text
Opprett instans
```

## 2.2 Core service

En lokal plattformtjeneste som andre tjenester og blueprints kan avhenge av.

Eksempler:

- Identity & MFA
- PKI / ACME
- DNS-plattform
- database
- secrets

Primærhandling:

```text
Konfigurer
```

eller:

```text
Opprett tjeneste
```

## 2.3 Stack

Et kuratert oppsett av flere lokale tjenester som deployes sammen.

Eksempler:

- PowerDNS Platform
- Monitoring Stack
- Highly Available DNS

Primærhandling:

```text
Deploy stack
```

## 2.4 Blueprint

En veiviser som genererer flere ressurser, nettverk, konfigurasjoner og avhengigheter.

Eksempler:

- Apache Guacamole
- Geo-redundant Load Balancer
- Secure Web Frontend
- Generic Web Application
- Generic TCP Service

Primærhandling:

```text
Start veiviser
```

## 2.5 Integration

En ferdig integrasjonsmal mot et eksternt eller eksisterende produkt.

Eksempler:

- Omnissa Horizon UAG
- eksisterende Active Directory
- ekstern OIDC-provider
- ekstern DNS-provider

Primærhandling:

```text
Konfigurer integrasjon
```

## 2.6 Provider

En ekstern plattform som kobles til med API-legitimasjon og tilbyr capabilities til blueprints.

Første provider:

- Cloudflare

Mulige senere providers:

- Route 53
- Azure DNS
- Akamai
- NS1
- generisk RFC2136
- generisk REST-provider

Primærhandling:

```text
Koble til
```

Når provider allerede er konfigurert:

```text
Administrer
```

---

# 3. Kategorier i Catalog

Catalog-siden skal ha kategorifilter som fungerer sammen med søk.

Bruk disse kategoriene:

```ts
type CatalogCategory =
  | "traffic"
  | "core"
  | "security"
  | "observability"
  | "blueprints"
  | "providers";
```

Vis kategorier som tabs eller filter-chips:

```text
Alle
Trafikk
Kjernetjenester
Sikkerhet
Observability
Blueprints
Providers
```

Ikke del siden i to helt separate hardkodede Catalog-sider i første mockup. Én katalog med tydelig filtrering gir bedre oversikt og gjør det mulig å søke på tvers.

---

# 4. Første kataloginnhold

Mock-dataene skal minst inneholde følgende.

## 4.1 Trafikk og nettverk

### HAProxy

```text
kind: service
category: traffic
status: available
version: 3.2.6
capabilities:
- L4
- L7
- TCP
- HTTP
- TLS termination
- health checks
- runtime API
```

### FRR

```text
kind: service
category: traffic
status: available
version: 10.2.6
capabilities:
- BGP
- route advertisement
- looking glass
- IPv4
- IPv6
```

### dnsdist

```text
kind: service
category: traffic
status: planned
capabilities:
- DNS load balancing
- DNS filtering
- rate limiting
- caching
- DoT
- DoH
- metrics
```

### Varnish

```text
kind: service
category: traffic
status: planned
capabilities:
- HTTP cache
- reverse proxy
- edge caching
```

### Nginx

```text
kind: service
category: traffic
status: planned
capabilities:
- web server
- reverse proxy
- static content
```

---

## 4.2 Kjernetjenester

### PowerDNS Authoritative

```text
kind: core-service
category: core
status: planned
capabilities:
- authoritative DNS
- REST API
- DNSSEC
- database backend
- GeoIP
- Lua Records
- source-aware responses
```

### PowerDNS Recursor

```text
kind: core-service
category: core
status: planned
capabilities:
- recursive DNS
- DNSSEC validation
- RPZ
- Lua policy
- caching
```

### PowerDNS Platform

Dette skal være en stack, ikke enda et enkelt DNS-kort.

```text
kind: stack
category: core
status: concept
components:
- dnsdist
- PowerDNS Authoritative
- PowerDNS Recursor
- optional database
capabilities:
- split DNS
- GeoDNS
- health-aware DNS
- source-aware policy
- DNSSEC
- RPZ
```

PowerDNS skal være standard DNS-retning i denne mockupen. Ikke legg inn BIND som eget katalogelement.

Vis gjerne en informasjonsmerknad i detaljvisningen:

```text
PowerDNS Views er egnet for split-horizon, mens Lua Records og GeoIP
kan brukes for kilde-, lokasjons- og helsetilpassede svar.
```

Ikke presenter eksperimentelle eller framtidige funksjoner som ferdig produksjonsstøtte. Dette er mockuptekst.

### Identity & MFA

Bruk Keycloak som første konseptuelle implementasjon, men produktkortet skal hete:

```text
Identity & MFA
```

```text
kind: core-service
category: core
status: concept
implementationHint: Keycloak
capabilities:
- OIDC
- SAML
- LDAP / AD federation
- TOTP
- WebAuthn / passkeys
- application authentication
```

### PKI / ACME

```text
kind: core-service
category: core
status: concept
implementationHint: step-ca
capabilities:
- internal CA
- ACME
- certificate renewal
- mTLS
- trust distribution
```

---

## 4.3 Sikkerhet

### Coraza WAF

```text
kind: service
category: security
status: concept
capabilities:
- WAF
- OWASP CRS
- request filtering
- audit events
```

### Secure Web Frontend

```text
kind: blueprint
category: security
status: concept
components:
- HAProxy
- Coraza WAF
- certificate
- optional Identity & MFA
- rate limiting
- monitoring
```

---

## 4.4 Observability

### Prometheus

```text
kind: service
category: observability
status: planned
```

### Alertmanager

```text
kind: service
category: observability
status: planned
```

### Grafana

```text
kind: service
category: observability
status: planned
```

### Loki

```text
kind: service
category: observability
status: concept
```

### Monitoring Stack

```text
kind: stack
category: observability
status: concept
components:
- Prometheus
- Alertmanager
- Grafana
- Loki
- node metrics
- HAProxy metrics
- FRR metrics
```

---

## 4.5 Blueprints og integrasjoner

### Apache Guacamole

```text
kind: blueprint
category: blueprints
status: concept
components:
- Guacamole web application
- guacd
- PostgreSQL or MariaDB
- HAProxy frontend
- TLS certificate
- optional Identity & MFA
- health checks
```

Vis i detaljdrawer at dette er et flerkomponent-oppsett.

### Omnissa Horizon UAG

```text
kind: integration
category: blueprints
status: concept
components:
- external VIP
- HAProxy frontend
- UAG backend pool
- health checks
- source persistence
- TLS
- required service ports
- monitoring
```

Det skal være tydelig at AxioNet konfigurerer lastbalansering og integrasjon mot eksisterende Horizon/UAG, ikke nødvendigvis installerer hele Horizon-plattformen.

### Geo-redundant Load Balancer

```text
kind: blueprint
category: blueprints
status: concept
components:
- HAProxy nodes across sites
- FRR / BGP
- health-controlled route withdrawal
- config sync
- optional PowerDNS
- optional Cloudflare provider
- observability
```

### Highly Available DNS

```text
kind: blueprint
category: blueprints
status: concept
components:
- dnsdist nodes
- PowerDNS Authoritative
- PowerDNS Recursor
- database or replicated backend
- health checks
- optional BGP advertisement
```

### Generic Web Application

```text
kind: blueprint
category: blueprints
status: concept
steps:
- VIP
- frontend protocol
- TLS
- backend pool
- health check
- persistence
- optional WAF
- optional MFA
- optional DNS provider
```

### Generic TCP Service

```text
kind: blueprint
category: blueprints
status: concept
steps:
- VIP
- listener port
- backend pool
- TCP health check
- optional PROXY protocol
- optional source persistence
- optional BGP advertisement
```

---

## 4.6 Providers

### Cloudflare

```text
kind: provider
category: providers
status: concept
connectionState: disconnected
capabilities:
- DNS zones and records
- proxied DNS records
- Load Balancing
- pools and origins
- health monitors
- steering policies
- Cloudflare Tunnel
- Cloudflare Access
```

Providerkortet skal skille seg visuelt fra lokale tjenester.

Vis i detaljdrawer:

```text
Authentication:
- API token
- account ID
- allowed zones
- selected capabilities
```

Vis status:

```text
Ikke tilkoblet
```

og handling:

```text
Koble til Cloudflare
```

Mockupen skal ikke lagre reelle tokens eller forsøke API-kall.

---

# 5. Rikere katalogkort

Dagens enkle kort skal erstattes eller utvides med rikere kort.

## 5.1 Kortets innhold

Hvert kort skal kunne vise:

1. logo eller tydelig ikon
2. navn
3. typebadge:
   - SERVICE
   - CORE SERVICE
   - STACK
   - BLUEPRINT
   - INTEGRATION
   - PROVIDER
4. statusbadge:
   - Tilgjengelig
   - Planlagt
   - Konsept
   - Tilkoblet
   - Ikke tilkoblet
5. kort og presis beskrivelse
6. versjon eller implementation hint
7. 3–5 capability-chips
8. komponentantall for stack/blueprint
9. avhengigheter dersom relevant
10. primærhandling
11. sekundærhandling:
    - Detaljer
    - Se arkitektur
    - Forhåndsvis
12. valgfri liten statuslinje nederst

## 5.2 Logo og ikon

Bruk en konsekvent strategi:

- Bruk offisielle produktlogoer der lisens og pakke gjør det hensiktsmessig.
- Ikke hotlink bilder fra eksterne nettsteder.
- Bruk lokale SVG-er eller en etablert icon-pakke.
- Bruk Lucide til generiske systemikoner.
- Bruk produktlogoer primært som gjenkjennelig identitet, ikke som stor dekorasjon.
- Ha fallback til et generisk AxioNet-ikon dersom produktlogo mangler.
- Logo skal ha korrekt kontrast i både dark og light mode.

Foreslått implementasjon:

```ts
type CatalogBrand = {
  iconKind: "lucide" | "product" | "axionet";
  iconName: string;
  accentToken: CatalogAccent;
};
```

Ikke bind designet direkte til hardkodede hex-farger i komponenten.

## 5.3 Visuell identitet per domene

Bruk diskrete, semantiske aksenter:

```text
Traffic / Load Balancing  -> teal
Routing / BGP             -> amber
DNS / Core                -> violet or indigo
Security                  -> magenta
Observability             -> lime
Provider / Cloud          -> sky blue
Blueprint                 -> copper
```

Grunnflaten skal fortsatt være rolig. Fargen skal hjelpe med identifikasjon, ikke gjøre alle kort selvlysende.

Bruk:

- aksentlinje
- ikonbakgrunn
- typebadge
- enkelte chips
- hover/focus-state

Ikke bruk fullfarget kortbakgrunn.

---

# 6. Catalog-layout

## 6.1 Toppområde

Vis:

```text
Service Catalog
Tjenester, plattformkomponenter, blueprints og eksterne providers.
```

Legg inn:

- søk
- kategorifilter
- typefilter
- statusfilter
- sortering
- toggle for grid/list hvis enkelt å implementere
- antall treff

Eksempel:

```text
[Søk i katalogen...] [Alle kategorier] [Alle typer] [Status] [Sortering]
```

## 6.2 Fremhevet seksjon

Øverst kan det være én liten, kuratert seksjon:

```text
Anbefalt
```

Vis maksimalt 2–3 elementer:

- Geo-redundant Load Balancer
- PowerDNS Platform
- Apache Guacamole

Ikke la denne dominere hele siden.

## 6.3 Kataloggrid

- 3 kolonner på stor desktop
- 2 på middels
- 1 på mobil
- kort med konsistent høyde innen samme rad
- ikke skjul viktig innhold bak hover
- tastaturnavigerbart

---

# 7. Detaljdrawer

Klikk på et kort eller «Detaljer» og åpne en drawer fra høyre.

Drawer skal fungere som katalogens primære inspeksjonsflate.

## 7.1 Drawer-header

Vis:

- logo/ikon
- navn
- type
- status
- versjon/implementation hint
- close-knapp

## 7.2 Tabs

Bruk relevante tabs:

```text
Oversikt
Capabilities
Arkitektur
Krav
Eksempel
```

Providers kan i tillegg ha:

```text
Tilkobling
Permissions
```

## 7.3 Arkitekturvisning

For stack, blueprint og integration:

Vis en enkel read-only flow:

```text
Internet
  -> HAProxy
  -> WAF
  -> Guacamole
  -> guacd
  -> targets
```

eller:

```text
Clients
  -> dnsdist
  -> PowerDNS Recursor
  -> Internet DNS
```

Bruk samme visuelle språk som AxioNet Traffic Flow, men hold det enkelt i katalogdrawer.

Noder skal kunne markeres. Klikk på en node viser en liten infoboks i draweren med:

- rolle
- image/implementation
- dependency
- exposed ports
- health check
- optional/required

Dette er mockupdata.

## 7.4 Primærhandling

Handlingen avhenger av type:

```text
service       -> Opprett instans
core-service  -> Opprett tjeneste
stack         -> Deploy stack
blueprint     -> Start veiviser
integration   -> Konfigurer integrasjon
provider      -> Koble til
```

Bare HAProxy og FRR skal bruke eksisterende reelle opprettelsesflyt i denne fasen.

Alle øvrige handlinger kan åpne en «mockup wizard» eller vise:

```text
Denne funksjonen er foreløpig en designmockup.
```

---

# 8. Blueprint-preview

Lag en gjenbrukbar preview-komponent for blueprints.

Den skal vise:

- navn
- mål
- komponenter
- nødvendige nettverk
- eksterne avhengigheter
- secrets som vil kreves
- DNS/TLS-valg
- health checks
- observability
- estimert antall containere
- optional components
- output resources

Eksempel for Guacamole:

```text
Resources:
- 1 Guacamole web
- 1 guacd
- 1 database
- 1 HAProxy frontend
- 1 certificate
- 2 networks
```

Eksempel for Horizon:

```text
Managed by AxioNet:
- VIP
- frontend
- TLS
- UAG backend pool
- persistence
- health checks

External:
- Horizon Connection Servers
- UAG appliances
- identity platform
```

---

# 9. Datamodell for mockup

Start med statiske frontend-definisjoner eller et mock-endepunkt.

Ikke bygg full database- og deploymentmodell nå.

Foreslått TypeScript-modell:

```ts
type CatalogStatus =
  | "available"
  | "planned"
  | "concept"
  | "connected"
  | "disconnected";

type CatalogAction =
  | "create-instance"
  | "create-service"
  | "deploy-stack"
  | "start-wizard"
  | "configure-integration"
  | "connect-provider"
  | "manage-provider";

type CatalogComponent = {
  id: string;
  name: string;
  role: string;
  required: boolean;
  implementation?: string;
  ports?: string[];
  healthCheck?: string;
};

type CatalogItem = {
  id: string;
  slug: string;
  name: string;
  kind: CatalogItemKind;
  category: CatalogCategory;
  status: CatalogStatus;
  summary: string;
  description: string;
  version?: string;
  implementationHint?: string;
  image?: string;
  capabilities: string[];
  dependencies?: string[];
  components?: CatalogComponent[];
  requirements?: string[];
  tags: string[];
  primaryAction: CatalogAction;
  featured?: boolean;
  brand: CatalogBrand;
};
```

Hold modellen generell nok til å flytte til backend senere.

---

# 10. Provider-modell

Lag en separat frontendtype for providerens tilkoblingsstatus:

```ts
type ProviderConnectionState =
  | "not-configured"
  | "validating"
  | "connected"
  | "degraded"
  | "error";

type ProviderConnectionSummary = {
  providerId: string;
  state: ProviderConnectionState;
  accountLabel?: string;
  capabilityNames: string[];
  lastCheckedAt?: string;
  lastError?: string;
};
```

Cloudflare-kortet skal kunne vise:

```text
Not configured
```

eller mockstatus:

```text
Connected
3 zones
DNS + Load Balancing + Tunnel
```

Ikke legg tokenverdier i frontend-state, localStorage, fixtures eller skjermbilder.

---

# 11. PowerDNS-design

PowerDNS skal presenteres som en familie, men uten å fylle katalogen med duplikater.

Anbefalt visning:

1. Individuelle tjenester:
   - PowerDNS Authoritative
   - PowerDNS Recursor
   - dnsdist

2. Ett rikere stack-kort:
   - PowerDNS Platform

I detail drawer for PowerDNS Platform:

```text
Authoritative DNS
- zones
- DNSSEC
- API
- source-aware answers
- GeoIP / Lua Records

Recursive DNS
- cache
- DNSSEC validation
- RPZ
- Lua policy

DNS traffic layer
- dnsdist
- load balancing
- filtering
- rate limiting
- metrics
```

Vis «Views / split DNS» som en capability med en liten «experimental»-badge dersom teksten omtaler PowerDNS Views spesifikt.

Ikke foreslå BIND i mockupen.

---

# 12. Cloudflare-design

Cloudflare skal være en provider, ikke en container-service.

Kortet bør vise:

```text
Cloudflare
Provider
DNS, Load Balancing, Tunnel and Access
```

Capabilities:

- DNS
- Proxy
- Load Balancing
- Health monitors
- Traffic steering
- Tunnel
- Access

Drawer skal ha en mockup av tilkoblingsoppsett:

```text
Connection name
Account ID
API token
Allowed zones
Capabilities
[Test connection]
```

Tokenfeltet skal være password-type, aldri vises i klartekst og aldri lagres av mockupen.

Legg inn en informasjonstekst:

```text
Bruk et begrenset API-token med bare nødvendige rettigheter.
```

Blueprints skal kunne vise Cloudflare som valgfri provider:

```text
DNS provider: Cloudflare
Proxy traffic through Cloudflare: yes/no
Create health monitor: yes/no
Create Cloudflare Load Balancer: yes/no
Use Tunnel: yes/no
```

Kun visuelle mockupfelt.

---

# 13. Settings: LCD / Front Panel

LCD passer bedre under Settings enn i Catalog.

Legg inn en ny Settings-seksjon:

```text
Settings
  -> Hardware
     -> Front panel / LCD
```

eller en tydelig kortseksjon på eksisterende Settings-side.

## 13.1 Mockup-innhold

Vis:

### Connection

```text
Device: /dev/ttyUSB0
Detected: FTDI FT232R
Baud rate: 19200
Format: 8N1
Geometry: 16 x 2
Status: Connected
```

### Display preview

Vis en grafisk 16x2-preview:

```text
┌────────────────┐
│AX-LB-01        │
│HAProxy Ready   │
└────────────────┘
```

Inputs:

- Line 1
- Line 2
- brightness 0–255
- backlight on/off

Actions:

- Preview
- Write to display
- Clear display
- Test backlight
- Identify front panel

### Known commands

Vis read-only diagnostikk:

```text
Clear: FE 58
Cursor: FE 47 <column> <row>
Brightness: FE 99 <value>
```

Ikke eksponer dette som nødvendige brukerfelt.

### Keypad

Vis kjent mapping:

```text
Enter  E / 0x45
Down   F / 0x46
Up     G / 0x47
Left   I / 0x49
Right  J / 0x4A
```

Handling:

```text
Start key test
```

Mockupen kan vise en testdialog som ber om:

```text
Press LEFT
Hold LEFT
Press RIGHT
...
```

og en mock result-logg.

### Startup screen / EEPROM

Lag en egen seksjon, men marker den tydelig:

```text
Experimental / not implemented
```

Tekst:

```text
Startup screen and EEPROM access have not been positively identified.
Do not expose write controls until the controller protocol is verified.
```

Tillat bare mockhandling:

```text
Read capability
```

som gir:

```text
Not implemented
```

Ikke implementer EEPROM-write.

---

# 14. Designkrav

## 14.1 Identitet

Katalogelementene skal være lettere å gjenkjenne enn i dagens enkle kort.

Bruk:

- tydelig logo/ikon
- domeneaksent
- typebadge
- capability-chips
- konsekvent handling
- god informasjonsprioritering

Unngå:

- at alle kort ser helt like ut
- store, tilfeldige gradienter
- overdreven glow
- for mange farger i samme kort
- lange Docker-image-navn som viktigste metadata

## 14.2 Light og dark mode

Alt skal fungere i begge tema.

Ikke bruk hardkodet hvit tekst eller hardkodet mørk bakgrunn i katalogkomponentene.

Bruk eksisterende tema-tokens. Utvid tokens dersom nødvendig.

Kontroller:

- kontrast
- logoer
- disabled state
- hover
- focus
- badges
- drawer
- flow-noder

## 14.3 Tastatur og tilgjengelighet

- kort skal kunne fokuseres
- Enter/Space åpner drawer
- Escape lukker drawer
- drawer har korrekt focus trap
- buttons har labels
- status uttrykkes med tekst og ikon, ikke bare farge
- logoer er dekorative eller har korrekt alt-tekst
- tabs følger tilgjengelig tab-pattern

---

# 15. Foreslått komponentstruktur

Tilpass navn til eksisterende kodebase.

```text
features/catalog/
├── catalogData.ts
├── catalogTypes.ts
├── CatalogFilters.tsx
├── CatalogGrid.tsx
├── CatalogCard.tsx
├── CatalogStatusBadge.tsx
├── CatalogKindBadge.tsx
├── CapabilityChips.tsx
├── CatalogDetailDrawer.tsx
├── BlueprintFlowPreview.tsx
├── BlueprintSummary.tsx
├── ProviderConnectionPreview.tsx
└── __tests__/

features/settings/front-panel/
├── FrontPanelSettings.tsx
├── LcdPreview.tsx
├── LcdConnectionCard.tsx
├── LcdKeypadTestDialog.tsx
├── LcdCommandReference.tsx
└── __tests__/
```

Ikke opprett nye mapper ukritisk dersom eksisterende struktur allerede har bedre plassering.

---

# 16. Mockup-routing

Behold eksisterende `/catalog`.

Forslag:

```text
/catalog
/catalog?category=blueprints
/catalog?kind=provider
```

Detaljer kan håndteres med drawer og query-param:

```text
/catalog?item=cloudflare
```

Dette gjør detaljvisning linkbar uten å kreve en helt ny side.

Settings:

```text
/settings?section=front-panel
```

eller eksisterende Settings-routing dersom repoet allerede bruker nested routes.

---

# 17. Handlinger og eksisterende funksjonalitet

## 17.1 HAProxy

«Opprett instans» skal fortsatt bruke eksisterende reelle flyt.

## 17.2 FRR

«Opprett instans» skal fortsatt bruke eksisterende reelle flyt.

## 17.3 Alt annet

I mockupfasen:

- åpne detail drawer
- vis preview
- åpne mock wizard
- ikke opprett containere
- ikke muter backend
- ikke lagre secrets
- ikke late som deployment har skjedd

Bruk tydelig tekst:

```text
Design preview
```

eller:

```text
Ikke implementert ennå
```

---

# 18. i18n

Legg alle nye strenger inn i eksisterende i18n-system.

Minimum:

- norsk
- engelsk

Ikke bland norsk og engelsk i samme UI slik dagens tidlige mockup enkelte steder gjør.

Produktnavn og tekniske capabilities kan beholdes på engelsk når det er naturlig:

```text
Load Balancing
WebAuthn
DNSSEC
GeoIP
Runtime API
```

Handlinger og forklaringer skal oversettes.

---

# 19. Tester

Lag minst følgende frontendtester:

1. Catalog viser alle mockelementer.
2. Kategorifilter fungerer.
3. Typefilter fungerer.
4. Søk finner PowerDNS, Cloudflare og Guacamole.
5. Klikk på kort åpner riktig drawer.
6. Escape lukker drawer.
7. Primærhandling varierer etter item kind.
8. HAProxy og FRR bruker eksisterende create-flyt.
9. Andre elementer viser mockup-status.
10. Provider viser disconnected/connected status riktig.
11. LCD-preview begrenser hver linje til 16 tegn.
12. Brightness begrenses til 0–255.
13. Startup/EEPROM er markert som experimental og har ingen write-knapp.
14. Dark og light theme har ikke åpenbare kontrastregresjoner i snapshots dersom prosjektet bruker snapshot-testing.

---

# 20. Leveranse

Lever i en fokusert implementasjon:

## Del 1 – Catalog mockup

- ny katalogmodell
- rikere cards
- logo/icon-strategi
- filtre
- detail drawer
- blueprint flow preview
- Cloudflare provider mockup
- PowerDNS family/stack
- Guacamole blueprint
- Horizon integration
- existing HAProxy/FRR flow preserved

## Del 2 – LCD Settings mockup

- front panel settings section
- 16x2 preview
- brightness
- known command info
- keypad mapping
- mock key test
- experimental EEPROM section

## Del 3 – dokumentasjon

Oppdater README eller relevant docs-fil med:

- Catalog taxonomy
- forskjellen mellom service, stack, blueprint, integration og provider
- mockupbegrensninger
- at bare HAProxy/FRR faktisk kan deployes i denne fasen
- at LCD EEPROM-write ikke er implementert

---

# 21. Akseptansekriterier

Oppgaven er godkjent når:

1. Catalog ser tydelig rikere ut enn dagens kort.
2. Brukeren kan skanne og forstå forskjellen mellom service, blueprint og provider.
3. PowerDNS vises som foretrukket DNS-plattform uten eget BIND-kort.
4. Cloudflare vises som ekstern provider, ikke lokal container.
5. Guacamole vises som flerkomponent-blueprint.
6. Horizon vises som integrasjon mot eksisterende UAG/Horizon.
7. Detail drawer viser capabilities og enkel arkitektur.
8. Bare HAProxy og FRR utfører reell opprettelse.
9. LCD/frontpanel finnes under Settings.
10. LCD startup/EEPROM er tydelig merket eksperimentelt uten skrivefunksjon.
11. Eksisterende applikasjon og tester fortsetter å fungere.
12. UI fungerer både i dark og light mode.
13. Nye strenger er oversatt gjennom eksisterende i18n.
14. Ingen secrets lagres i mockdata eller frontend.
15. Implementasjonen er enkel nok til å videreutvikles uten å låse backendmodellen.

---

# 22. Første prompt til Cursor

Bruk følgende som første arbeidsordre:

```text
Les README.md, CURSOR_INSTRUCTIONS_AX_LB.md og eksisterende frontendkode.
Finn dagens Catalog- og Settings-implementasjon og lag en kort endringsplan.

Implementer deretter en frontend-only mockup som utvider Catalog med:
- kategorier og typefilter
- rikere kort med logo/icon, type, status og capabilities
- detail drawer
- enkel blueprint flow preview
- PowerDNS Authoritative, Recursor og PowerDNS Platform
- Cloudflare som provider
- Apache Guacamole som blueprint
- Omnissa Horizon UAG som integration
- Identity & MFA
- PKI/ACME
- Monitoring Stack

Bevar eksisterende opprettelsesflyt for HAProxy og FRR.
Alle andre handlinger skal være tydelig markert som mockup.

Legg også inn en Front Panel / LCD-mockup under Settings med:
- /dev/ttyUSB0
- 19200 8N1
- 16x2 preview
- backlight/brightness
- kjente knappkoder
- mock keypad test
- eksperimentell EEPROM-seksjon uten write-funksjon

Bruk eksisterende i18n, tema, API-klient og komponentmønstre.
Ikke implementer backend-deployment eller lagring av secrets i denne oppgaven.
Kjør tester og oppsummer alle endrede filer.
```
