from __future__ import annotations

import logging
from pathlib import Path

logger = logging.getLogger(__name__)

BIND_ENV_NAME = "mgmt-bind.env"


def mgmt_bind_env_path(data_dir: str | Path) -> Path:
    return Path(data_dir) / BIND_ENV_NAME


def write_mgmt_bind_env(data_dir: str | Path, bind_ip: str) -> Path:
    path = mgmt_bind_env_path(data_dir)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(f"MGMT_BIND_IP={bind_ip}\n", encoding="utf-8")
    logger.info("Wrote management bind IP %s to %s", bind_ip, path)
    return path


def read_mgmt_bind_ip(data_dir: str | Path) -> str | None:
    path = mgmt_bind_env_path(data_dir)
    if not path.exists():
        return None
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line.startswith("MGMT_BIND_IP="):
            value = line.split("=", 1)[1].strip()
            return value or None
    return None
