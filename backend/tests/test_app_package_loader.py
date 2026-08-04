from app.app_packages.loader import (
    derive_flow_from_designer,
    get_loaded_package,
    list_loaded_packages,
    resolve_package_paths,
)
from app.app_packages.contract import repo_root_from_backend


def test_resolve_package_paths_from_repo() -> None:
    paths = resolve_package_paths(repo_root=repo_root_from_backend())
    assert paths.root.is_dir()
    assert (paths.root / "_example" / "axionet-app.json").is_file()
    assert (paths.schemas_dir / "axionet-app-v1.schema.json").is_file()


def test_list_loaded_skips_reference_by_default() -> None:
    packages = list_loaded_packages(repo_root=repo_root_from_backend())
    assert all(not package.reference for package in packages)
    assert all(not package.directory_name.startswith("_") for package in packages)
    by_id = {package.id: package for package in packages}
    assert "varnish" in by_id
    assert by_id["varnish"].service_type == "varnish"
    assert by_id["varnish"].designer["components"][0]["role"] == "varnish-listen"


def test_list_loaded_include_reference_example() -> None:
    packages = list_loaded_packages(include_reference=True, repo_root=repo_root_from_backend())
    by_id = {package.id: package for package in packages}
    assert "example" in by_id
    example = by_id["example"]
    assert example.reference is True
    assert example.service_type == "example"
    assert example.designer["catalogId"] == "example"
    nodes, edges = derive_flow_from_designer(example.designer)
    assert {node["id"] for node in nodes} == {"listener", "upstream"}
    assert edges[0]["from"] == "listener"


def test_get_loaded_package_example() -> None:
    package = get_loaded_package("example", repo_root=repo_root_from_backend())
    assert package is not None
    assert package.catalog["name"] == "Example App"
