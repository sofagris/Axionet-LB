#!/usr/bin/env bash
# Wire AxioNet Identity to the compose Keycloak lab realm (idempotent).
set -euo pipefail

API_BASE="${API_BASE:-http://127.0.0.1}"
ADMIN_USER="${AX_AUTH_DEFAULT_ADMIN_USERNAME:-Admin}"
ADMIN_PASS="${AX_AUTH_DEFAULT_ADMIN_PASSWORD:-Password}"
KC_HOST="${KEYCLOAK_HOSTNAME:-192.168.50.195}"
KC_PORT="${KEYCLOAK_HOSTNAME_PORT:-8080}"
ISSUER="http://${KC_HOST}:${KC_PORT}/realms/axionet"
CLIENT_ID="${KEYCLOAK_GUI_CLIENT_ID:-axionet-gui}"
CLIENT_SECRET="${KEYCLOAK_GUI_CLIENT_SECRET:-axionet-gui-lab-secret}"
SOURCE_NAME="${KEYCLOAK_SOURCE_NAME:-Lab Keycloak}"
UPN_SUFFIX="${KEYCLOAK_UPN_SUFFIX:-lab.local}"

echo "Waiting for Keycloak issuer discovery: ${ISSUER}"
for i in $(seq 1 60); do
  if curl -fsS "${ISSUER}/.well-known/openid-configuration" >/dev/null 2>&1; then
    echo "Keycloak ready"
    break
  fi
  if [ "$i" -eq 60 ]; then
    echo "Keycloak discovery failed" >&2
    exit 1
  fi
  sleep 3
done

TOKEN=$(curl -fsS -X POST "${API_BASE}/api/v1/auth/login" \
  -H 'content-type: application/json' \
  -d "{\"username\":\"${ADMIN_USER}\",\"password\":\"${ADMIN_PASS}\"}" \
  | python3 -c 'import sys,json; print(json.load(sys.stdin)["access_token"])')
AUTH="Authorization: Bearer ${TOKEN}"

SOURCES=$(curl -fsS "${API_BASE}/api/v1/auth-sources" -H "$AUTH")
SOURCE_ID=$(SOURCE_NAME="$SOURCE_NAME" python3 -c '
import json, os, sys
name = os.environ["SOURCE_NAME"]
rows = json.load(sys.stdin)
print(next((r["id"] for r in rows if r["name"] == name), ""), end="")
' <<<"$SOURCES")

if [ -z "$SOURCE_ID" ]; then
  echo "Creating OIDC auth source: ${SOURCE_NAME}"
  PAYLOAD=$(ISSUER="$ISSUER" CLIENT_ID="$CLIENT_ID" CLIENT_SECRET="$CLIENT_SECRET" SOURCE_NAME="$SOURCE_NAME" python3 -c '
import json, os
print(json.dumps({
  "name": os.environ["SOURCE_NAME"],
  "kind": "oidc",
  "enabled": True,
  "description": "Compose profile keycloak (lab)",
  "issuer_url": os.environ["ISSUER"],
  "client_id": os.environ["CLIENT_ID"],
  "client_secret": os.environ["CLIENT_SECRET"],
  "scopes": "openid profile email",
  "claim_username": "preferred_username",
  "claim_groups": "groups",
}))
')
  SOURCE_ID=$(curl -fsS -X POST "${API_BASE}/api/v1/auth-sources" \
    -H "$AUTH" -H 'content-type: application/json' \
    -d "$PAYLOAD" | python3 -c 'import sys,json; print(json.load(sys.stdin)["id"])')
else
  echo "Auth source already exists: ${SOURCE_ID}"
fi

SUFFIXES=$(curl -fsS "${API_BASE}/api/v1/auth-sources/upn-suffixes" -H "$AUTH")
HAS_SUFFIX=$(UPN_SUFFIX="$UPN_SUFFIX" python3 -c '
import json, os, sys
suffix = os.environ["UPN_SUFFIX"].lower()
rows = json.load(sys.stdin)
print("yes" if any(r["suffix"].lower() == suffix for r in rows) else "no")
' <<<"$SUFFIXES")

if [ "$HAS_SUFFIX" = "no" ]; then
  echo "Binding UPN suffix ${UPN_SUFFIX} → ${SOURCE_ID}"
  curl -fsS -X POST "${API_BASE}/api/v1/auth-sources/upn-suffixes" \
    -H "$AUTH" -H 'content-type: application/json' \
    -d "{\"suffix\":\"${UPN_SUFFIX}\",\"auth_source_id\":\"${SOURCE_ID}\"}" >/dev/null
else
  echo "UPN suffix already bound: ${UPN_SUFFIX}"
fi

APP_IDPS=$(curl -fsS "${API_BASE}/api/v1/auth-sources/app-identity-providers" -H "$AUTH")
HAS_APP=$(python3 -c '
import json, sys
rows = json.load(sys.stdin)
print("yes" if any(r["name"] == "Lab Keycloak App" for r in rows) else "no")
' <<<"$APP_IDPS")
if [ "$HAS_APP" = "no" ]; then
  echo "Creating App IdP metadata: Lab Keycloak App"
  PAYLOAD=$(ISSUER="$ISSUER" python3 -c '
import json, os
print(json.dumps({
  "name": "Lab Keycloak App",
  "kind": "oidc",
  "enabled": True,
  "customer_id": "kunde-a",
  "config": {"issuer_url": os.environ["ISSUER"], "client_id": "axionet-app"},
}))
')
  curl -fsS -X POST "${API_BASE}/api/v1/auth-sources/app-identity-providers" \
    -H "$AUTH" -H 'content-type: application/json' \
    -d "$PAYLOAD" >/dev/null
else
  echo "App IdP already exists"
fi

echo
echo "Seed OK."
echo "  Issuer:  ${ISSUER}"
echo "  Login:   labuser@${UPN_SUFFIX}  (password LabPass1!)"
echo "  Break-glass: ${ADMIN_USER}@internal"
