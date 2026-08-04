import type { XYPosition } from "@xyflow/react";
import { newNodeId, type DesignerNode, type DesignerNodeData } from "./types";

const PAD_X = 24;
const PAD_Y = 48;
const PAD_BOTTOM = 24;
const CHILD_W = 200;
const CHILD_H = 88;
const COL_GAP = 24;
const ROW_GAP = 20;
const GRID_COLS = 4;

/** Left rail width — matches DesignerLaneNode `w-[11.5rem]`. */
export const LANE_RAIL_W = 184;
export const LANE_PAD_X = 32;
export const LANE_PAD_Y = 24;
export const LANE_HEADER = 16;
const LANE_CONTENT_ORIGIN_X = LANE_RAIL_W + LANE_PAD_X;

export function absolutePosition(
  node: DesignerNode,
  byId: Map<string, DesignerNode>,
): XYPosition {
  let x = node.position.x;
  let y = node.position.y;
  let parentId = node.parentId;
  while (parentId) {
    const parent = byId.get(parentId);
    if (!parent) break;
    x += parent.position.x;
    y += parent.position.y;
    parentId = parent.parentId;
  }
  return { x, y };
}

export function isGroupNode(node: DesignerNode): boolean {
  return node.data.kind === "group.frame" || node.type === "designerGroup";
}

export function listGroups(allNodes: DesignerNode[]): DesignerNode[] {
  return allNodes.filter(isGroupNode);
}

export function groupSize(group: DesignerNode): { width: number; height: number } {
  return {
    width: Number(
      group.measured?.width ?? group.width ?? group.style?.width ?? 280,
    ),
    height: Number(
      group.measured?.height ?? group.height ?? group.style?.height ?? 160,
    ),
  };
}

export function isLaneNode(node: DesignerNode): boolean {
  return node.data.kind === "placement.lane" || node.type === "designerLane";
}

export function listLanes(allNodes: DesignerNode[]): DesignerNode[] {
  return allNodes.filter(isLaneNode);
}

export function laneSize(lane: DesignerNode): { width: number; height: number } {
  return {
    width: Number(
      lane.measured?.width ?? lane.width ?? lane.style?.width ?? 720,
    ),
    height: Number(
      lane.measured?.height ?? lane.height ?? lane.style?.height ?? 220,
    ),
  };
}

function nodeContainsFlowPos(
  abs: XYPosition,
  size: { width: number; height: number },
  flowPos: XYPosition,
): boolean {
  return (
    flowPos.x >= abs.x &&
    flowPos.x <= abs.x + size.width &&
    flowPos.y >= abs.y &&
    flowPos.y <= abs.y + size.height
  );
}

/** Among overlapping candidates, prefer the tightest bounds (avoids oversized parents stealing hits). */
function pickTightestContaining<T extends DesignerNode>(
  candidates: Array<{ node: T; abs: XYPosition; area: number; cx: number; cy: number }>,
  flowPos: XYPosition,
): T | null {
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => {
    if (a.area !== b.area) return a.area - b.area;
    const da = (flowPos.x - a.cx) ** 2 + (flowPos.y - a.cy) ** 2;
    const db = (flowPos.x - b.cx) ** 2 + (flowPos.y - b.cy) ** 2;
    return da - db;
  });
  return candidates[0]!.node;
}

/** Find the group whose absolute bounds contain the flow position (tightest match). */
export function findGroupAtFlowPosition(
  allNodes: DesignerNode[],
  flowPos: XYPosition,
): DesignerNode | null {
  const byId = new Map(allNodes.map((n) => [n.id, n]));
  const candidates: Array<{
    node: DesignerNode;
    abs: XYPosition;
    area: number;
    cx: number;
    cy: number;
  }> = [];
  for (const g of listGroups(allNodes)) {
    const abs = absolutePosition(g, byId);
    const size = groupSize(g);
    if (!nodeContainsFlowPos(abs, size, flowPos)) continue;
    candidates.push({
      node: g,
      abs,
      area: size.width * size.height,
      cx: abs.x + size.width / 2,
      cy: abs.y + size.height / 2,
    });
  }
  return pickTightestContaining(candidates, flowPos);
}

