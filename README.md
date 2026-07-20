# AxioNet Load Balancer

Modulær Linux-basert ADC-/lastbalanseringsplattform for gjenbrukte Citrix NetScaler SDX-appliances.

Blank installasjon kjører kun kontrollplanet:

- `ax-api` — FastAPI
- `ax-gui` — React GUI

Dataplan-containere (HAProxy, Varnish, …) opprettes senere via API/GUI.

## Krav

- Docker Engine 24+
- Docker Compose plugin (`docker compose`)

## Oppstart

```bash
cp .env.example .env
docker compose up --build -d
```

GUI: http://\<vert\>/  
API health: http://\<vert\>/api/v1/system/health

### Management interface (kontrollplan-binding)

GUI publiseres på `MGMT_BIND_IP` (default `0.0.0.0` ved første boot). Etter at et fysisk interface er merket som management:

```bash
# via API
curl -X POST http://127.0.0.1/api/v1/interfaces/<id>/promote-management

# last inn bind-IP og recreate GUI
set -a && . /var/lib/ax-lb/mgmt-bind.env && set +a
docker compose up -d gui
```

Deretter svarer kontrollplanet kun på management-IP (f.eks. `http://192.168.50.195/`).

## Utvikling lokalt

### Backend

```bash
cd backend
python -m venv .venv
# Windows: .venv\Scripts\activate
source .venv/bin/activate
pip install -e ".[dev]"
export DATABASE_URL=sqlite:///./ax-lb.dev.db
export AX_LB_DATA_DIR=.
uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Vite proxier `/api` til `http://127.0.0.1:8000`.

## Milestone 3 – networks

GUI: http://\<vert\>/networks

```bash
curl -s http://127.0.0.1/api/v1/networks | jq
curl -s -X POST http://127.0.0.1/api/v1/networks/validate -H 'content-type: application/json' -d '{...}' | jq
```

API-containeren bruker `pid: host` + `NET_ADMIN`/`SYS_ADMIN` for VLAN via `nsenter` inn i vertens netns.

## Tester

```bash
cd backend && pytest
cd frontend && npm test
```

## Repo

https://github.com/Sofagris/axionet-lb
