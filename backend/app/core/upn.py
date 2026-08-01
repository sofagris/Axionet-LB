"""UPN parsing helpers for auth source routing."""

from __future__ import annotations

from dataclasses import dataclass

from app.models.auth_source import LOCAL_UPN_SUFFIX


@dataclass(frozen=True)
class ParsedUpn:
    local_part: str
    suffix: str | None
    raw: str

    @property
    def is_local_route(self) -> bool:
        return self.suffix is None or self.suffix == LOCAL_UPN_SUFFIX


def parse_upn(value: str) -> ParsedUpn:
    raw = (value or "").strip()
    if not raw:
        return ParsedUpn(local_part="", suffix=None, raw=raw)
    if "@" not in raw:
        return ParsedUpn(local_part=raw, suffix=None, raw=raw)
    local_part, suffix = raw.rsplit("@", 1)
    return ParsedUpn(
        local_part=local_part.strip(),
        suffix=suffix.strip().lower() or None,
        raw=raw,
    )


def local_lookup_username(parsed: ParsedUpn) -> str:
    """Username used for local DB lookup (strip @internal)."""
    return parsed.local_part
