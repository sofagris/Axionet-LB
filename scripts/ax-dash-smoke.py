import json
import urllib.request

base = "http://127.0.0.1"


def req(method, path, body=None, token=None):
    data = None if body is None else json.dumps(body).encode()
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = "Bearer " + token
    request = urllib.request.Request(base + path, data=data, headers=headers, method=method)
    with urllib.request.urlopen(request) as resp:
        raw = resp.read()
        if not raw:
            return resp.status, None
        return resp.status, json.loads(raw.decode())


status, login = req("POST", "/api/v1/auth/login", {"username": "Admin", "password": "Password"})
token = login["access_token"]
print("login", status)
status, created = req(
    "POST",
    "/api/v1/dashboards",
    {"name": "smoke-ops", "description": "lab"},
    token,
)
print("create", status, created["id"], created["name"], len(created["widgets"]))
did = created["id"]
status, pub = req(
    "POST",
    f"/api/v1/dashboards/{did}/widgets",
    {"type": "traffic_flow", "config": {}},
    token,
)
print("publish", status, [w["type"] for w in pub["widgets"]])
delete_req = urllib.request.Request(
    base + f"/api/v1/dashboards/{did}",
    headers={"Authorization": "Bearer " + token},
    method="DELETE",
)
with urllib.request.urlopen(delete_req) as resp:
    print("delete", resp.status)
print("ok")
