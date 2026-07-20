from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


class HaproxyServer(BaseModel):
    name: str = "s1"
    address: str = "127.0.0.1"
    port: int = Field(default=8080, ge=1, le=65535)
    check: bool = True
    weight: int = Field(default=100, ge=0, le=256)
    inter_ms: int = Field(default=2000, ge=100, le=60000)
    rise: int = Field(default=2, ge=1, le=100)
    fall: int = Field(default=3, ge=1, le=100)


class HaproxyBackend(BaseModel):
    name: str = "app"
    balance: Literal["roundrobin", "leastconn", "source"] = "roundrobin"
    mode: Literal["http", "tcp"] = "http"
    servers: list[HaproxyServer] = Field(default_factory=lambda: [HaproxyServer()])


class HaproxyFrontend(BaseModel):
    name: str = "main"
    bind_address: str = "*"
    bind_port: int = Field(default=80, ge=1, le=65535)
    mode: Literal["http", "tcp"] = "http"
    default_backend: str = "app"


class HaproxyConfig(BaseModel):
    mode: Literal["http", "tcp"] = "http"
    stats_port: int = Field(default=8404, ge=1, le=65535)
    frontends: list[HaproxyFrontend] = Field(default_factory=lambda: [HaproxyFrontend()])
    backends: list[HaproxyBackend] = Field(default_factory=lambda: [HaproxyBackend()])
    timeout_connect: str = "5s"
    timeout_client: str = "30s"
    timeout_server: str = "30s"

    @classmethod
    def from_dict(cls, data: dict[str, Any] | None) -> HaproxyConfig:
        if not data:
            return cls()
        return cls.model_validate(data)
