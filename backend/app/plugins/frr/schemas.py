from __future__ import annotations

import ipaddress
import re

from pydantic import BaseModel, Field, field_validator


NAME_RE = re.compile(r"^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$")


class BgpNeighbor(BaseModel):
    name: str = "peer1"
    address: str
    remote_as: int = Field(ge=1, le=4294967295)
    password: str | None = None
    description: str | None = None

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        if not NAME_RE.match(value):
            raise ValueError("Invalid neighbor name")
        return value

    @field_validator("address")
    @classmethod
    def validate_address(cls, value: str) -> str:
        ipaddress.ip_address(value)
        return value


class FrrConfig(BaseModel):
    hostname: str = "ax-frr"
    router_id: str = "1.1.1.1"
    local_as: int = Field(default=65001, ge=1, le=4294967295)
    neighbors: list[BgpNeighbor] = Field(default_factory=list)
    networks: list[str] = Field(default_factory=list)
    log_stdout: bool = True

    @field_validator("hostname")
    @classmethod
    def validate_hostname(cls, value: str) -> str:
        if not NAME_RE.match(value):
            raise ValueError("Invalid hostname")
        return value

    @field_validator("router_id")
    @classmethod
    def validate_router_id(cls, value: str) -> str:
        ipaddress.IPv4Address(value)
        return value

    @field_validator("networks")
    @classmethod
    def validate_networks(cls, value: list[str]) -> list[str]:
        cleaned: list[str] = []
        for item in value:
            network = ipaddress.ip_network(item, strict=False)
            cleaned.append(str(network))
        return cleaned

    @classmethod
    def from_dict(cls, data: dict | None) -> FrrConfig:
        if not data:
            return cls()
        return cls.model_validate(data)

    def default_for_create(self) -> FrrConfig:
        return self
