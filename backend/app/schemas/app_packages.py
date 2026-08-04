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
