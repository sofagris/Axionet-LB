import {
  fetchHaproxyAcls,
  fetchHaproxyBackends,
  fetchHaproxyErrorFiles,
  fetchHaproxyFrontends,
} from "../../api/haproxy";
import type { CatalogBrand } from "../catalog/catalogTypes";
import {
  fingerprintHaproxyConfig,
  type HaproxyConfigSnapshot,
} from "./haproxyConfigFingerprint";
import { applyHydratedGroup, hydrateHaproxyGraph } from "./haproxyGraphMapper";
import { designerCapabilities } from "./serviceCapabilities";
import type { DesignerEdge, DesignerNode } from "./types";

export type LinkedHaproxyGroup = {
  groupId: string;
  serviceId: string;
  label: string;
  catalogSlug?: string;
  brand?: CatalogBrand;
};

/** Linked groups whose service adapter supports live sync (manifest hydrate: poll). */
export function linkedHaproxyGroups(nodes: DesignerNode[]): LinkedHaproxyGroup[] {
  const out: LinkedHaproxyGroup[] = [];
  for (const n of nodes) {
    if (n.data.kind !== "group.frame") continue;
    if (!n.data.serviceId || !n.data.serviceType) continue;
    if (!designerCapabilities(n.data.serviceType).canLiveSync) continue;
    out.push({
      groupId: n.id,
      serviceId: n.data.serviceId,
      label: n.data.label,
      catalogSlug: n.data.catalogSlug,
      brand: n.data.brand,
    });
  }
  return out;
}

export async function fetchHaproxyConfigSnapshot(
  serviceId: string,
): Promise<HaproxyConfigSnapshot> {
  const [frontends, backends, errorFiles, acls] = await Promise.all([
    fetchHaproxyFrontends(serviceId),
    fetchHaproxyBackends(serviceId),
    fetchHaproxyErrorFiles(serviceId),
    fetchHaproxyAcls(serviceId),
  ]);
  return { frontends, backends, errorFiles, acls };
}

/**
 * Replace a group's children with a hydrated subgraph from a live config snapshot.
 * Returns null if the group is no longer on the canvas.
 */
export function applySnapshotToGroup(
  nodes: DesignerNode[],
  edges: DesignerEdge[],
  link: LinkedHaproxyGroup,
  snapshot: HaproxyConfigSnapshot,
): { nodes: DesignerNode[]; edges: DesignerEdge[]; fingerprint: string } | null {
  const group = nodes.find((n) => n.id === link.groupId);
  if (!group) return null;
  const hydrated = hydrateHaproxyGraph({
    serviceId: link.serviceId,
    groupId: link.groupId,
    groupPosition: group.position,
    label: link.label,
    catalogSlug: link.catalogSlug ?? group.data.catalogSlug,
    brand: link.brand ?? group.data.brand,
    frontends: snapshot.frontends,
    backends: snapshot.backends,
    errorFiles: snapshot.errorFiles,
    acls: snapshot.acls,
  });
  const result = applyHydratedGroup(nodes, edges, link.groupId, hydrated);
  return {
    ...result,
    fingerprint: fingerprintHaproxyConfig(snapshot),
  };
}

export function setGroupHydrating(
  nodes: DesignerNode[],
  groupId: string,
  hydrating: boolean,
): DesignerNode[] {
  return nodes.map((n) =>
    n.id === groupId ? { ...n, data: { ...n.data, hydrating } } : n,
  );
}
