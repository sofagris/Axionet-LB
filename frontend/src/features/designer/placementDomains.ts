import {
  newNodeId,
  type DesignerNode,
  type DesignerNodeData,
  type PlacementDomain,
  type PlacementDomainKind,
} from "./types";

export type { PlacementDomain, PlacementDomainKind, PlacementDomainIcon } from "./types";

export const DEFAULT_SITE_SUGGESTIONS = ["Oslo", "Bergen", "Trondheim"] as const;

function shortId(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === "function") {
    return c.randomUUID().slice(0, 8);
  }
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export function newPlacementDomainId(): string {
  return `pd_${shortId()}`;
}

export function createPlacementDomain(
  partial: Omit<PlacementDomain, "id"> & { id?: string },
): PlacementDomain {
  return {
    id: partial.id ?? newPlacementDomainId(),
    name: partial.name.trim(),
    kind: partial.kind,
    description: partial.description?.trim() || undefined,
    icon: partial.icon ?? (partial.kind === "shared" ? "shared" : "site"),
  };
}

export function findDomainByName(
  domains: PlacementDomain[],
  name: string,
): PlacementDomain | undefined {
  const n = name.trim().toLowerCase();
  return domains.find((d) => d.name.trim().toLowerCase() === n);
}

export function findDomainById(
  domains: PlacementDomain[],
  id: string | undefined,
): PlacementDomain | undefined {
  if (!id) return undefined;
  return domains.find((d) => d.id === id);
}

/** Placement domains that do not yet have a lane on the canvas. */
export function domainsWithoutLane(
  domains: PlacementDomain[],
  nodes: DesignerNode[],
): PlacementDomain[] {
  const used = new Set(
    nodes
      .filter((n) => n.data.kind === "placement.lane")
      .map((n) => n.data.placementDomainId)
      .filter((id): id is string => Boolean(id)),
  );
  const usedNames = new Set(
    nodes
      .filter((n) => n.data.kind === "placement.lane")
      .map((n) => (n.data.placementDomain ?? n.data.label).trim().toLowerCase())
      .filter(Boolean),
  );
  return domains.filter((d) => {
    if (used.has(d.id)) return false;
    if (usedNames.has(d.name.trim().toLowerCase())) return false;
    return true;
  });
}

/** Ensure a domain exists for a site name; returns updated list + domain. */
export function ensureSiteDomain(
  domains: PlacementDomain[],
  siteName: string,
): { domains: PlacementDomain[]; domain: PlacementDomain } {
  const existing = findDomainByName(domains, siteName);
  if (existing) return { domains, domain: existing };
  const domain = createPlacementDomain({
    name: siteName.trim(),
    kind: /shared/i.test(siteName) ? "shared" : "site",
    description: /shared/i.test(siteName)
      ? "Shared platform services"
      : `Site placement: ${siteName.trim()}`,
  });
  return { domains: [...domains, domain], domain };
}

/**
 * Migrate legacy free-text placementDomain on nodes into registry + placementDomainId.
 */
export function migratePlacementDomains(
  nodes: DesignerNode[],
  existing: PlacementDomain[] = [],
): { nodes: DesignerNode[]; placementDomains: PlacementDomain[] } {
  let domains = [...existing];
  const nodesOut = nodes.map((node) => {
    const data = node.data;
    if (data.placementDomainId && findDomainById(domains, data.placementDomainId)) {
      const d = findDomainById(domains, data.placementDomainId)!;
      return {
        ...node,
        data: { ...data, placementDomain: d.name, placementDomainId: d.id },
      };
    }
    const legacy = data.placementDomain?.trim();
    if (!legacy) return node;
    const ensured = ensureSiteDomain(domains, legacy);
    domains = ensured.domains;
    return {
      ...node,
      data: {
        ...data,
        placementDomainId: ensured.domain.id,
        placementDomain: ensured.domain.name,
      },
    };
  });
  return { nodes: nodesOut, placementDomains: domains };
}