/** Find the lane whose absolute bounds contain the flow position (tightest match). */
export function findLaneAtFlowPosition(
  allNodes: DesignerNode[],
  flowPos: XYPosition,
): DesignerNode | null {
  const byId = new Map(allNodes.map((n) => [n.id, n]));

  // Prefer the lane that owns the tightest group under the cursor. Oversized
  // sibling lanes often still contain the same flow point and would otherwise win.
  const group = findGroupAtFlowPosition(allNodes, flowPos);
  if (group?.parentId) {
    const parent = byId.get(group.parentId);
    if (parent && isLaneNode(parent)) return parent;
  }

  const candidates: Array<{
    node: DesignerNode;
    abs: XYPosition;
    area: number;
    cx: number;
    cy: number;
  }> = [];
  for (const lane of listLanes(allNodes)) {
    const abs = absolutePosition(lane, byId);
    const size = laneSize(lane);
    if (!nodeContainsFlowPos(abs, size, flowPos)) continue;
    candidates.push({
      node: lane,
      abs,
      area: size.width * size.height,
      cx: abs.x + size.width / 2,
      cy: abs.y + size.height / 2,
    });
  }
  return pickTightestContaining(candidates, flowPos);
}

export function findLaneByDomain(
  allNodes: DesignerNode[],
  domainId?: string | null,
  domainName?: string | null,
): DesignerNode | null {
  const lanes = listLanes(allNodes);
  if (domainId) {
    const byId = lanes.find((l) => l.data.placementDomainId === domainId);
    if (byId) return byId;
  }
  if (domainName) {
    const name = domainName.trim().toLowerCase();
    const byName = lanes.find(
      (l) => (l.data.placementDomain ?? l.data.label).trim().toLowerCase() === name,
    );
    if (byName) return byName;
  }
  return null;
}

function expandLaneStyle(
  lane: DesignerNode,
  rel: XYPosition,
  group: DesignerNode,
): { width: number; height: number } {
  const { width, height } = laneSize(lane);
  const { width: gw, height: gh } = groupSize(group);
  return {
    width: Math.max(width, rel.x + gw + LANE_PAD_X),
    height: Math.max(height, rel.y + gh + PAD_BOTTOM),
  };
}

function expandGroupStyle(
  group: DesignerNode,
  rel: XYPosition,
): { width: number; height: number } {
  const { width, height } = groupSize(group);
  return {
    width: Math.max(width, rel.x + CHILD_W + PAD_X),
    height: Math.max(height, rel.y + CHILD_H + PAD_BOTTOM),
  };
}

/** Attach a free node into a group (relative position). */
export function addNodeToGroup(
  allNodes: DesignerNode[],
  nodeId: string,
  groupId: string,
  preferredRel?: XYPosition,
): DesignerNode[] {
  const group = allNodes.find((n) => n.id === groupId);
  const node = allNodes.find((n) => n.id === nodeId);
  if (!group || !node || !isGroupNode(group) || isGroupNode(node) || isLaneNode(node)) {
    return allNodes;
  }
  if (node.parentId === groupId) return allNodes;

  const byId = new Map(allNodes.map((n) => [n.id, n]));
  const groupAbs = absolutePosition(group, byId);
  let rel = preferredRel;
  if (!rel) {
    if (node.parentId) {
      const abs = absolutePosition(node, byId);
      rel = { x: abs.x - groupAbs.x, y: abs.y - groupAbs.y };
    } else {
      const siblings = allNodes.filter((n) => n.parentId === groupId);
      rel = childRelativePosition(siblings.length, siblings.length + 1);
    }
  }
  rel = {
    x: Math.max(PAD_X, rel.x),
    y: Math.max(PAD_Y, rel.y),
  };
  const size = expandGroupStyle(group, rel);

  return allNodes.map((n) => {
    if (n.id === groupId) {
      return { ...n, style: { ...n.style, width: size.width, height: size.height } };
    }
    if (n.id === nodeId) {
      return {
        ...n,
        parentId: groupId,
        extent: "parent" as const,
        position: rel!,
      };
    }
    return n;
  });
}

