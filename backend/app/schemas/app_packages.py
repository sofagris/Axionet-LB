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
