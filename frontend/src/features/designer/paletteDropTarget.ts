import type { XYPosition } from "@xyflow/react";
import {
  serviceTreeByCatalogId,
  serviceTreeByServiceType,
} from "./paletteComponents";
import { findGroupAtFlowPosition, findLaneAtFlowPosition } from "./grouping";
import type { DesignerNode, PaletteDragPayload } from "./types";

export type PaletteDropTarget = {
  id: string;
  kind: "lane" | "group";
};

/** True when this palette payload becomes a group.frame (parents into a lane). */
export function paletteDropCreatesGroup(payload: PaletteDragPayload): boolean {
  if (payload.source === "catalog" && payload.dropMode === "tree") {
    return Boolean(serviceTreeByCatalogId(payload.catalogId));
  }
  if (payload.source === "instance" && (payload.dropMode ?? "tree") === "tree") {
    if (payload.catalogSlug && serviceTreeByCatalogId(payload.catalogSlug)) return true;
    if (payload.serviceType && serviceTreeByServiceType(payload.serviceType)) return true;
  }
  return false;
}

/**
 * Which lane/group would receive the drop at flowPos — mirrors placeDropNodes.
 * Tree/group drops → lane; everything else → group.
 */
export function resolvePaletteDropTarget(
  nodes: DesignerNode[],
  flowPos: XYPosition,
  payload: PaletteDragPayload,
): PaletteDropTarget | null {
  if (paletteDropCreatesGroup(payload)) {
    const lane = findLaneAtFlowPosition(nodes, flowPos);
    return lane ? { id: lane.id, kind: "lane" } : null;
  }
  const group = findGroupAtFlowPosition(nodes, flowPos);
  return group ? { id: group.id, kind: "group" } : null;
}
