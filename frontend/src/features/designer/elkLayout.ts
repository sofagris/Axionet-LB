import ELK, { type ElkNode } from "elkjs/lib/elk.bundled.js";
import type { XYPosition } from "@xyflow/react";
import {
  CHILD_H,
  CHILD_W,
  PAD_BOTTOM,
  PAD_X,
  PAD_Y,
  isGroupNode,
} from "./grouping";
import {
  UNASSIGNED_DOMAIN,
  type DesignerLayoutPrefs,
  type ElkLayoutKind,
} from "./layoutPrefs";
import { newNodeId, type DesignerEdge, type DesignerNode } from "./types";
import { resizeGroupToChildren } from "./autoLayout";

const elk = new ELK();

const LANE_PAD_X = 32;
const LANE_PAD_Y = 48;
const LANE_GAP = 40;
const LANE_HEADER = 36;

export type RunElkLayoutInput = {
  nodes: DesignerNode[];
  edges: DesignerEdge[];
  kind: ElkLayoutKind;
  prefs: DesignerLayoutPrefs;
  /** Hub for star layout; highest-degree fallback if omitted. */
  hubId?: string | null;
  /** When kind is selected, or when scoping to a group. */
  scopeIds?: string[] | null;
  scopeGroupId?: string | null;
};

function nodeSize(node: DesignerNode): { w: number; h: number } {
  if (isGroupNode(node) || node.data.kind === "placement.lane") {
    const w = typeof node.style?.width === "number" ? node.style.width : 280;
    const h = typeof node.style?.height === "number" ? node.style.height : 160;
    return { w, h };
  }
  return { w: CHILD_W, h: CHILD_H };
}

function isLane(node: DesignerNode): boolean {
  return node.data.kind === "placement.lane" || node.type === "designerLane";
}

function isMovable(
  node: DesignerNode,
  prefs: DesignerLayoutPrefs,
): boolean {
  if (isLane(node)) return false;
  if (prefs.preservePinned && node.data.pinned) return false;
  return true;
}

function elkOptionsForKind(kind: ElkLayoutKind): Record<string, string> {
  const base = {
    "elk.padding": "[top=24,left=24,bottom=24,right=24]",
    "elk.separateConnectedComponents": "true",
  };
  switch (kind) {
    case "process":
      return {
        ...base,
        "elk.algorithm": "layered",
        "elk.direction": "DOWN",
        "elk.spacing.nodeNode": "48",
        "elk.layered.spacing.nodeNodeBetweenLayers": "64",
      };
    case "tree":
      return {
        ...base,
        "elk.algorithm": "mrtree",
        "elk.direction": "DOWN",
        "elk.spacing.nodeNode": "40",
      };
    case "star":
      return {
        ...base,
        "elk.algorithm": "force",
        "elk.force.iterations": "500",
        "elk.spacing.nodeNode": "56",
      };
    case "compact":
      return {
        ...base,
        "elk.algorithm": "layered",
        "elk.direction": "RIGHT",
        "elk.spacing.nodeNode": "24",
        "elk.layered.spacing.nodeNodeBetweenLayers": "36",
        "elk.padding": "[top=12,left=12,bottom=12,right=12]",
      };
    case "traffic":
    case "swimlanes":
    case "selected":
    default:
      return {
        ...base,
        "elk.algorithm": "layered",
        "elk.direction": "RIGHT",
        "elk.spacing.nodeNode": "48",
        "elk.layered.spacing.nodeNodeBetweenLayers": "72",
      };
  }
}

async function layoutFlat(
  siblings: DesignerNode[],
  edges: DesignerEdge[],
  kind: ElkLayoutKind,
  prefs: DesignerLayoutPrefs,
): Promise<Map<string, XYPosition>> {
  const movable = siblings.filter((n) => isMovable(n, prefs));
  const positions = new Map<string, XYPosition>();
  for (const n of siblings) {
    if (!isMovable(n, prefs)) {
      positions.set(n.id, { ...n.position });
    }
  }
  if (movable.length === 0) return positions;

  const ids = new Set(movable.map((n) => n.id));
  const graph: ElkNode = {
    id: "root",
    layoutOptions: elkOptionsForKind(kind),
    children: movable.map((n) => {
      const { w, h } = nodeSize(n);
      return {
        id: n.id,
        width: w,
        height: h,
        ...(prefs.preservePinned && n.data.pinned
          ? {
              layoutOptions: {
                "elk.fixed": "true",
              },
              x: n.position.x,
              y: n.position.y,
            }
          : {}),
      };
    }),
    edges: edges
      .filter((e) => ids.has(e.source) && ids.has(e.target))
      .map((e) => ({
        id: e.id,
        sources: [e.source],
        targets: [e.target],
      })),
  };

  const result = await elk.layout(graph);
  for (const child of result.children ?? []) {
    if (typeof child.x === "number" && typeof child.y === "number") {
      positions.set(child.id, { x: child.x, y: child.y });
    }
  }
  return positions;
}

