import type { Edge, Node, Viewport } from "@xyflow/react";
import type { CatalogBrand, CatalogStatus } from "../catalog/catalogTypes";

export type DesignerNodeKind =
  | "catalog.service"
  | "catalog.component"
  | "instance.ref"
  | "vip.ref"
  | "group.frame"
  | "placement.lane";

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
   * Placement domain for Multi-site / Swimlanes (e.g. "Site A", "Shared Services").
   * Stored on the graph for a future deployable multi-site model.
   */
  placementDomain?: string;
};

export type DesignerEdgeData = {
  protocol?: string;
  note?: string;
};

export type DesignerNode = Node<DesignerNodeData, "designer" | "designerGroup" | "designerLane">;
export type DesignerEdge = Edge<DesignerEdgeData>;

export type DesignerGraphDocument = {
  nodes: DesignerNode[];
  edges: DesignerEdge[];
  viewport: Viewport;
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
    };

export const DESIGNER_DND_MIME = "application/axionet-designer";

export function emptyDesignerGraph(): DesignerGraphDocument {
  return {
    nodes: [],
    edges: [],
    viewport: { x: 0, y: 0, zoom: 1 },
  };
}

export function parseGraphDocument(raw: unknown): DesignerGraphDocument {
  const doc = (raw ?? {}) as Partial<DesignerGraphDocument>;
  return {
    nodes: Array.isArray(doc.nodes) ? (doc.nodes as DesignerNode[]) : [],
    edges: Array.isArray(doc.edges) ? (doc.edges as DesignerEdge[]) : [],
    viewport: doc.viewport ?? { x: 0, y: 0, zoom: 1 },
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
