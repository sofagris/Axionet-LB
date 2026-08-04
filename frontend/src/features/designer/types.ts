import type { Edge, Node, Viewport } from "@xyflow/react";
import type { CatalogBrand, CatalogStatus } from "../catalog/catalogTypes";

export type DesignerNodeKind =
  | "catalog.service"
  | "catalog.component"
  | "instance.ref"
  | "vip.ref"
  | "group.frame"
  | "placement.lane"
  | "visual.annotation";

export type VisualAnnotationId =
  | "internet-cloud"
  | "user"
  | "group"
  | "client";

export type DesignerNodeData = {
  kind: DesignerNodeKind;
  label: string;
  catalogSlug?: string;
  catalogId?: string;
  serviceType?: string;
  serviceId?: string;
  vipId?: string;
  catalogStatus?: CatalogStatus;
  brand?: CatalogBrand;
  note?: string;
  /** Mark planned/concept drops that cannot be applied */
  comingSoon?: boolean;
  /** Component within a service tree (Frontend / Backend / …) */
  componentId?: string;
  componentRole?: string;
  /** Role-specific configuration fields */
  props?: Record<string, string>;
  /** True while live instance config is being fetched into this group */
  hydrating?: boolean;
  /** Pin position — auto-layout will not move this node when preservePinned is on */
  pinned?: boolean;
  /**
   * Legacy free-text placement label (kept in sync with registry name).
   * Prefer placementDomainId.
   */
  placementDomain?: string;
  /** Stable id into design document placementDomains registry */
  placementDomainId?: string;
  /** Lane-only: site vs shared */
  placementKind?: "site" | "shared";
  placementDescription?: string;
  placementIcon?: "site" | "shared" | "building";
  /** Optional fill for group.frame / placement.lane (#rrggbb) */
  fillColor?: string;
  /** Fill opacity 0–1 (default ~0.28 when fillColor is set) */
  fillOpacity?: number;
  /** Visual-only annotation identity (no runtime config). */
  visualId?: VisualAnnotationId;
};

export type DesignerEdgeData = {
  protocol?: string;
  note?: string;
};

export type DesignerNode = Node<DesignerNodeData, "designer" | "designerGroup" | "designerLane">;
export type DesignerEdge = Edge<DesignerEdgeData>;

export type PlacementDomainKind = "site" | "shared";
export type PlacementDomainIcon = "site" | "shared" | "building";

export type PlacementDomain = {
  id: string;
  name: string;
  kind: PlacementDomainKind;
  description?: string;
  icon?: PlacementDomainIcon;
};

export type DesignerGraphDocument = {
  nodes: DesignerNode[];
  edges: DesignerEdge[];
  viewport: Viewport;
  placementDomains?: PlacementDomain[];
};

export type PaletteDragPayload =
  | {
      source: "catalog";
      catalogId: string;
      catalogSlug: string;
      label: string;
      serviceType?: string;
      catalogStatus: CatalogStatus;
      brand: CatalogBrand;
      comingSoon: boolean;
      /** When "tree", drop parent + all palette components. */
      dropMode?: "single" | "tree";
    }
  | {
      source: "catalog.component";
      catalogId: string;
      catalogSlug: string;
      label: string;
      serviceType?: string;
      catalogStatus: CatalogStatus;
      brand: CatalogBrand;
      comingSoon: boolean;
      componentId: string;
      componentRole: string;
    }
  | {
      source: "instance";
      serviceId: string;
      label: string;
      serviceType: string;
      catalogSlug?: string;
      brand?: CatalogBrand;
      dropMode?: "single" | "tree";
    }
  | {
      source: "instance.component";
      serviceId: string;
      label: string;
      serviceType: string;
      catalogId: string;
      catalogSlug?: string;
      brand?: CatalogBrand;
      componentId: string;
      componentRole: string;
    }
  | {
      source: "vip";
      vipId: string;
      label: string;
      address: string;
    }
  | {
      source: "visual";
      visualId: VisualAnnotationId;
      label: string;
    };

export const DESIGNER_DND_MIME = "application/axionet-designer";

export function emptyDesignerGraph(): DesignerGraphDocument {
  return {
    nodes: [],
    edges: [],
    viewport: { x: 0, y: 0, zoom: 1 },
    placementDomains: [],
  };
}

export function parseGraphDocument(raw: unknown): DesignerGraphDocument {
  const doc = (raw ?? {}) as Partial<DesignerGraphDocument>;
  const nodes = Array.isArray(doc.nodes) ? (doc.nodes as DesignerNode[]) : [];
  const edges = Array.isArray(doc.edges) ? (doc.edges as DesignerEdge[]) : [];
  const existing = Array.isArray(doc.placementDomains)
    ? (doc.placementDomains as PlacementDomain[])
    : [];
  // Lazy migrate is done by callers with migratePlacementDomains for full sync.
  return {
    nodes,
    edges,
    viewport: doc.viewport ?? { x: 0, y: 0, zoom: 1 },
    placementDomains: existing,
  };
}

export function serializeGraphDocument(doc: DesignerGraphDocument): DesignerGraphDocument {
  return {
    nodes: doc.nodes.map((node) => ({
      id: node.id,
      type: node.type ?? "designer",
      position: node.position,
      data: node.data,
      parentId: node.parentId,
      extent: node.extent,
      style: node.style,
      width: node.width,
      height: node.height,
      zIndex: node.zIndex,
      selectable: node.selectable,
      draggable: node.draggable,
    })),
    edges: doc.edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      label: edge.label,
      data: edge.data ?? {},
      zIndex: edge.zIndex,
    })),
    viewport: doc.viewport,
    placementDomains: doc.placementDomains ?? [],
  };
}

/** Short id that works on HTTP lab hosts (crypto.randomUUID needs a secure context). */
function shortId(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === "function") {
    return c.randomUUID().slice(0, 8);
  }
  if (c && typeof c.getRandomValues === "function") {
    const bytes = new Uint8Array(4);
    c.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  }
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export function newNodeId(): string {
  return `n_${shortId()}`;
}

export function newEdgeId(): string {
  return `e_${shortId()}`;
}

export function instanceDetailPath(serviceType: string, serviceId: string): string {
  const known = ["haproxy", "frr", "keycloak-mgmt", "keycloak-apps", "auth-gateway"];
  if (known.includes(serviceType)) {
    return `/instances/${serviceId}/${serviceType}`;
  }
  return `/instances`;
}

export function createWizardPath(serviceType: string): string {
  return `/instances/new?type=${encodeURIComponent(serviceType)}`;
}
