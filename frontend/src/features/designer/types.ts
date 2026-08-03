import type { Edge, Node, Viewport } from "@xyflow/react";
import type { CatalogBrand, CatalogStatus } from "../catalog/catalogTypes";

export type DesignerNodeKind = "catalog.service" | "instance.ref" | "vip.ref";

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
};

export type DesignerEdgeData = {
  protocol?: string;
  note?: string;
};

export type DesignerNode = Node<DesignerNodeData, "designer">;
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
    }
  | {
      source: "instance";
      serviceId: string;
      label: string;
      serviceType: string;
      catalogSlug?: string;
      brand?: CatalogBrand;
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
    })),
    edges: doc.edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      label: edge.label,
      data: edge.data ?? {},
    })),
    viewport: doc.viewport,
  };
}

export function newNodeId(): string {
  return `n_${crypto.randomUUID().slice(0, 8)}`;
}

export function newEdgeId(): string {
  return `e_${crypto.randomUUID().slice(0, 8)}`;
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
