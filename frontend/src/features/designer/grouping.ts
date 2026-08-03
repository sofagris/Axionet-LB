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
    width: Number(group.style?.width ?? group.width ?? 280),
    height: Number(group.style?.height ?? group.height ?? 160),
  };
}

/** Find the topmost group whose bounds contain the flow position. */
export function findGroupAtFlowPosition(
  allNodes: DesignerNode[],
  flowPos: XYPosition,
): DesignerNode | null {
  const groups = listGroups(allNodes);
  for (let i = groups.length - 1; i >= 0; i -= 1) {
    const g = groups[i]!;
    const { width, height } = groupSize(g);
    if (
      flowPos.x >= g.position.x &&
      flowPos.x <= g.position.x + width &&
      flowPos.y >= g.position.y &&
      flowPos.y <= g.position.y + height
    ) {
      return g;
    }
  }
  return null;
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
  if (!group || !node || !isGroupNode(group) || isGroupNode(node)) return allNodes;
  if (node.parentId === groupId) return allNodes;

  const byId = new Map(allNodes.map((n) => [n.id, n]));
  let rel = preferredRel;
  if (!rel) {
    if (node.parentId) {
      const abs = absolutePosition(node, byId);
      rel = { x: abs.x - group.position.x, y: abs.y - group.position.y };
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

/**
 * If drop lands inside a group, parent non-group drop nodes into it.
 * Tree drops (new group frames) are left as-is.
 */
export function placeDropNodes(
  existing: DesignerNode[],
  dropNodes: DesignerNode[],
  flowPos: XYPosition,
): DesignerNode[] {
  if (dropNodes.length === 0) return existing;
  if (dropNodes.some(isGroupNode)) {
    return [...existing, ...dropNodes];
  }
  const target = findGroupAtFlowPosition(existing, flowPos);
  if (!target) {
    return [...existing, ...dropNodes];
  }

  let nextW = groupSize(target).width;
  let nextH = groupSize(target).height;

  const attached = dropNodes.map((dropped) => {
    const base = dropNodes.length === 1 ? flowPos : dropped.position;
    const rel = {
      x: Math.max(PAD_X, base.x - target.position.x),
      y: Math.max(PAD_Y, base.y - target.position.y),
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

export { PAD_X, PAD_Y, CHILD_W, CHILD_H, COL_GAP, ROW_GAP, GRID_COLS };
