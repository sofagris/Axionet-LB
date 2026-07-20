from __future__ import annotations

from copy import deepcopy
from typing import Any

from app.plugins.haproxy.schemas import (
    HaproxyAcl,
    HaproxyBackend,
    HaproxyCertificate,
    HaproxyConfig,
    HaproxyFrontend,
    HaproxyMap,
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

    def get_defaults(self) -> dict[str, Any]:
        return {
            "mode": self._config.mode,
            "stats_port": self._config.stats_port,
            "timeout_connect": self._config.timeout_connect,
            "timeout_client": self._config.timeout_client,
            "timeout_server": self._config.timeout_server,
        }

    def update_defaults(
        self,
        *,
        mode: str | None = None,
        stats_port: int | None = None,
        timeout_connect: str | None = None,
        timeout_client: str | None = None,
        timeout_server: str | None = None,
    ) -> dict[str, Any]:
        updates: dict[str, Any] = {}
        if mode is not None:
            updates["mode"] = mode
        if stats_port is not None:
            updates["stats_port"] = stats_port
        if timeout_connect is not None:
            updates["timeout_connect"] = timeout_connect
        if timeout_client is not None:
            updates["timeout_client"] = timeout_client
        if timeout_server is not None:
            updates["timeout_server"] = timeout_server
        if updates:
            self._config = self._config.model_copy(update=updates)
        return self.get_defaults()

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
        self._config.acls = [item for item in self._config.acls if item.frontend != name]

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
        self._config.acls = [
            item.model_copy(update={"use_backend": None}) if item.use_backend == name else item
            for item in self._config.acls
        ]

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

    # Certificates
    def list_certificates(self) -> list[HaproxyCertificate]:
        return list(self._config.certificates)

    def get_certificate(self, name: str) -> HaproxyCertificate | None:
        return next((item for item in self._config.certificates if item.name == name), None)

    def upsert_certificate(self, certificate: HaproxyCertificate, *, create: bool) -> HaproxyCertificate:
        existing = self.get_certificate(certificate.name)
        if create and existing is not None:
            raise ValueError(f"Certificate already exists: {certificate.name}")
        if not create and existing is None:
            raise ValueError(f"Certificate not found: {certificate.name}")
        filename = certificate.filename or f"certs/{certificate.name}.pem"
        item = certificate.model_copy(update={"filename": filename})
        if existing is None:
            self._config.certificates.append(item)
        else:
            self._config.certificates = [
                item if entry.name == item.name else entry for entry in self._config.certificates
            ]
        return item

    def delete_certificate(self, name: str) -> None:
        if self.get_certificate(name) is None:
            raise ValueError(f"Certificate not found: {name}")
        self._config.certificates = [item for item in self._config.certificates if item.name != name]
        self._config.frontends = [
            item.model_copy(update={"certificate": None}) if item.certificate == name else item
            for item in self._config.frontends
        ]

    # Maps
    def list_maps(self) -> list[HaproxyMap]:
        return list(self._config.maps)

    def get_map(self, name: str) -> HaproxyMap | None:
        return next((item for item in self._config.maps if item.name == name), None)

    def upsert_map(self, haproxy_map: HaproxyMap, *, create: bool) -> HaproxyMap:
        existing = self.get_map(haproxy_map.name)
        if create and existing is not None:
            raise ValueError(f"Map already exists: {haproxy_map.name}")
        if not create and existing is None:
            raise ValueError(f"Map not found: {haproxy_map.name}")
        filename = haproxy_map.filename or f"maps/{haproxy_map.name}.map"
        item = haproxy_map.model_copy(update={"filename": filename})
        if create:
            self._config.maps.append(item)
        else:
            self._config.maps = [
                item if entry.name == item.name else entry for entry in self._config.maps
            ]
        return item

    def delete_map(self, name: str) -> None:
        if self.get_map(name) is None:
            raise ValueError(f"Map not found: {name}")
        self._config.maps = [item for item in self._config.maps if item.name != name]

    # ACLs
    def list_acls(self) -> list[HaproxyAcl]:
        return list(self._config.acls)

    def get_acl(self, name: str) -> HaproxyAcl | None:
        return next((item for item in self._config.acls if item.name == name), None)

    def upsert_acl(self, acl: HaproxyAcl, *, create: bool) -> HaproxyAcl:
        existing = self.get_acl(acl.name)
        if create and existing is not None:
            raise ValueError(f"ACL already exists: {acl.name}")
        if not create and existing is None:
            raise ValueError(f"ACL not found: {acl.name}")
        if self.get_frontend(acl.frontend) is None:
            raise ValueError(f"Frontend not found: {acl.frontend}")
        if acl.use_backend and self.get_backend(acl.use_backend) is None:
            raise ValueError(f"Backend not found: {acl.use_backend}")
        if existing is None:
            self._config.acls.append(acl)
        else:
            self._config.acls = [acl if item.name == acl.name else item for item in self._config.acls]
        return acl

    def delete_acl(self, name: str) -> None:
        if self.get_acl(name) is None:
            raise ValueError(f"ACL not found: {name}")
        self._config.acls = [item for item in self._config.acls if item.name != name]

    def replace_config(self, configuration: dict[str, Any]) -> HaproxyConfig:
        self._config = HaproxyConfig.from_dict(deepcopy(configuration))
        return self._config