export function createLaneNode(
  domain: PlacementDomain,
  position: { x: number; y: number },
  size?: { width: number; height: number },
): DesignerNode {
  return {
    id: newNodeId(),
    type: "designerLane",
    position,
    style: {
      width: size?.width ?? 720,
      height: size?.height ?? 220,
    },
    zIndex: -10,
    selectable: true,
    draggable: true,
    data: {
      kind: "placement.lane",
      label: domain.name,
      placementDomainId: domain.id,
      placementDomain: domain.name,
      placementKind: domain.kind,
      placementDescription: domain.description,
      placementIcon: domain.icon,
    } satisfies DesignerNodeData,
  };
}

export function syncLaneDataFromDomain(
  node: DesignerNode,
  domain: PlacementDomain,
): DesignerNode {
  return {
    ...node,
    data: {
      ...node.data,
      label: domain.name,
      placementDomainId: domain.id,
      placementDomain: domain.name,
      placementKind: domain.kind,
      placementDescription: domain.description,
      placementIcon: domain.icon,
    },
  };
}

export function updateDomainInRegistry(
  domains: PlacementDomain[],
  id: string,
  patch: Partial<Omit<PlacementDomain, "id">>,
): PlacementDomain[] {
  return domains.map((d) => {
    if (d.id !== id) return d;
    return {
      ...d,
      name: patch.name?.trim() ?? d.name,
      kind: patch.kind ?? d.kind,
      description:
        patch.description !== undefined
          ? patch.description.trim() || undefined
          : d.description,
      icon: patch.icon ?? d.icon,
    };
  });
}

/** Apply registry name/kind changes onto all nodes referencing the domain. */
export function syncNodesToDomain(
  nodes: DesignerNode[],
  domain: PlacementDomain,
): DesignerNode[] {
  return nodes.map((n) => {
    if (n.data.placementDomainId !== domain.id) return n;
    if (n.data.kind === "placement.lane") {
      return syncLaneDataFromDomain(n, domain);
    }
    return {
      ...n,
      data: {
        ...n.data,
        placementDomain: domain.name,
        placementDomainId: domain.id,
      },
    };
  });
}

/** Map a platform API placement-domain row into Designer registry shape. */
export function fromPlatformRecord(row: {
  id: string;
  name: string;
  kind: string;
  description?: string | null;
  icon?: string | null;
}): PlacementDomain {
  const kind: PlacementDomainKind = row.kind === "shared" ? "shared" : "site";
  const icon = row.icon;
  return {
    id: row.id,
    name: row.name,
    kind,
    description: row.description ?? undefined,
    icon:
      icon === "site" || icon === "shared" || icon === "building" ? icon : undefined,
  };
}

/**
 * Remap node placementDomainId values onto platform domains (match by id, then by name).
 */
export function remapNodesToPlatformDomains(
  nodes: DesignerNode[],
  platform: PlacementDomain[],
): DesignerNode[] {
  const byId = new Map(platform.map((d) => [d.id, d]));
  const byName = new Map(platform.map((d) => [d.name.trim().toLowerCase(), d]));
  return nodes.map((node) => {
    const data = node.data;
    if (data.placementDomainId && byId.has(data.placementDomainId)) {
      const d = byId.get(data.placementDomainId)!;
      if (data.kind === "placement.lane") {
        return syncLaneDataFromDomain(node, d);
      }
      return {
        ...node,
        data: { ...data, placementDomainId: d.id, placementDomain: d.name },
      };
    }
    const label = data.placementDomain?.trim();
    if (!label) return node;
    const d = byName.get(label.toLowerCase());
    if (!d) return node;
    if (data.kind === "placement.lane") {
      return syncLaneDataFromDomain(node, d);
    }
    return {
      ...node,
      data: { ...data, placementDomainId: d.id, placementDomain: d.name },
    };
  });
}

/** Pick a site-kind placement domain for the local LB's site. */
export function domainForLocalLbSite(
  domains: PlacementDomain[],
  opts: { siteId?: string | null; siteName?: string | null },
): PlacementDomain | undefined {
  if (opts.siteId) {
    // Prefer domains linked via platform site_id — callers pass pre-filtered list
    // or we match by name below. Designer domains may not carry site_id; match name.
  }
  const name = opts.siteName?.trim();
  if (!name) return undefined;
  return (
    domains.find((d) => d.kind === "site" && d.name.trim().toLowerCase() === name.toLowerCase()) ??
    domains.find((d) => d.name.trim().toLowerCase() === name.toLowerCase())
  );
}