/** Detach a child from its group onto the free canvas. */
export function removeNodeFromGroup(
  allNodes: DesignerNode[],
  nodeId: string,
): DesignerNode[] {
  const node = allNodes.find((n) => n.id === nodeId);
  if (!node?.parentId) return allNodes;
  const byId = new Map(allNodes.map((n) => [n.id, n]));
  const abs = absolutePosition(node, byId);
  return allNodes.map((n) => {
    if (n.id !== nodeId) return n;
    return {
      ...n,
      parentId: undefined,
      extent: undefined,
      position: abs,
    };
  });
}

/** Attach a group.frame into a placement.lane (relative position). */
export function addGroupToLane(
  allNodes: DesignerNode[],
  groupId: string,
  laneId: string,
  preferredRel?: XYPosition,
): DesignerNode[] {
  const lane = allNodes.find((n) => n.id === laneId);
  const group = allNodes.find((n) => n.id === groupId);
  if (!lane || !group || !isLaneNode(lane) || !isGroupNode(group)) return allNodes;
  if (group.parentId === laneId && !preferredRel) return allNodes;

  const byId = new Map(allNodes.map((n) => [n.id, n]));
  const laneAbs = absolutePosition(lane, byId);
  let rel = preferredRel;
  if (!rel) {
    const abs = absolutePosition(group, byId);
    rel = { x: abs.x - laneAbs.x, y: abs.y - laneAbs.y };
  }
  rel = {
    x: Math.max(LANE_CONTENT_ORIGIN_X, rel.x),
    y: Math.max(LANE_PAD_Y + LANE_HEADER, rel.y),
  };
  const size = expandLaneStyle(lane, rel, group);
  const domainId = lane.data.placementDomainId;
  const domainName = lane.data.placementDomain ?? lane.data.label;

  const updated = allNodes.map((n) => {
    if (n.id === laneId) {
      return { ...n, style: { ...n.style, width: size.width, height: size.height } };
    }
    if (n.id === groupId) {
      return {
        ...n,
        parentId: laneId,
        extent: "parent" as const,
        position: rel!,
        data: {
          ...n.data,
          placementDomainId: domainId ?? n.data.placementDomainId,
          placementDomain: domainName || n.data.placementDomain,
        },
      };
    }
    return n;
  });
  // React Flow requires parent nodes before children in the array.
  return [...updated.filter(isLaneNode), ...updated.filter((n) => !isLaneNode(n))];
}

/** Detach a group from its lane onto the free canvas (keeps placement domain). */
export function removeGroupFromLane(
  allNodes: DesignerNode[],
  groupId: string,
): DesignerNode[] {
  const group = allNodes.find((n) => n.id === groupId);
  if (!group || !isGroupNode(group) || !group.parentId) return allNodes;
  const byId = new Map(allNodes.map((n) => [n.id, n]));
  const parent = byId.get(group.parentId);
  if (!parent || !isLaneNode(parent)) return allNodes;
  const abs = absolutePosition(group, byId);
  return allNodes.map((n) => {
    if (n.id !== groupId) return n;
    return {
      ...n,
      parentId: undefined,
      extent: undefined,
      position: abs,
    };
  });
}

/**
 * Move a group into the lane matching its placement domain (if any).
 * Detaches from a previous lane first.
 */
export function moveGroupToDomainLane(
  allNodes: DesignerNode[],
  groupId: string,
): DesignerNode[] {
  const group = allNodes.find((n) => n.id === groupId);
  if (!group || !isGroupNode(group)) return allNodes;

  let next = allNodes;
  if (group.parentId) {
    const parent = next.find((n) => n.id === group.parentId);
    if (parent && isLaneNode(parent)) {
      next = removeGroupFromLane(next, groupId);
    }
  }

  const updated = next.find((n) => n.id === groupId) ?? group;
  const lane = findLaneByDomain(
    next,
    updated.data.placementDomainId,
    updated.data.placementDomain,
  );
  if (!lane) return next;
  return addGroupToLane(next, groupId, lane.id);
}

