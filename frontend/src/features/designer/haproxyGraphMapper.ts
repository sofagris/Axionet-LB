/**
 * Bidirectional mapping between live HAProxy API entities and Designer graph nodes.
 *
 * - hydrateHaproxyGraph: API → canvas (instance drop / live sync)
 * - toHaproxyDesiredState: canvas → desired config shape (for future Designer deploy; not applied yet)
 */
import type {
  HaproxyAcl,
  HaproxyBackend,
  HaproxyErrorFile,
  HaproxyFrontend,
} from "../../types/haproxy";
import type { CatalogBrand, CatalogStatus } from "../catalog/catalogTypes";
import {
  layoutSiblingNodes,
  mergePreservedChildPositions,
  resizeGroupToChildren,
} from "./autoLayout";
import {
  newEdgeId,
  newNodeId,
  type DesignerEdge,
  type DesignerNode,
  type DesignerNodeData,
} from "./types";

export type HydrateHaproxyInput = {
  serviceId: string;
  groupId: string;
  groupPosition: { x: number; y: number };
  label: string;
  catalogId?: string;
  catalogSlug?: string;
  brand?: CatalogBrand;
  catalogStatus?: CatalogStatus;
  frontends: HaproxyFrontend[];
  backends: HaproxyBackend[];
  errorFiles: HaproxyErrorFile[];
  acls?: HaproxyAcl[];
};

export type HaproxyDesiredFrontend = {
  name: string;
  bind_address: string;
  bind_port: number;
  mode: string;
  default_backend: string;
  certificate: string | null;
};

export type HaproxyDesiredServer = {
  name: string;
  address: string;
  port: number;
  check: boolean;
  weight: number;
  backend: string;
};

export type HaproxyDesiredBackend = {
  name: string;
  balance: string;
  mode: string;
  servers: HaproxyDesiredServer[];
};

export type HaproxyDesiredErrorFile = {
  name: string;
  status_code: number;
  frontend: string | null;
};

/** Desired HAProxy config extracted from Designer nodes — used by future deploy. */
export type HaproxyDesiredState = {
  frontends: HaproxyDesiredFrontend[];
  backends: HaproxyDesiredBackend[];
  error_files: HaproxyDesiredErrorFile[];
};

function componentData(partial: {
  label: string;
  serviceId: string;
  catalogId?: string;
  catalogSlug?: string;
  brand?: CatalogBrand;
  catalogStatus?: CatalogStatus;
  componentId: string;
  componentRole: string;
  props: Record<string, string>;
}): DesignerNodeData {
  return {
    kind: "catalog.component",
    label: partial.label,
    serviceType: "haproxy",
    serviceId: partial.serviceId,
    catalogId: partial.catalogId ?? "haproxy",
    catalogSlug: partial.catalogSlug ?? "haproxy",
    brand: partial.brand,
    catalogStatus: partial.catalogStatus,
    componentId: partial.componentId,
    componentRole: partial.componentRole,
    props: partial.props,
  };
}

function parseBind(bind: string): { bind_address: string; bind_port: number } {
  const trimmed = bind.trim();
  const idx = trimmed.lastIndexOf(":");
  if (idx <= 0) {
    return { bind_address: trimmed || "*", bind_port: 80 };
  }
  const port = Number(trimmed.slice(idx + 1));
  return {
    bind_address: trimmed.slice(0, idx) || "*",
    bind_port: Number.isFinite(port) ? port : 80,
  };
}

function checkFromProp(value: string | undefined): boolean {
  if (!value) return true;
  const v = value.toLowerCase();
  return v === "enabled" || v === "true" || v === "1" || v === "yes";
}

/**
 * Build a hydrated HAProxy group graph from live API entities.
 * Reuses `groupId` / position so the skeleton group can be replaced in place.
 */
