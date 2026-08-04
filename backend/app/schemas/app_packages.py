from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


class AppPackageSummary(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    serviceType: str
    version: str
    name: str
    summary: str
    reference: bool = False
    hydrate: Literal["none", "onDrop", "poll"] = "none"
    actions: list[str] = Field(default_factory=list)


class AppPackageRead(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    serviceType: str
    version: str
    reference: bool = False
    capabilities: dict[str, Any]
    catalog: dict[str, Any]
    designer: dict[str, Any]
    instanceSchema: dict[str, Any]
    desiredStateExample: dict[str, Any]
    flowNodes: list[dict[str, Any]] = Field(default_factory=list)
    flowEdges: list[dict[str, Any]] = Field(default_factory=list)


class DesignerManifestRead(BaseModel):
    """Mirrors frontend DesignerManifest (package designer.json)."""

    model_config = ConfigDict(extra="allow")

    catalogId: str
    serviceType: str
    components: list[dict[str, Any]]
    chain: list[dict[str, Any]]
    roles: dict[str, Any]
    hydrate: Literal["none", "onDrop", "poll"] | None = None
    detailPathTemplate: str | None = None
    applySteps: dict[str, Any] | None = None


class AppPackageCatalogCard(BaseModel):
    """Catalog-ready overlay card derived from package catalog.json + designer flow."""

    model_config = ConfigDict(extra="forbid")

    id: str
    serviceType: str
    version: str
    reference: bool = False
    name: str
    summary: str
    description: str
    kind: str
    category: str
    brand: dict[str, Any]
    tags: list[str] = Field(default_factory=list)
    capabilities: list[str] = Field(default_factory=list)
    primaryAction: str | None = None
    implementationHint: str | None = None
    notes: list[str] = Field(default_factory=list)
    flowNodes: list[dict[str, Any]] = Field(default_factory=list)
    flowEdges: list[dict[str, Any]] = Field(default_factory=list)


class AppStorePackage(BaseModel):
    model_config = ConfigDict(extra="allow")

    id: str
    version: str
    name: str
    summary: str
    source: Literal["bundled", "github"]
    path: str | None = None
    archiveUrl: str | None = None
    signatureUrl: str | None = None
    repository: str | None = None
    storeId: str | None = None
    storeName: str | None = None
    installed: bool = False
    installedVersion: str | None = None
    signing: Literal["required", "not_applicable", "signed", "unsigned"] | None = None


class AppStoreSourceMeta(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    name: str
    indexUrl: str | None = None
    indexSource: Literal["remote", "bundled"] = "bundled"
    priority: int = 0


class AppStoreIndexRead(BaseModel):
    model_config = ConfigDict(extra="forbid")

    apiVersion: str
    name: str
    indexSource: Literal["remote", "bundled"] = "bundled"
    indexUrl: str | None = None
    sources: list[AppStoreSourceMeta] = Field(default_factory=list)
    packages: list[AppStorePackage] = Field(default_factory=list)


class AppPackageInstallRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    packageId: str | None = None
    archiveUrl: str | None = None
    signatureUrl: str | None = None


class AppPackageInstallResult(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    version: str
    status: Literal["installed", "already_installed"]


class AppStoreSource(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    name: str
    indexUrl: str
    enabled: bool = True
    priority: int = 0


class AppStoreSourcesReplace(BaseModel):
    model_config = ConfigDict(extra="forbid")

    sources: list[AppStoreSource] = Field(default_factory=list)


class AppStoreSourceCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str | None = None
    name: str
    indexUrl: str
    enabled: bool = True
    priority: int = 0


class AppStoreTrustKey(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    name: str
    publicKey: str


class AppStoreTrustRead(BaseModel):
    model_config = ConfigDict(extra="forbid")

    allowUnsignedPackages: bool = True
    keys: list[AppStoreTrustKey] = Field(default_factory=list)


class AppStoreTrustUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    allowUnsignedPackages: bool
    keys: list[AppStoreTrustKey] | None = None


class AppStoreTrustKeyCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str | None = None
    name: str
    publicKey: str
