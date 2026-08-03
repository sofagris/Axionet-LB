import type { XYPosition } from "@xyflow/react";
import {
  CHILD_H,
  CHILD_W,
  PAD_BOTTOM,
  PAD_X,
  PAD_Y,
  ROW_GAP,
  childRelativePosition,
  groupLayoutMetrics,
  isGroupNode,
} from "./grouping";
import type { DesignerEdge, DesignerNode } from "./types";

export type DesignerLayoutMode = "flow" | "grid" | "stack";

const LAYOUT_MODE_KEY = "ax-lb:designer-layout-mode";
const FLOW_COL_GAP = 48;
const FLOW_ROW_GAP = 28;

const ROLE_COLUMN: Record<string, number> = {
  frontend: 0,
  backend: 1,
  server: 2,
  "error-page": 3,
};

/** Stable identity for matching components across rehydrate (new node ids). */
export function componentLayoutKey(node: DesignerNode): string | null {
  if (node.data.kind !== "catalog.component") return null;
  const role = node.data.componentRole ?? node.data.componentId ?? "component";
  const name = node.data.props?.name ?? node.data.label;
  if (role === "server") {
    const backend = node.data.props?.backend ?? "";
    return `server:${backend}:${name}`;
  }
  return `${role}:${name}`;
}

export function readDesignerLayoutMode(): DesignerLayoutMode {
  if (typeof window === "undefined") return "flow";
  try {
    const raw = window.localStorage.getItem(LAYOUT_MODE_KEY);
    if (raw === "flow" || raw === "grid" || raw === "stack") return raw;
  } catch {
    // ignore
  }
  return "flow";
}

export function writeDesignerLayoutMode(mode: DesignerLayoutMode): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LAYOUT_MODE_KEY, mode);
  } catch {
    // ignore
  }
}

function nodeSize(node: DesignerNode): { w: number; h: number } {
  if (isGroupNode(node)) {
    const w = typeof node.style?.width === "number" ? node.style.width : 280;
    const h = typeof node.style?.height === "number" ? node.style.height : 160;
    return { w, h };
  }
  return { w: CHILD_W, h: CHILD_H };
}

function columnForNode(node: DesignerNode, edges: DesignerEdge[]): number {
  const role = node.data.componentRole;
  if (role && role in ROLE_COLUMN) return ROLE_COLUMN[role];
  // Fall back: sources left, sinks right
  const hasOut = edges.some((e) => e.source === node.id);
  const hasIn = edges.some((e) => e.target === node.id);
  if (hasOut && !hasIn) return 0;
  if (hasIn && !hasOut) return 2;
  if (hasIn && hasOut) return 1;
  return 1;
}

/** Layout a list of sibling nodes (absolute or relative coords). */
export function layoutSiblingNodes(
  siblings: DesignerNode[],
  edges: DesignerEdge[],
  mode: DesignerLayoutMode,
): DesignerNode[] {
  if (siblings.length === 0) return siblings;

  if (mode === "grid") {
    const total = siblings.length;
    return siblings.map((node, index) => ({
      ...node,
      position: childRelativePosition(index, total),
    }));
  }

  if (mode === "stack") {
    return siblings.map((node, index) => ({
      ...node,
      position: {
        x: PAD_X,
        y: PAD_Y + index * (CHILD_H + ROW_GAP),
      },
    }));
  }

  // flow: columns by role / edge topology, stacked within column
  const columns = new Map<number, DesignerNode[]>();
  for (const node of siblings) {
    const col = columnForNode(node, edges);
    const list = columns.get(col) ?? [];
    list.push(node);
    columns.set(col, list);
  }
  const sortedCols = [...columns.keys()].sort((a, b) => a - b);
  const positioned = new Map<string, XYPosition>();
  let x = PAD_X;
  for (const col of sortedCols) {
    const list = columns.get(col) ?? [];
    let y = PAD_Y;
    let colWidth = CHILD_W;
    for (const node of list) {
      const { w, h } = nodeSize(node);
      positioned.set(node.id, { x, y });
      y += h + FLOW_ROW_GAP;
      colWidth = Math.max(colWidth, w);
    }
    x += colWidth + FLOW_COL_GAP;
  }
  return siblings.map((node) => ({
    ...node,
    position: positioned.get(node.id) ?? node.position,
  }));
}

function boundsOf(nodes: DesignerNode[]): {
  maxX: number;
  maxY: number;
} {
  let maxX = PAD_X;
  let maxY = PAD_Y;
  for (const n of nodes) {
    const { w, h } = nodeSize(n);
    maxX = Math.max(maxX, n.position.x + w);
    maxY = Math.max(maxY, n.position.y + h);
  }
  return { maxX, maxY };
}

export function resizeGroupToChildren(
  group: DesignerNode,
  children: DesignerNode[],
): DesignerNode {
  if (children.length === 0) {
    const metrics = groupLayoutMetrics(1);
    return {
      ...group,
      style: { ...group.style, width: metrics.width, height: metrics.height },
    };
  }
  const { maxX, maxY } = boundsOf(children);
  return {
    ...group,
    style: {
      ...group.style,
      width: Math.max(280, maxX + PAD_X),
      height: Math.max(160, maxY + PAD_BOTTOM),
    },
  };
}

/**
 * Apply layout mode to either a selected group (children only) or top-level canvas nodes.
 */
export function applyDesignerAutoLayout(
  nodes: DesignerNode[],
  edges: DesignerEdge[],
  mode: DesignerLayoutMode,
  scopeGroupId: string | null,
): DesignerNode[] {
  if (scopeGroupId) {
    const children = nodes.filter((n) => n.parentId === scopeGroupId);
    const childIds = new Set(children.map((c) => c.id));
    const scopedEdges = edges.filter(
      (e) => childIds.has(e.source) && childIds.has(e.target),
    );
    const laidOut = layoutSiblingNodes(children, scopedEdges, mode);
    const byId = new Map(laidOut.map((n) => [n.id, n]));
    return nodes.map((n) => {
      if (n.id === scopeGroupId) {
        return resizeGroupToChildren(n, laidOut);
      }
      const next = byId.get(n.id);
      return next ?? n;
    });
  }

  const topLevel = nodes.filter((n) => !n.parentId);
  const topIds = new Set(topLevel.map((n) => n.id));
  const scopedEdges = edges.filter(
    (e) => topIds.has(e.source) && topIds.has(e.target),
  );
  const laidOut = layoutSiblingNodes(topLevel, scopedEdges, mode);
  const byId = new Map(laidOut.map((n) => [n.id, n]));
  return nodes.map((n) => byId.get(n.id) ?? n);
}

/** Copy positions from previous children onto newly hydrated ones (stable key). */
export function mergePreservedChildPositions(
  previousChildren: DesignerNode[],
  nextChildren: DesignerNode[],
): DesignerNode[] {
  const posByKey = new Map<string, XYPosition>();
  for (const child of previousChildren) {
    const key = componentLayoutKey(child);
    if (key) posByKey.set(key, { ...child.position });
  }
  return nextChildren.map((child) => {
    const key = componentLayoutKey(child);
    const prev = key ? posByKey.get(key) : undefined;
    return prev ? { ...child, position: prev } : child;
  });
}
