from __future__ import annotations

import json
import logging
import threading
import uuid
from dataclasses import asdict, dataclass, field
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any, Callable

logger = logging.getLogger(__name__)

ROLLBACK_SECONDS = 60


@dataclass
class PendingSnapshot:
    mtu: int | None
    administrative_state: str
    speed_mbps: int | None


@dataclass
class PendingChange:
    id: str
    interface_id: str
    interface_name: str
    previous: PendingSnapshot
    rollback_at: datetime
    confirmed: bool = False
    rolled_back: bool = False


RollbackHandler = Callable[[PendingChange], None]


class PendingChangeStore:
    """Persist pending NIC changes and roll them back unless confirmed in time."""

    def __init__(self, path: Path, *, on_rollback: RollbackHandler | None = None) -> None:
        self._path = path
        self._on_rollback = on_rollback
        self._lock = threading.Lock()
        self._changes: dict[str, PendingChange] = {}
        self._stop = threading.Event()
        self._thread: threading.Thread | None = None
        self._load()

    def start(self) -> None:
        if self._thread and self._thread.is_alive():
            return
        self._stop.clear()
        self._thread = threading.Thread(target=self._loop, name="if-change-rollback", daemon=True)
        self._thread.start()

    def stop(self) -> None:
        self._stop.set()
        if self._thread:
            self._thread.join(timeout=2)

    def create(
        self,
        *,
        interface_id: str,
        interface_name: str,
        previous: PendingSnapshot,
        seconds: int = ROLLBACK_SECONDS,
    ) -> PendingChange:
        change = PendingChange(
            id=str(uuid.uuid4()),
            interface_id=interface_id,
            interface_name=interface_name,
            previous=previous,
            rollback_at=datetime.now(UTC) + timedelta(seconds=seconds),
        )
        with self._lock:
            self._changes[change.id] = change
            self._save()
        return change

    def get(self, change_id: str) -> PendingChange | None:
        with self._lock:
            return self._changes.get(change_id)

    def confirm(self, change_id: str) -> PendingChange | None:
        with self._lock:
            change = self._changes.get(change_id)
            if change is None or change.rolled_back:
                return None
            change.confirmed = True
            self._save()
            return change

    def _loop(self) -> None:
        while not self._stop.wait(2):
            self._expire()

    def _expire(self) -> None:
        now = datetime.now(UTC)
        due: list[PendingChange] = []
        with self._lock:
            for change in list(self._changes.values()):
                if change.confirmed or change.rolled_back:
                    continue
                if change.rollback_at <= now:
                    due.append(change)
        for change in due:
            self._rollback(change)

    def _rollback(self, change: PendingChange) -> None:
        with self._lock:
            current = self._changes.get(change.id)
            if current is None or current.confirmed or current.rolled_back:
                return
            current.rolled_back = True
            self._save()
        if self._on_rollback is None:
            return
        try:
            self._on_rollback(change)
        except Exception:
            logger.exception("Failed to roll back interface change %s", change.id)

    def _load(self) -> None:
        if not self._path.exists():
            return
        try:
            raw = json.loads(self._path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            logger.exception("Could not load pending interface changes from %s", self._path)
            return
        for item in raw.get("changes", []):
            try:
                previous = PendingSnapshot(**item["previous"])
                change = PendingChange(
                    id=item["id"],
                    interface_id=item["interface_id"],
                    interface_name=item["interface_name"],
                    previous=previous,
                    rollback_at=datetime.fromisoformat(item["rollback_at"]),
                    confirmed=bool(item.get("confirmed", False)),
                    rolled_back=bool(item.get("rolled_back", False)),
                )
                self._changes[change.id] = change
            except (KeyError, TypeError, ValueError):
                logger.exception("Skipping invalid pending change entry")

    def _save(self) -> None:
        self._path.parent.mkdir(parents=True, exist_ok=True)
        payload: dict[str, Any] = {
            "changes": [
                {
                    "id": c.id,
                    "interface_id": c.interface_id,
                    "interface_name": c.interface_name,
                    "previous": asdict(c.previous),
                    "rollback_at": c.rollback_at.isoformat(),
                    "confirmed": c.confirmed,
                    "rolled_back": c.rolled_back,
                }
                for c in self._changes.values()
                if not c.confirmed and not c.rolled_back
            ]
        }
        self._path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
