def test_app_packages_list_includes_varnish(client) -> None:
    response = client.get("/api/v1/app-packages")
    assert response.status_code == 200, response.text
    body = response.json()
    assert isinstance(body, list)
    assert all(not item.get("reference") for item in body)
    assert all(item["id"] != "example" for item in body)
    by_id = {item["id"]: item for item in body}
    assert "varnish" in by_id
    assert by_id["varnish"]["serviceType"] == "varnish"
    assert by_id["varnish"]["hydrate"] == "none"


def test_app_packages_catalog_cards(client) -> None:
    response = client.get("/api/v1/app-packages/catalog")
    assert response.status_code == 200, response.text
    body = response.json()
    by_id = {item["id"]: item for item in body}
    assert "varnish" in by_id
    varnish = by_id["varnish"]
    assert varnish["name"] == "Varnish"
    assert varnish["flowNodes"][0]["id"] == "listen"
    assert varnish["flowEdges"][0]["from"] == "listen"
    assert "example" not in by_id


def test_app_store_index(client) -> None:
    response = client.get("/api/v1/app-packages/store")
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["apiVersion"] == "axionet.store/v1"
    by_id = {item["id"]: item for item in body["packages"]}
    assert by_id["varnish"]["installed"] is True


def test_app_store_install_already_present(client) -> None:
    response = client.post("/api/v1/app-packages/install", json={"packageId": "varnish"})
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["id"] == "varnish"
    assert body["status"] == "already_installed"


def test_app_packages_designer_manifests_with_reference(client) -> None:
    response = client.get("/api/v1/app-packages/designer-manifests?includeReference=true")
    assert response.status_code == 200, response.text
    body = response.json()
    by_id = {item["catalogId"]: item for item in body}
    assert "example" in by_id
    assert by_id["example"]["serviceType"] == "example"
    assert by_id["example"]["components"][0]["id"] == "listener"


def test_app_package_get_example(client) -> None:
    response = client.get("/api/v1/app-packages/example")
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["id"] == "example"
    assert body["serviceType"] == "example"
    assert body["catalog"]["name"] == "Example App"
    assert body["flowNodes"][0]["id"] == "listener"
    assert body["flowEdges"][0]["from"] == "listener"
    assert "instanceSchema" in body
    assert body["desiredStateExample"]["name"] == "example-demo"


def test_app_package_not_found(client) -> None:
    response = client.get("/api/v1/app-packages/does-not-exist")
    assert response.status_code == 404
