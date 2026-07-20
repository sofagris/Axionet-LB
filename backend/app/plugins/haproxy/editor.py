from __future__ import annotations

from copy import deepcopy
from typing import Any

from app.plugins.haproxy.schemas import (
    HaproxyBackend,
    HaproxyConfig,
    HaproxyFrontend,
    HaproxyServer,
)


class HaproxyConfigEditor:
    """Mutate structured HAProxy configuration stored on ServiceInstance."""

    def __init__(self, configuration: dict[str, Any] | None) -> None:
        self._config = HaproxyConfig.from_dict(configuration)

    @property
    def config(self) -> HaproxyConfig:
        return self._config

    def as_dict(self) -> dict[str, Any]:
        return self._config.model_dump()

    # Frontends
    def list_frontends(self) -> list[HaproxyFrontend]:
        return list(self._config.frontends)

    def get_frontend(self, name: str) -> HaproxyFrontend | None:
        return next((item for item in self._config.frontends if item.name == name), None)

    def upsert_frontend(self, frontend: HaproxyFrontend, *, create: bool) -> HaproxyFrontend:
        existing = self.get_frontend(frontend.name)
        if create and existing is not None:
            raise ValueError(f"Frontend already exists: {frontend.name}")
        if not create and existing is None:
            raise ValueError(f"Frontend not found: {frontend.name}")
        if existing is None:
            self._config.frontends.append(frontend)
        else:
            self._config.frontends = [
                frontend if item.name == frontend.name else item for item in self._config.frontends
            ]
        return frontend

    def delete_frontend(self, name: str) -> None:
        if self.get_frontend(name) is None:
            raise ValueError(f"Frontend not found: {name}")
        self._config.frontends = [item for item in self._config.frontends if item.name != name]

    # Backends
    def list_backends(self) -> list[HaproxyBackend]:
        return list(self._config.backends)

    def get_backend(self, name: str) -> HaproxyBackend | None:
        return next((item for item in self._config.backends if item.name == name), None)

    def upsert_backend(self, backend: HaproxyBackend, *, create: bool) -> HaproxyBackend:
        existing = self.get_backend(backend.name)
        if create and existing is not None:
            raise ValueError(f"Backend already exists: {backend.name}")
        if not create and existing is None:
            raise ValueError(f"Backend not found: {backend.name}")
        if existing is None:
            self._config.backends.append(backend)
        else:
            # Preserve servers unless explicitly provided with content
            merged = backend
            if not backend.servers and existing.servers:
                merged = backend.model_copy(update={"servers": existing.servers})
            self._config.backends = [
                merged if item.name == backend.name else item for item in self._config.backends
            ]
            return merged
        return backend

    def delete_backend(self, name: str) -> None:
        if self.get_backend(name) is None:
            raise ValueError(f"Backend not found: {name}")
        self._config.backends = [item for item in self._config.backends if item.name != name]

    # Servers
    def list_servers(self, backend_name: str) -> list[HaproxyServer]:
        backend = self.get_backend(backend_name)
        if backend is None:
            raise ValueError(f"Backend not found: {backend_name}")
        return list(backend.servers)

    def get_server(self, backend_name: str, server_name: str) -> HaproxyServer | None:
        return next(
            (item for item in self.list_servers(backend_name) if item.name == server_name),
            None,
        )

    def upsert_server(
        self,
        backend_name: str,
        server: HaproxyServer,
        *,
        create: bool,
    ) -> HaproxyServer:
        backend = self.get_backend(backend_name)
        if backend is None:
            raise ValueError(f"Backend not found: {backend_name}")
        existing = next((item for item in backend.servers if item.name == server.name), None)
        if create and existing is not None:
            raise ValueError(f"Server already exists: {server.name}")
        if not create and existing is None:
            raise ValueError(f"Server not found: {server.name}")
        if existing is None:
            backend.servers.append(server)
        else:
            backend.servers = [
                server if item.name == server.name else item for item in backend.servers
            ]
        return server

    def delete_server(self, backend_name: str, server_name: str) -> None:
        backend = self.get_backend(backend_name)
        if backend is None:
            raise ValueError(f"Backend not found: {backend_name}")
        if not any(item.name == server_name for item in backend.servers):
            raise ValueError(f"Server not found: {server_name}")
        backend.servers = [item for item in backend.servers if item.name != server_name]

    def replace_config(self, configuration: dict[str, Any]) -> HaproxyConfig:
        self._config = HaproxyConfig.from_dict(deepcopy(configuration))
        return self._config