/**
 * Parent free groups into matching lanes (abs → rel). Used when loading older graphs.
 */
export function attachGroupsToMatchingLanes(allNodes: DesignerNode[]): DesignerNode[] {
  const byId = new Map(allNodes.map((n) => [n.id, n]));
  let next = allNodes;
  for (const group of listGroups(allNodes)) {
    if (group.parentId) {
      const parent = byId.get(group.parentId);
      if (parent && isLaneNode(parent)) continue;
    }
    const lane = findLaneByDomain(
      next,
      group.data.placementDomainId,
      group.data.placementDomain,
    );
    if (!lane) continue;
    next = addGroupToLane(next, group.id, lane.id);
  }
  return next;
}

/**
 * If drop lands inside a group, parent non-group drop nodes into it.
 * If drop contains group.frame and lands in a lane, parent groups into that lane.
 */
export function placeDropNodes(
  existing: DesignerNode[],
  dropNodes: DesignerNode[],
  flowPos: XYPosition,
): DesignerNode[] {
  if (dropNodes.length === 0) return existing;

  if (dropNodes.some(isGroupNode)) {
    const lane = findLaneAtFlowPosition(existing, flowPos);
    if (!lane) {
      return [...existing, ...dropNodes];
    }
    let next = [...existing, ...dropNodes];
    const byId = new Map(next.map((n) => [n.id, n]));
    const laneAbs = absolutePosition(lane, byId);
    for (const dropped of dropNodes) {
      if (!isGroupNode(dropped)) continue;
      const base = dropNodes.filter(isGroupNode).length === 1 ? flowPos : dropped.position;
      const rel = {
        x: Math.max(LANE_CONTENT_ORIGIN_X, base.x - laneAbs.x),
        y: Math.max(LANE_PAD_Y + LANE_HEADER, base.y - laneAbs.y),
      };
      next = addGroupToLane(next, dropped.id, lane.id, rel);
    }
    return next;
  }

  const target = findGroupAtFlowPosition(existing, flowPos);
  if (!target) {
    return [...existing, ...dropNodes];
  }

  const byId = new Map(existing.map((n) => [n.id, n]));
  const targetAbs = absolutePosition(target, byId);
  let nextW = groupSize(target).width;
  let nextH = groupSize(target).height;

  const attached = dropNodes.map((dropped) => {
    const base = dropNodes.length === 1 ? flowPos : dropped.position;
    const rel = {
      x: Math.max(PAD_X, base.x - targetAbs.x),
      y: Math.max(PAD_Y, base.y - targetAbs.y),
    };
    nextW = Math.max(nextW, rel.x + CHILD_W + PAD_X);
    nextH = Math.max(nextH, rel.y + CHILD_H + PAD_BOTTOM);
    return {
      ...dropped,
      parentId: target.id,
      extent: "parent" as const,
      position: rel,
    };
  });

  const working = existing.map((n) =>
    n.id === target.id
      ? { ...n, style: { ...n.style, width: nextW, height: nextH } }
      : n,
  );
  return [...working, ...attached];
}

