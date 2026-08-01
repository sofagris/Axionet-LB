from app.core.upn import local_lookup_username, parse_upn


def test_parse_bare_username() -> None:
    parsed = parse_upn("Admin")
    assert parsed.local_part == "Admin"
    assert parsed.suffix is None
    assert parsed.is_local_route
    assert local_lookup_username(parsed) == "Admin"


def test_parse_internal_upn() -> None:
    parsed = parse_upn("Admin@internal")
    assert parsed.local_part == "Admin"
    assert parsed.suffix == "internal"
    assert parsed.is_local_route


def test_parse_external_upn() -> None:
    parsed = parse_upn("roy@Contoso.COM")
    assert parsed.local_part == "roy"
    assert parsed.suffix == "contoso.com"
    assert not parsed.is_local_route