export function hydrateHaproxyGraph(input: HydrateHaproxyInput): {
  group: DesignerNode;
  children: DesignerNode[];
  edges: DesignerEdge[];
} {
  const {
    serviceId,
    groupId,
    groupPosition,
    label,
    catalogId,
    catalogSlug,
    brand,
    catalogStatus,
    frontends,
    backends,
    errorFiles,
    acls = [],
  } = input;

  const meta = { serviceId, catalogId, catalogSlug, brand, catalogStatus };
  const children: DesignerNode[] = [];
  const feIds = new Map<string, string>();
  const beIds = new Map<string, string>();
  const errIds = new Map<string, string>();

  for (const fe of frontends) {
    const id = newNodeId();
    feIds.set(fe.name, id);
    children.push({
      id,
      type: "designer",
      parentId: groupId,
      extent: "parent",
      position: { x: 0, y: 0 },
      data: componentData({
        ...meta,
        label: fe.name,
        componentId: "frontend",
        componentRole: "frontend",
        props: {
          name: fe.name,
          bind: `${fe.bind_address}:${fe.bind_port}`,
          mode: fe.mode,
          default_backend: fe.default_backend ?? "",
          certificate: fe.certificate ?? "",
        },
      }),
    });
  }

  for (const be of backends) {
    const id = newNodeId();
    beIds.set(be.name, id);
    children.push({
      id,
      type: "designer",
      parentId: groupId,
      extent: "parent",
      position: { x: 0, y: 0 },
      data: componentData({
        ...meta,
        label: be.name,
        componentId: "backend",
        componentRole: "backend",
        props: {
          name: be.name,
          balance: be.balance,
          mode: be.mode,
        },
      }),
    });

    for (const server of be.servers ?? []) {
      children.push({
        id: newNodeId(),
        type: "designer",
        parentId: groupId,
        extent: "parent",
        position: { x: 0, y: 0 },
        data: componentData({
          ...meta,
          label: `${be.name}/${server.name}`,
          componentId: "server",
          componentRole: "server",
          props: {
            name: server.name,
            address: server.address,
            port: String(server.port),
            check: server.check ? "enabled" : "disabled",
            weight: String(server.weight),
            backend: be.name,
          },
        }),
      });
    }
  }

  for (const err of errorFiles) {
    const id = newNodeId();
    errIds.set(err.name, id);
    children.push({
      id,
      type: "designer",
      parentId: groupId,
      extent: "parent",
      position: { x: 0, y: 0 },
      data: componentData({
        ...meta,
        label: `${err.status_code} ${err.name}`,
        componentId: "error-page",
        componentRole: "error-page",
        props: {
          name: err.name,
          status_code: String(err.status_code),
          title: err.name,
          frontend: err.frontend ?? "",
        },
      }),
    });
  }

  const edges: DesignerEdge[] = [];
  const edgeKey = new Set<string>();

  const addEdge = (source: string, target: string, labelText: string) => {
    const key = `${source}->${target}:${labelText}`;
    if (edgeKey.has(key)) return;
    edgeKey.add(key);
    edges.push({
      id: newEdgeId(),
      source,
      target,
      label: labelText,
      data: { protocol: labelText },
    });
  };

  for (const fe of frontends) {
    const feId = feIds.get(fe.name);
    if (!feId) continue;
    if (fe.default_backend) {
      const beId = beIds.get(fe.default_backend);
      if (beId) addEdge(feId, beId, "default_backend");
    }
  }

  for (const acl of acls) {
    if (!acl.use_backend) continue;
    const feId = feIds.get(acl.frontend);
    const beId = beIds.get(acl.use_backend);
    if (feId && beId) addEdge(feId, beId, acl.name);
  }

  for (const be of backends) {
    const beId = beIds.get(be.name);
    if (!beId) continue;
    for (const child of children) {
      if (
        child.data.componentRole === "server" &&
        child.data.props?.backend === be.name
      ) {
        addEdge(beId, child.id, "server");
      }
    }
  }

  const feIdList = [...feIds.values()];
  for (const err of errorFiles) {
    const errId = errIds.get(err.name);
    if (!errId) continue;
    if (err.frontend) {
      const feId = feIds.get(err.frontend);
      if (feId) addEdge(feId, errId, "errorfile");
    } else {
      for (const feId of feIdList) {
        addEdge(feId, errId, "errorfile");
      }
    }
  }

  const laidOutChildren = layoutSiblingNodes(children, edges, "flow");
  const group: DesignerNode = resizeGroupToChildren(
    {
      id: groupId,
      type: "designerGroup",
      position: groupPosition,
      style: { width: 280, height: 160 },
      zIndex: -1,
      data: {
        kind: "group.frame",
        label,
        serviceType: "haproxy",
        serviceId,
        catalogId: catalogId ?? "haproxy",
        catalogSlug: catalogSlug ?? "haproxy",
        brand,
        catalogStatus,
        hydrating: false,
      },
    },
    laidOutChildren,
  );

  return { group, children: laidOutChildren, edges };
}

