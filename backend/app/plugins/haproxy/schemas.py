from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class HaproxyServer(BaseModel):
    name: str = "s1"
    address: str = "127.0.0.1"
    port: int = 8080
    check: bool = True


class HaproxyBackend(BaseModel):
    name: str = "app"
    balance: str = "roundrobin"
    mode: str = "http"
    servers: list[HaproxyServer] = Field(default_factory=lambda: [HaproxyServer()])


class HaproxyFrontend(BaseModel):
    name: str = "main"
    bind_address: str = "*"
    bind_port: int = 80
    mode: str = "http"
    default_backend: str = "app"


class HaproxyConfig(BaseModel):
    mode: str = "http"
    stats_port: int = 8404
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