function degreeMap(edges: DesignerEdge[], ids: Set<string>): Map<string, number> {
  const deg = new Map<string, number>();
  for (const id of ids) deg.set(id, 0);
  for (const e of edges) {
    if (ids.has(e.source)) deg.set(e.source, (deg.get(e.source) ?? 0) + 1);
    if (ids.has(e.target)) deg.set(e.target, (deg.get(e.target) ?? 0) + 1);
  }
  return deg;
}

/** Radial star around hub — used when force would be chaotic for small graphs. */
function radialStar(
  siblings: DesignerNode[],
  hubId: string,
  prefs: DesignerLayoutPrefs,
): Map<string, XYPosition> {
  const positions = new Map<string, XYPosition>();
  const hub = siblings.find((n) => n.id === hubId) ?? siblings[0];
  if (!hub) return positions;
  const others = siblings.filter((n) => n.id !== hub.id);
  const hubPos = { x: 400, y: 280 };
  if (isMovable(hub, prefs)) positions.set(hub.id, hubPos);
  else positions.set(hub.id, { ...hub.position });

  const radius = 220 + Math.max(0, others.length - 4) * 20;
  others.forEach((n, i) => {
    if (!isMovable(n, prefs)) {
      positions.set(n.id, { ...n.position });
      return;
    }
    const angle = (2 * Math.PI * i) / Math.max(1, others.length) - Math.PI / 2;
    positions.set(n.id, {
      x: hubPos.x + Math.cos(angle) * radius,
      y: hubPos.y + Math.sin(angle) * radius,
    });
  });
  return positions;
}

export function placementDomainOf(node: DesignerNode): string {
  const raw = node.data.placementDomain?.trim();
  return raw && raw.length > 0 ? raw : UNASSIGNED_DOMAIN;
}

/** Sort lanes: Shared Services in the middle when present; else alphabetical. */
export function sortPlacementDomains(domains: string[]): string[] {
  const unique = [...new Set(domains)];
  const shared = unique.filter((d) => /shared/i.test(d));
  const rest = unique.filter((d) => !/shared/i.test(d)).sort((a, b) => {
    if (a === UNASSIGNED_DOMAIN) return 1;
    if (b === UNASSIGNED_DOMAIN) return -1;
    return a.localeCompare(b);
  });
  if (shared.length === 0) return rest;
  const mid = Math.floor(rest.length / 2);
  return [...rest.slice(0, mid), ...shared.sort(), ...rest.slice(mid)];
}

export function bucketByPlacementDomain(
  topLevel: DesignerNode[],
): Map<string, DesignerNode[]> {
  const map = new Map<string, DesignerNode[]>();
  for (const n of topLevel) {
    if (isLane(n)) continue;
    const domain = placementDomainOf(n);
    const list = map.get(domain) ?? [];
    list.push(n);
    map.set(domain, list);
  }
  return map;
}

function applyPositions(
  nodes: DesignerNode[],
  positions: Map<string, XYPosition>,
  prefs: DesignerLayoutPrefs,
): DesignerNode[] {
  return nodes.map((n) => {
    const pos = positions.get(n.id);
    if (!pos) return n;
    if (!isMovable(n, prefs)) return n;
    return { ...n, position: pos };
  });
}

async function layoutGroupChildren(
  nodes: DesignerNode[],
  edges: DesignerEdge[],
  groupId: string,
  prefs: DesignerLayoutPrefs,
): Promise<DesignerNode[]> {
  const children = nodes.filter((n) => n.parentId === groupId);
  if (children.length === 0) return nodes;
  const childIds = new Set(children.map((c) => c.id));
  const scopedEdges = edges.filter(
    (e) => childIds.has(e.source) && childIds.has(e.target),
  );
  const positions = await layoutFlat(children, scopedEdges, "traffic", prefs);
  let next = applyPositions(nodes, positions, prefs);
  const laidChildren = next.filter((n) => n.parentId === groupId);
  next = next.map((n) =>
    n.id === groupId ? resizeGroupToChildren(n, laidChildren) : n,
  );
  return next;
}

/**
 * Run ELK (or radial star / swimlanes) and return updated nodes.
 * Removes previous placement.lane nodes and recreates them for swimlanes.
 */
