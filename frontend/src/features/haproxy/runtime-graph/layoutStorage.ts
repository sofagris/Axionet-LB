export type NodePosition = { x: number; y: number };
export type LayoutPositions = Record<string, NodePosition>;

const STORAGE_PREFIX = "ax-lb:runtime-graph-layout:";

type StoredLayout = {
  positions: LayoutPositions;
  updatedAt: string;
};

export function layoutStorageKey(instanceId: string): string {
  return `${STORAGE_PREFIX}${instanceId}`;
}

export function loadLayoutPositions(instanceId: string): LayoutPositions {
  if (!instanceId || typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(layoutStorageKey(instanceId));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as StoredLayout;
    if (!parsed || typeof parsed !== "object" || !parsed.positions) return {};
    const positions: LayoutPositions = {};
    for (const [id, value] of Object.entries(parsed.positions)) {
      if (
        value &&
        typeof value === "object" &&
        typeof (value as NodePosition).x === "number" &&
        typeof (value as NodePosition).y === "number"
      ) {
        positions[id] = { x: (value as NodePosition).x, y: (value as NodePosition).y };
      }
    }
    return positions;
  } catch {
    return {};
  }
}

export function saveLayoutPositions(instanceId: string, positions: LayoutPositions): void {
  if (!instanceId || typeof window === "undefined") return;
  try {
    const payload: StoredLayout = {
      positions,
      updatedAt: new Date().toISOString(),
    };
    window.localStorage.setItem(layoutStorageKey(instanceId), JSON.stringify(payload));
  } catch {
    // ignore quota / private mode
  }
}

export function clearLayoutPositions(instanceId: string): void {
  if (!instanceId || typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(layoutStorageKey(instanceId));
  } catch {
    // ignore
  }
}

export function positionsFromNodes(
  nodes: Array<{ id: string; position: NodePosition }>,
): LayoutPositions {
  const positions: LayoutPositions = {};
  for (const node of nodes) {
    positions[node.id] = { x: node.position.x, y: node.position.y };
  }
  return positions;
}

/** Prefer saved layout, then current in-memory positions, else autolayout. */
export function applyLayoutPositions<T extends { id: string; position: NodePosition }>(
  nodes: T[],
  saved: LayoutPositions,
  previous?: LayoutPositions,
): T[] {
  return nodes.map((node) => {
    const fromSaved = saved[node.id];
    if (fromSaved) return { ...node, position: { ...fromSaved } };
    const fromPrev = previous?.[node.id];
    if (fromPrev) return { ...node, position: { ...fromPrev } };
    return node;
  });
}