/** Wrap selected nodes in a new group frame (positions converted to relative). */
export function groupSelectedNodes(
  allNodes: DesignerNode[],
  selectedIds: string[],
  label = "Group",
  groupData?: Partial<DesignerNodeData>,
): DesignerNode[] {
  const selected = allNodes.filter(
    (n) => selectedIds.includes(n.id) && !isGroupNode(n) && !n.parentId,
  );
  if (selected.length < 2) return allNodes;

  const byId = new Map(allNodes.map((n) => [n.id, n]));
  const abs = selected.map((n) => ({ node: n, pos: absolutePosition(n, byId) }));
  const minX = Math.min(...abs.map((a) => a.pos.x));
  const minY = Math.min(...abs.map((a) => a.pos.y));
  const maxX = Math.max(...abs.map((a) => a.pos.x + CHILD_W));
  const maxY = Math.max(...abs.map((a) => a.pos.y + CHILD_H));

  const width = Math.max(280, maxX - minX + PAD_X * 2);
  const height = Math.max(160, maxY - minY + PAD_Y + PAD_BOTTOM);
  const groupId = newNodeId();

  const group: DesignerNode = {
    id: groupId,
    type: "designerGroup",
    position: { x: minX - PAD_X, y: minY - PAD_Y },
    style: { width, height },
    zIndex: -1,
    data: {
      kind: "group.frame",
      label,
      ...groupData,
    },
  };

  const selectedSet = new Set(selected.map((n) => n.id));
  const next = allNodes.map((n) => {
    if (!selectedSet.has(n.id)) return n;
    const pos = absolutePosition(n, byId);
    return {
      ...n,
      parentId: groupId,
      extent: "parent" as const,
      position: {
        x: pos.x - (minX - PAD_X),
        y: pos.y - (minY - PAD_Y),
      },
    };
  });

  return [group, ...next];
}

/** Promote children of a group to the canvas and remove the group frame. */
export function ungroupNode(allNodes: DesignerNode[], groupId: string): DesignerNode[] {
  const group = allNodes.find((n) => n.id === groupId);
  if (!group || !isGroupNode(group)) return allNodes;

  const byId = new Map(allNodes.map((n) => [n.id, n]));
  return allNodes
    .filter((n) => n.id !== groupId)
    .map((n) => {
      if (n.parentId !== groupId) return n;
      const abs = absolutePosition(n, byId);
      return {
        ...n,
        parentId: undefined,
        extent: undefined,
        position: abs,
      };
    });
}

/**
 * Remove group frames. When deleteContents is true, also remove all child nodes.
 * When false, children are promoted to the free canvas (ungroup).
 */
export function deleteGroups(
  allNodes: DesignerNode[],
  groupIds: string[],
  deleteContents: boolean,
): { nodes: DesignerNode[]; removedIds: Set<string> } {
  const groupSet = new Set(groupIds);
  const removedIds = new Set<string>();

  if (deleteContents) {
    for (const n of allNodes) {
      if (groupSet.has(n.id) || (n.parentId && groupSet.has(n.parentId))) {
        removedIds.add(n.id);
      }
    }
    return {
      nodes: allNodes.filter((n) => !removedIds.has(n.id)),
      removedIds,
    };
  }

  let next = allNodes;
  for (const gid of groupIds) {
    removedIds.add(gid);
    next = ungroupNode(next, gid);
  }
  return { nodes: next, removedIds };
}

export function groupLayoutMetrics(childCount: number): { width: number; height: number } {
  const cols = Math.min(GRID_COLS, Math.max(1, childCount));
  const rows = Math.max(1, Math.ceil(childCount / cols));
  const width = PAD_X * 2 + cols * CHILD_W + Math.max(0, cols - 1) * COL_GAP;
  const height = PAD_Y + rows * CHILD_H + Math.max(0, rows - 1) * ROW_GAP + PAD_BOTTOM;
  return { width: Math.max(280, width), height: Math.max(160, height) };
}

/** Relative position inside a group; pass total for multi-column grid. */
export function childRelativePosition(index: number, total = index + 1): XYPosition {
  const cols = Math.min(GRID_COLS, Math.max(1, total));
  const col = index % cols;
  const row = Math.floor(index / cols);
  return {
    x: PAD_X + col * (CHILD_W + COL_GAP),
    y: PAD_Y + row * (CHILD_H + ROW_GAP),
  };
}

export { PAD_X, PAD_Y, PAD_BOTTOM, CHILD_W, CHILD_H, COL_GAP, ROW_GAP, GRID_COLS };
