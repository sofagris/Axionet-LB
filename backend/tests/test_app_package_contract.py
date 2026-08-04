from pathlib import Path

from app.app_packages.contract import PackagePaths, repo_root_from_backend, validate_all_app_packages


def test_example_app_package_matches_v1_contract() -> None:
    repo_root = repo_root_from_backend()
    paths = PackagePaths.from_repo(repo_root)
    example = paths.root / "_example"
    assert example.is_dir(), f"missing reference package at {example}"

    results = validate_all_app_packages(repo_root)
    assert "_example" in results
    assert results["_example"] == [], results["_example"]


def test_schemas_exist() -> None:
    schemas = PackagePaths.from_repo(repo_root_from_backend()).schemas_dir
    for name in (
        "axionet-app-v1.schema.json",
        "axionet-app-catalog-v1.schema.json",
        "axionet-app-designer-v1.schema.json",
    ):
        assert (schemas / name).is_file()


def test_repo_root_resolution() -> None:
    root = repo_root_from_backend()
    assert (root / "packages" / "apps" / "_example" / "axionet-app.json").is_file()
    assert (root / "backend" / "app").is_dir()
    assert isinstance(root, Path)
