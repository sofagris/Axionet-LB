from app.plugins.haproxy.editor import HaproxyConfigEditor
from app.plugins.haproxy.schemas import HaproxyBackend, HaproxyFrontend, HaproxyServer


def test_editor_frontend_backend_server_crud() -> None:
    editor = HaproxyConfigEditor({})
    editor.upsert_frontend(
        HaproxyFrontend(name="web", bind_port=8080, default_backend="app"),
        create=True,
    )
    editor.upsert_backend(
        HaproxyBackend(name="app", balance="leastconn", servers=[]),
        create=False,
    )
    editor.upsert_server(
        "app",
        HaproxyServer(name="web1", address="10.0.0.10", port=80, check=True, weight=50),
        create=True,
    )
    assert editor.get_frontend("web") is not None
    assert editor.get_backend("app") is not None
    assert editor.get_server("app", "web1") is not None
    assert editor.get_server("app", "web1").weight == 50

    editor.delete_server("app", "web1")
    assert editor.get_server("app", "web1") is None
    editor.delete_frontend("web")
    assert editor.get_frontend("web") is None
