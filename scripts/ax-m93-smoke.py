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


_, login = req("POST", "/api/v1/auth/login", {"username": "Admin", "password": "Password"})
token = login["access_token"]
status, vips = req("GET", "/api/v1/vips", token=token)
print("list", status, "count", len(vips))
for vip in vips:
    print(
        "vip",
        vip["name"],
        "links",
        len(vip.get("links") or []),
        [link["frr_instance_id"][:8] for link in (vip.get("links") or [])],
    )
print("ok")
