"""Operator-configured App Store index sources."""

from __future__ import annotations

import json
import re
import uuid
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

from app.app_packages.trust import app_store_dir
from app.core.config import get_settings

_ID_RE = re.compile(r"^[a-z][a-z0-9-]{0,63}$")


def sources_path(*, data_dir: str | None = None) -> Path:
    return app_store_dir(data_dir=data_dir) / "sources.json"


def _safe_https_url(url: str) -> str:
    parsed = urlparse(url)
    if parsed.scheme != "https" or not parsed.netloc:
        raise ValueError("indexUrl must be an https URL")
    return url.strip()


def default_sources_from_env() -> list[dict[str, Any]]:
    settings = get_settings()
    url = (settings.axionet_store_index_url or "").strip()
    if not url:
        return []
    try:
        url = _safe_https_url(url)
    except ValueError:
        return []
    return [
        {
            "id": "official",
            "name": "Axionet official",
            "indexUrl": url,
            "enabled": True,
            "priority": 100,
        }
    ]


def load_sources(*, data_dir: str | None = None) -> list[dict[str, Any]]:
    path = sources_path(data_dir=data_dir)
    if not path.is_file():
        seeded = default_sources_from_env()
        save_sources(seeded, data_dir=data_dir)
        return seeded
    with path.open(encoding="utf-8") as handle:
        data = json.load(handle)
    if isinstance(data, dict):
        items = data.get("sources") or []
    elif isinstance(data, list):
        items = data
    else:
        raise ValueError("sources.json must be a list or {sources: []}")
    return [item for item in items if isinstance(item, dict)]


def save_sources(sources: list[dict[str, Any]], *, data_dir: str | None = None) -> list[dict[str, Any]]:
    normalized: list[dict[str, Any]] = []
    seen: set[str] = set()
    for item in sources:
        source_id = str(item.get("id") or "").strip()
        if not _ID_RE.match(source_id):
            raise ValueError(f"Invalid store source id: {source_id}")
        if source_id in seen:
            raise ValueError(f"Duplicate store source id: {source_id}")
        seen.add(source_id)
        index_url = _safe_https_url(str(item.get("indexUrl") or ""))
        priority = int(item.get("priority") if item.get("priority") is not None else 0)
        normalized.append(
            {
                "id": source_id,
                "name": str(item.get("name") or source_id).strip() or source_id,
                "indexUrl": index_url,
                "enabled": bool(item.get("enabled", True)),
                "priority": priority,
            }
        )
    path = sources_path(data_dir=data_dir)
    path.write_text(json.dumps({"sources": normalized}, indent=2) + "\n", encoding="utf-8")
    return normalized


def replace_sources(sources: list[dict[str, Any]], *, data_dir: str | None = None) -> list[dict[str, Any]]:
    return save_sources(sources, data_dir=data_dir)


def add_source(
    *,
    name: str,
    index_url: str,
    source_id: str | None = None,
    enabled: bool = True,
    priority: int = 0,
    data_dir: str | None = None,
) -> dict[str, Any]:
    sources = load_sources(data_dir=data_dir)
    new_id = (source_id or f"store-{uuid.uuid4().hex[:8]}").strip()
    entry = {
        "id": new_id,
        "name": name,
        "indexUrl": index_url,
        "enabled": enabled,
        "priority": priority,
    }
    sources.append(entry)
    save_sources(sources, data_dir=data_dir)
    return next(item for item in load_sources(data_dir=data_dir) if item["id"] == new_id)


def delete_source(source_id: str, *, data_dir: str | None = None) -> None:
    sources = load_sources(data_dir=data_dir)
    next_sources = [item for item in sources if str(item.get("id")) != source_id]
    if len(next_sources) == len(sources):
        raise KeyError(f"Store source not found: {source_id}")
    save_sources(next_sources, data_dir=data_dir)


def enabled_sources_sorted(*, data_dir: str | None = None) -> list[dict[str, Any]]:
    sources = [item for item in load_sources(data_dir=data_dir) if item.get("enabled")]
    # Higher priority first; stable for equal priority (original list order).
    indexed = list(enumerate(sources))
    indexed.sort(key=lambda pair: (-int(pair[1].get("priority") or 0), pair[0]))
    return [item for _, item in indexed]
