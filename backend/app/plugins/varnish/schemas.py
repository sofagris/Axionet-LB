from __future__ import annotations

import re
from typing import Any

from pydantic import BaseModel, Field, field_validator

STORAGE_RE = re.compile(r"^\d+[kKmMgGtT]?$")
TTL_RE = re.compile(r"^\d+(\.\d+)?(ms|s|m|h|d|w|y)$")
BIND_RE = re.compile(r"^(\*|[\w.:\[\]]+):\d{1,5}$|^:\d{1,5}$")


class VarnishOrigin(BaseModel):
    address: str = Field(min_length=1)
    port: int = Field(ge=1, le=65535)
    host_header: str | None = None

    @field_validator("address")
    @classmethod
    def strip_address(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("origin.address is required")
        return cleaned

    @field_validator("host_header")
    @classmethod
    def strip_host_header(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = value.strip()
        return cleaned or None


class VarnishConfig(BaseModel):
    """Desired state for varnish instances (matches packages/apps/varnish schema)."""

    name: str = Field(default="varnish-edge", min_length=1)
    bind: str = Field(default="*:6081", min_length=1)
    storage_size: str = Field(default="256m", min_length=1)
    ttl_default: str = "120s"
    origin: VarnishOrigin = Field(default_factory=lambda: VarnishOrigin(address="127.0.0.1", port=80))

    @field_validator("name", "bind", "storage_size", "ttl_default")
    @classmethod
    def strip_text(cls, value: str) -> str:
        return value.strip()

    @field_validator("bind")
    @classmethod
    def validate_bind(cls, value: str) -> str:
        if not BIND_RE.match(value):
            raise ValueError("bind must look like *:6081 or :6081")
        return value

    @field_validator("storage_size")
    @classmethod
    def validate_storage(cls, value: str) -> str:
        if not STORAGE_RE.match(value):
            raise ValueError("storage_size must look like 256m")
        return value

    @field_validator("ttl_default")
    @classmethod
    def validate_ttl(cls, value: str) -> str:
        if not TTL_RE.match(value):
            raise ValueError("ttl_default must look like 120s")
        return value

    @classmethod
    def from_dict(cls, data: dict[str, Any] | None) -> VarnishConfig:
        if not data:
            return cls()
        return cls.model_validate(data)

    def varnish_listen(self) -> str:
        """Normalize HAProxy-style *:port to varnishd -a form."""
        if self.bind.startswith("*:"):
            return f":{self.bind.split(':', 1)[1]}"
        return self.bind
