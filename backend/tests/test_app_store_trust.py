"""Tests for App Store trust, multi-source merge, and generic runtime plugin."""

from __future__ import annotations

import base64
from pathlib import Path

from nacl.signing import SigningKey

from app.app_packages import sources as sources_mod
from app.app_packages import trust as trust_mod
from app.app_packages.store import merge_store_indexes
from app.plugins.generic.plugin import GenericPackagePlugin, substitute_placeholders
from app.plugins.registry import get_plugin
from app.plugins.varnish.plugin import VarnishPlugin


def test_ed25519_verify_roundtrip(tmp_path: Path) -> None:
    signing_key = SigningKey.generate()
    verify_key = signing_key.verify_key
    pub_b64 = base64.b64encode(bytes(verify_key)).decode("ascii")
    message = b"package-bytes"
    signed = signing_key.sign(message)
    assert trust_mod.verify_ed25519(
        message=message,
        signature=signed.signature,
        public_key_b64=pub_b64,
    )
    assert not trust_mod.verify_ed25519(
        message=b"tampered",
        signature=signed.signature,
        public_key_b64=pub_b64,
    )


def test_enforce_archive_trust_allow_unsigned(tmp_path: Path) -> None:
    trust_mod.save_trust(
        {"allowUnsignedPackages": True, "keys": []},
        data_dir=str(tmp_path),
    )
    meta = trust_mod.enforce_archive_trust(
        archive_bytes=b"zip",
        signature_bytes=None,
        data_dir=str(tmp_path),
    )
    assert meta["signed"] is False


def test_enforce_archive_trust_rejects_unsigned(tmp_path: Path) -> None:
    trust_mod.save_trust(
        {"allowUnsignedPackages": False, "keys": []},
        data_dir=str(tmp_path),
    )
    try:
        trust_mod.enforce_archive_trust(
            archive_bytes=b"zip",
            signature_bytes=None,
            data_dir=str(tmp_path),
        )
        raise AssertionError("expected ValueError")
    except ValueError as exc:
        assert "Unsigned" in str(exc)


def test_enforce_archive_trust_accepts_valid_signature(tmp_path: Path) -> None:
    signing_key = SigningKey.generate()
    pub_b64 = base64.b64encode(bytes(signing_key.verify_key)).decode("ascii")
    trust_mod.save_trust(
        {
            "allowUnsignedPackages": False,
            "keys": [{"id": "dev", "name": "Dev", "publicKey": pub_b64}],
        },
        data_dir=str(tmp_path),
    )
    message = b"archive-payload"
    sig = signing_key.sign(message).signature
    meta = trust_mod.enforce_archive_trust(
        archive_bytes=message,
        signature_bytes=sig,
        data_dir=str(tmp_path),
    )
    assert meta["signed"] is True
    assert meta["keyId"] == "dev"


def test_sources_priority_order(tmp_path: Path) -> None:
    sources_mod.save_sources(
        [
            {
                "id": "low",
                "name": "Low",
                "indexUrl": "https://example.com/low.json",
                "enabled": True,
                "priority": 1,
            },
            {
                "id": "high",
                "name": "High",
                "indexUrl": "https://example.com/high.json",
                "enabled": True,
                "priority": 50,
            },
        ],
        data_dir=str(tmp_path),
    )
    ordered = sources_mod.enabled_sources_sorted(data_dir=str(tmp_path))
    assert [item["id"] for item in ordered] == ["high", "low"]


def test_merge_uses_bundled_when_no_sources(tmp_path: Path, monkeypatch) -> None:
    sources_mod.save_sources([], data_dir=str(tmp_path))
    monkeypatch.delenv("AXIONET_STORE_INDEX_URL", raising=False)
    merged = merge_store_indexes(data_dir=str(tmp_path), store_index_url="")
    assert merged["apiVersion"] == "axionet.store/v1"
    assert any(pkg["id"] == "varnish" for pkg in merged["packages"])


def test_substitute_placeholders() -> None:
    cfg = {"bind": "*:6081", "origin": {"address": "10.0.0.1", "port": 80}}
    assert substitute_placeholders("a={bind}", cfg) == "a=*:6081"
    assert substitute_placeholders("{origin.address}:{origin.port}", cfg) == "10.0.0.1:80"


def test_varnish_named_plugin_wins_over_generic() -> None:
    plugin = get_plugin("varnish")
    assert isinstance(plugin, VarnishPlugin)
    assert not isinstance(plugin, GenericPackagePlugin)
