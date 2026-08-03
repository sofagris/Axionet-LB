import type { XYPosition } from "@xyflow/react";
import { newNodeId, type DesignerNode, type DesignerNodeData } from "./types";

const PAD_X = 24;
const PAD_Y = 48;
const PAD_BOTTOM = 24;
const CHILD_W = 200;
const CHILD_H = 88;
const COL_GAP = 24;

function absolutePosition(node: DesignerNode, byId: Map<string, DesignerNode>): XYPosition {
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

  // Groups should render behind children
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

export function groupLayoutMetrics(childCount: number): { width: number; height: number } {
  const width = PAD_X * 2 + childCount * CHILD_W + Math.max(0, childCount - 1) * COL_GAP;
  const height = PAD_Y + CHILD_H + PAD_BOTTOM;
  return { width: Math.max(280, width), height: Math.max(160, height) };
}

export function childRelativePosition(index: number): XYPosition {
  return {
    x: PAD_X + index * (CHILD_W + COL_GAP),
    y: PAD_Y,
  };
}

export { PAD_X, PAD_Y, CHILD_W, CHILD_H, COL_GAP };