export async function runElkLayout(input: RunElkLayoutInput): Promise<DesignerNode[]> {
  const { edges, kind, prefs, hubId, scopeGroupId } = input;
  let nodes = input.nodes.filter((n) => !isLane(n));

  // Scope: selected nodes only
  if (kind === "selected" && input.scopeIds && input.scopeIds.length > 0) {
    const scope = new Set(input.scopeIds);
    const siblings = nodes.filter((n) => scope.has(n.id) && !n.parentId);
    const positions = await layoutFlat(siblings, edges, "traffic", prefs);
    return applyPositions(nodes, positions, prefs);
  }

  // Scope: selected group → children only
  if (scopeGroupId) {
    return layoutGroupChildren(nodes, edges, scopeGroupId, prefs);
  }

  if (kind === "swimlanes") {
    return layoutSwimlanes(nodes, edges, prefs);
  }

  const topLevel = nodes.filter((n) => !n.parentId);
  const topIds = new Set(topLevel.map((n) => n.id));

  let positions: Map<string, XYPosition>;
  if (kind === "star") {
    const deg = degreeMap(
      edges.filter((e) => topIds.has(e.source) && topIds.has(e.target)),
      topIds,
    );
    let hub = hubId && topIds.has(hubId) ? hubId : null;
    if (!hub) {
      let best = 0;
      for (const [id, d] of deg) {
        if (d >= best) {
          best = d;
          hub = id;
        }
      }
      hub = hub ?? topLevel[0]?.id ?? null;
    }
    positions = hub
      ? radialStar(topLevel, hub, prefs)
      : await layoutFlat(topLevel, edges, "traffic", prefs);
  } else {
    positions = await layoutFlat(topLevel, edges, kind, prefs);
  }

  let next = applyPositions(nodes, positions, prefs);

  if (prefs.preserveGroups) {
    const groups = next.filter((n) => isGroupNode(n));
    for (const g of groups) {
      next = await layoutGroupChildren(next, edges, g.id, prefs);
    }
  }

  return next;
}

async function layoutSwimlanes(
  nodes: DesignerNode[],
  edges: DesignerEdge[],
  prefs: DesignerLayoutPrefs,
): Promise<DesignerNode[]> {
  const topLevel = nodes.filter((n) => !n.parentId);
  const buckets = bucketByPlacementDomain(topLevel);
  const domains = sortPlacementDomains([...buckets.keys()]);

  const laneNodes: DesignerNode[] = [];
  const positions = new Map<string, XYPosition>();
  let yOffset = 0;

  for (const domain of domains) {
    const members = buckets.get(domain) ?? [];
    if (members.length === 0) continue;

    const memberPositions = await layoutFlat(members, edges, "traffic", prefs);
    let maxX = 0;
    let maxY = 0;
    for (const m of members) {
      const local = memberPositions.get(m.id) ?? m.position;
      const { w, h } = nodeSize(m);
      const abs = {
        x: LANE_PAD_X + local.x,
        y: yOffset + LANE_PAD_Y + LANE_HEADER + local.y,
      };
      if (isMovable(m, prefs)) positions.set(m.id, abs);
      else positions.set(m.id, { ...m.position });
      maxX = Math.max(maxX, local.x + w);
      maxY = Math.max(maxY, local.y + h);
    }

    const laneW = Math.max(480, maxX + LANE_PAD_X * 2);
    const laneH = Math.max(180, maxY + LANE_PAD_Y + LANE_HEADER + PAD_BOTTOM);
    laneNodes.push({
      id: newNodeId(),
      type: "designerLane",
      position: { x: 0, y: yOffset },
      style: { width: laneW, height: laneH },
      zIndex: -10,
      selectable: false,
      draggable: false,
      data: {
        kind: "placement.lane",
        label: domain,
        placementDomain: domain,
      },
    });
    yOffset += laneH + LANE_GAP;
  }

  let next = [...laneNodes, ...applyPositions(nodes, positions, prefs)];

  if (prefs.preserveGroups) {
    for (const g of next.filter((n) => isGroupNode(n))) {
      next = await layoutGroupChildren(next, edges, g.id, prefs);
    }
  }

  return next;
}

/** Interpolate positions for animate preference (sync helper for caller). */
export function interpolatePositions(
  from: DesignerNode[],
  to: DesignerNode[],
  t: number,
): DesignerNode[] {
  const fromMap = new Map(from.map((n) => [n.id, n.position]));
  return to.map((n) => {
    const prev = fromMap.get(n.id);
    if (!prev) return n;
    return {
      ...n,
      position: {
        x: prev.x + (n.position.x - prev.x) * t,
        y: prev.y + (n.position.y - prev.y) * t,
      },
    };
  });
}

export { PAD_X, PAD_Y, CHILD_W, CHILD_H };
