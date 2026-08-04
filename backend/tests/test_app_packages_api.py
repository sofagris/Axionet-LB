def test_app_packages_list_empty_without_reference(client) -> None:
    response = client.get("/api/v1/app-packages")
    assert response.status_code == 200, response.text
    body = response.json()
    assert isinstance(body, list)
    assert all(not item.get("reference") for item in body)
    assert all(item["id"] != "example" for item in body)


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