/** Replace skeleton children of a group with a hydrated subgraph. */
export function applyHydratedGroup(
  allNodes: DesignerNode[],
  allEdges: DesignerEdge[],
  groupId: string,
  hydrated: { group: DesignerNode; children: DesignerNode[]; edges: DesignerEdge[] },
): { nodes: DesignerNode[]; edges: DesignerEdge[] } {
  const existing = allNodes.find((n) => n.id === groupId);
  const oldChildren = allNodes.filter((n) => n.parentId === groupId);
  const oldChildIds = new Set(oldChildren.map((n) => n.id));
  const children = mergePreservedChildPositions(oldChildren, hydrated.children);
  const group = resizeGroupToChildren(
    {
      ...hydrated.group,
      // Keep canvas placement (lane parent + relative pos) across rehydrate/sync.
      parentId: existing?.parentId,
      extent: existing?.extent,
      position: existing?.position ?? hydrated.group.position,
      data: {
        ...hydrated.group.data,
        placementDomainId: existing?.data.placementDomainId,
        placementDomain: existing?.data.placementDomain,
        pinned: existing?.data.pinned,
      },
    },
    children,
  );
  const nodes = [
    ...allNodes.filter((n) => n.id !== groupId && n.parentId !== groupId),
    group,
    ...children,
  ];
  const edges = [
    ...allEdges.filter(
      (e) =>
        e.source !== groupId &&
        e.target !== groupId &&
        !oldChildIds.has(e.source) &&
        !oldChildIds.has(e.target),
    ),
    ...hydrated.edges,
  ];
  return { nodes, edges };
}

/**
 * Extract desired HAProxy config from Designer nodes (future deploy).
 * Only includes catalog.component nodes for the given serviceId (or all haproxy if omitted).
 */
export function toHaproxyDesiredState(
  nodes: DesignerNode[],
  _edges: DesignerEdge[],
  serviceId?: string,
): HaproxyDesiredState {
  void _edges;
  const components = nodes.filter((n) => {
    if (n.data.kind !== "catalog.component") return false;
    if (n.data.serviceType && n.data.serviceType !== "haproxy") return false;
    if (serviceId && n.data.serviceId !== serviceId) return false;
    return true;
  });

  const frontends: HaproxyDesiredFrontend[] = [];
  const backendMap = new Map<string, HaproxyDesiredBackend>();
  const error_files: HaproxyDesiredErrorFile[] = [];

  for (const node of components) {
    const role = node.data.componentRole;
    const props = node.data.props ?? {};
    if (role === "frontend") {
      const bind = parseBind(props.bind ?? "*:80");
      frontends.push({
        name: props.name || node.data.label,
        bind_address: bind.bind_address,
        bind_port: bind.bind_port,
        mode: props.mode || "http",
        default_backend: props.default_backend || "",
        certificate: props.certificate?.trim() ? props.certificate : null,
      });
    } else if (role === "backend") {
      const name = props.name || node.data.label;
      if (!backendMap.has(name)) {
        backendMap.set(name, {
          name,
          balance: props.balance || "roundrobin",
          mode: props.mode || "http",
          servers: [],
        });
      }
    } else if (role === "server") {
      const backendName = props.backend || "";
      if (!backendName) continue;
      let be = backendMap.get(backendName);
      if (!be) {
        be = {
          name: backendName,
          balance: "roundrobin",
          mode: "http",
          servers: [],
        };
        backendMap.set(backendName, be);
      }
      be.servers.push({
        name: props.name || node.data.label,
        address: props.address || "",
        port: Number(props.port) || 80,
        check: checkFromProp(props.check),
        weight: Number(props.weight) || 100,
        backend: backendName,
      });
    } else if (role === "error-page") {
      error_files.push({
        name: props.name || node.data.label,
        status_code: Number(props.status_code) || 404,
        frontend: props.frontend?.trim() ? props.frontend : null,
      });
    }
  }

  return {
    frontends,
    backends: [...backendMap.values()],
    error_files,
  };
}
