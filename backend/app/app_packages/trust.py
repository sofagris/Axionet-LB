"""App Store trust policy: Allow unsigned + Ed25519 public keys."""

from __future__ import annotations

import base64
import json
import re
import uuid
from pathlib import Path
from typing import Any

from nacl.exceptions import BadSignatureError
from nacl.signing import VerifyKey

from app.core.config import get_settings

_KEY_ID_RE = re.compile(r"^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$")


def app_store_dir(*, data_dir: str | None = None) -> Path:
    root = Path(data_dir or get_settings().data_dir)
    path = root / "app-store"
    path.mkdir(parents=True, exist_ok=True)
    return path


def trust_path(*, data_dir: str | None = None) -> Path:
    return app_store_dir(data_dir=data_dir) / "trust.json"


def default_trust() -> dict[str, Any]:
    return {"allowUnsignedPackages": True, "keys": []}


def load_trust(*, data_dir: str | None = None) -> dict[str, Any]:
    path = trust_path(data_dir=data_dir)
    if not path.is_file():
        payload = default_trust()
        save_trust(payload, data_dir=data_dir)
        return payload
    with path.open(encoding="utf-8") as handle:
        data = json.load(handle)
    if not isinstance(data, dict):
        raise ValueError("trust.json must be an object")
    keys = data.get("keys") or []
    if not isinstance(keys, list):
        raise ValueError("trust.keys must be a list")
    return {
        "allowUnsignedPackages": bool(data.get("allowUnsignedPackages", True)),
        "keys": [item for item in keys if isinstance(item, dict)],
    }


def save_trust(payload: dict[str, Any], *, data_dir: str | None = None) -> dict[str, Any]:
    normalized = {
        "allowUnsignedPackages": bool(payload.get("allowUnsignedPackages", True)),
        "keys": list(payload.get("keys") or []),
    }
    path = trust_path(data_dir=data_dir)
    path.write_text(json.dumps(normalized, indent=2) + "\n", encoding="utf-8")
    return normalized


def _decode_public_key(public_key: str) -> bytes:
    cleaned = public_key.strip().replace("\n", "").replace(" ", "")
    try:
        raw = base64.b64decode(cleaned, validate=True)
    except Exception as exc:  # noqa: BLE001
        raise ValueError("publicKey must be base64-encoded Ed25519 key") from exc
    if len(raw) != 32:
        raise ValueError("Ed25519 publicKey must decode to 32 bytes")
    return raw


def validate_public_key(public_key: str) -> bytes:
    return _decode_public_key(public_key)


def decode_signature(signature_bytes: bytes) -> bytes:
    """Accept raw 64-byte signature or base64/base64url text."""
    if len(signature_bytes) == 64:
        return signature_bytes
    text = signature_bytes.decode("utf-8", errors="ignore").strip()
    if not text:
        raise ValueError("Empty signature")
    padded = text + "=" * (-len(text) % 4)
    try:
        raw = base64.urlsafe_b64decode(padded)
    except Exception:
        raw = base64.b64decode(padded)
    if len(raw) != 64:
        raise ValueError("Ed25519 signature must be 64 bytes")
    return raw


def verify_ed25519(*, message: bytes, signature: bytes, public_key_b64: str) -> bool:
    key = VerifyKey(_decode_public_key(public_key_b64))
    try:
        key.verify(message, decode_signature(signature))
        return True
    except BadSignatureError:
        return False


def enforce_archive_trust(
    *,
    archive_bytes: bytes,
    signature_bytes: bytes | None,
    data_dir: str | None = None,
) -> dict[str, Any]:
    """
    Apply trust policy for HTTPS archives.
    Returns metadata: { signed: bool, keyId?: str }.
    Raises ValueError when install must be rejected.
    """
    trust = load_trust(data_dir=data_dir)
    allow_unsigned = bool(trust.get("allowUnsignedPackages", True))
    keys = list(trust.get("keys") or [])

    if signature_bytes is None:
        if allow_unsigned:
            return {"signed": False, "keyId": None}
        raise ValueError("Unsigned packages are not allowed (no signature and allowUnsignedPackages=false)")

    if not keys:
        if allow_unsigned:
            # Signature present but no keys configured — treat as unsigned path only if allowed
            # and we cannot verify: safer to reject when signature present but no keys.
            raise ValueError("Package is signed but no trusted public keys are configured")
        raise ValueError("Package is signed but no trusted public keys are configured")

    for key in keys:
        pub = str(key.get("publicKey") or "")
        if not pub:
            continue
        if verify_ed25519(message=archive_bytes, signature=signature_bytes, public_key_b64=pub):
            return {"signed": True, "keyId": str(key.get("id") or "")}

    raise ValueError("Archive signature did not match any trusted Ed25519 public key")


def add_trust_key(
    *,
    name: str,
    public_key: str,
    key_id: str | None = None,
    data_dir: str | None = None,
) -> dict[str, Any]:
    _decode_public_key(public_key)  # validate
    trust = load_trust(data_dir=data_dir)
    new_id = (key_id or f"key-{uuid.uuid4().hex[:8]}").strip()
    if not _KEY_ID_RE.match(new_id):
        raise ValueError("Invalid key id")
    if any(str(item.get("id")) == new_id for item in trust["keys"]):
        raise ValueError(f"Key id already exists: {new_id}")
    entry = {"id": new_id, "name": name.strip() or new_id, "publicKey": public_key.strip()}
    trust["keys"].append(entry)
    save_trust(trust, data_dir=data_dir)
    return entry


def delete_trust_key(key_id: str, *, data_dir: str | None = None) -> None:
    trust = load_trust(data_dir=data_dir)
    before = len(trust["keys"])
    trust["keys"] = [item for item in trust["keys"] if str(item.get("id")) != key_id]
    if len(trust["keys"]) == before:
        raise KeyError(f"Trust key not found: {key_id}")
    save_trust(trust, data_dir=data_dir)
