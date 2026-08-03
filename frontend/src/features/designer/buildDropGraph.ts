import type { XYPosition } from "@xyflow/react";
import { defaultComponentProps } from "./componentProps";
import { childRelativePosition, groupLayoutMetrics } from "./grouping";
import {
  serviceTreeByCatalogId,
  serviceTreeByServiceType,
  type DesignerComponentDef,
  type DesignerServiceTree,
} from "./paletteComponents";
import {
  newEdgeId,
  newNodeId,
  type DesignerEdge,
  type DesignerNode,
  type DesignerNodeData,
  type PaletteDragPayload,
} from "./types";

function parentDataFromCatalog(
  payload: Extract<PaletteDragPayload, { source: "catalog" }>,
): DesignerNodeData {
  return {
    kind: "catalog.service",
    label: payload.label,
    catalogId: payload.catalogId,
    catalogSlug: payload.catalogSlug,
    serviceType: payload.serviceType,
    catalogStatus: payload.catalogStatus,
    brand: payload.brand,
    comingSoon: payload.comingSoon,
  };
}

function componentNodeData(input: {
  component: DesignerComponentDef;
  catalogId: string;
  catalogSlug?: string;
  serviceType?: string;
  brand?: DesignerNodeData["brand"];
  serviceId?: string;
  comingSoon?: boolean;
  catalogStatus?: DesignerNodeData["catalogStatus"];
}): DesignerNodeData {
  return {
    kind: "catalog.component",
    label: input.component.label,
    catalogId: input.catalogId,
    catalogSlug: input.catalogSlug,
    serviceType: input.serviceType,
    serviceId: input.serviceId,
    brand: input.brand,
    comingSoon: input.comingSoon,
    catalogStatus: input.catalogStatus,
    componentId: input.component.id,
    componentRole: input.component.role,
    props: defaultComponentProps(input.component.role),
  };
}

/** Parent drop → group frame containing children (no peer parent service node). */
function layoutTreeAsGroup(
  origin: XYPosition,
  parentData: DesignerNodeData,
  tree: DesignerServiceTree,
  opts?: { serviceId?: string },
): { nodes: DesignerNode[]; edges: DesignerEdge[] } {
  const groupId = newNodeId();
  const { width, height } = groupLayoutMetrics(tree.components.length);
  const group: DesignerNode = {
    id: groupId,
    type: "designerGroup",
    position: origin,
    style: { width, height },
    zIndex: -1,
    data: {
      kind: "group.frame",
      label: parentData.label,
      catalogId: parentData.catalogId ?? tree.catalogId,
      catalogSlug: parentData.catalogSlug,
      serviceType: tree.serviceType ?? parentData.serviceType,
      serviceId: opts?.serviceId ?? parentData.serviceId,
      brand: parentData.brand,
      comingSoon: parentData.comingSoon,
      catalogStatus: parentData.catalogStatus,
    },
  };

  const idByComponent = new Map<string, string>();
  const childNodes: DesignerNode[] = tree.components.map((component, index) => {
    const id = newNodeId();
    idByComponent.set(component.id, id);
    return {
      id,
      type: "designer",
      parentId: groupId,
      extent: "parent",
      position: childRelativePosition(index, tree.components.length),
      data: componentNodeData({
        component,
        catalogId: tree.catalogId,
        catalogSlug: parentData.catalogSlug,
        serviceType: tree.serviceType ?? parentData.serviceType,
        brand: parentData.brand,
        serviceId: opts?.serviceId,
        comingSoon: parentData.comingSoon,
        catalogStatus: parentData.catalogStatus,
      }),
    };
  });

  const edges: DesignerEdge[] = [];
  for (const link of tree.chain) {
    const source = idByComponent.get(link.from);
    const target = idByComponent.get(link.to);
    if (!source || !target) continue;
    edges.push({
      id: newEdgeId(),
      source,
      target,
      label: link.label,
      data: { protocol: link.label ?? "" },
    });
  }

  return { nodes: [group, ...childNodes], edges };
}

function resolveInstanceTree(payload: Extract<PaletteDragPayload, { source: "instance" }>) {
  if (payload.catalogSlug) {
    const bySlug = serviceTreeByCatalogId(payload.catalogSlug);
    if (bySlug) return bySlug;
  }
  if (payload.serviceType) {
    return serviceTreeByServiceType(payload.serviceType);
  }
  return undefined;
}

/** Build nodes/edges for a palette drop at the given flow position. */
export function buildDropGraph(
  position: XYPosition,
  payload: PaletteDragPayload,
): { nodes: DesignerNode[]; edges: DesignerEdge[] } {
  if (payload.source === "catalog") {
    const tree = serviceTreeByCatalogId(payload.catalogId);
    if (payload.dropMode === "tree" && tree) {
      return layoutTreeAsGroup(position, parentDataFromCatalog(payload), tree);
    }
    return {
      nodes: [
        {
          id: newNodeId(),
          type: "designer",
          position,
          data: parentDataFromCatalog(payload),
        },
      ],
      edges: [],
    };
  }

  if (payload.source === "catalog.component") {
    const tree = serviceTreeByCatalogId(payload.catalogId);
    const component =
      tree?.components.find((c) => c.id === payload.componentId) ??
      ({
        id: payload.componentId,
        label: payload.label,
        role: payload.componentRole,
      } satisfies DesignerComponentDef);
    return {
      nodes: [
        {
          id: newNodeId(),
          type: "designer",
          position,
          data: componentNodeData({
            component,
            catalogId: payload.catalogId,
            catalogSlug: payload.catalogSlug,
            serviceType: payload.serviceType,
            brand: payload.brand,
            comingSoon: payload.comingSoon,
            catalogStatus: payload.catalogStatus,
          }),
        },
      ],
      edges: [],
    };
  }

  if (payload.source === "instance") {
    const instanceTree = resolveInstanceTree(payload);
    if (payload.dropMode === "tree" && instanceTree) {
      return layoutTreeAsGroup(
        position,
        {
          kind: "instance.ref",
          label: payload.label,
          serviceId: payload.serviceId,
          serviceType: payload.serviceType,
          catalogSlug: payload.catalogSlug,
          brand: payload.brand,
          catalogId: instanceTree.catalogId,
        },
        instanceTree,
        { serviceId: payload.serviceId },
      );
    }

    return {
      nodes: [
        {
          id: newNodeId(),
          type: "designer",
          position,
          data: {
            kind: "instance.ref",
            label: payload.label,
            serviceId: payload.serviceId,
            serviceType: payload.serviceType,
            catalogSlug: payload.catalogSlug,
            brand: payload.brand,
          },
        },
      ],
      edges: [],
    };
  }

  if (payload.source === "instance.component") {
    return {
      nodes: [
        {
          id: newNodeId(),
          type: "designer",
          position,
          data: {
            kind: "catalog.component",
            label: payload.label,
            catalogId: payload.catalogId,
            catalogSlug: payload.catalogSlug,
            serviceType: payload.serviceType,
            serviceId: payload.serviceId,
            brand: payload.brand,
            componentId: payload.componentId,
            componentRole: payload.componentRole,
            props: defaultComponentProps(payload.componentRole),
          },
        },
      ],
      edges: [],
    };
  }

  return {
    nodes: [
      {
        id: newNodeId(),
        type: "designer",
        position,
        data: {
          kind: "vip.ref",
          label: payload.label,
          vipId: payload.vipId,
          note: payload.address,
        },
      },
    ],
    edges: [],
  };
}
