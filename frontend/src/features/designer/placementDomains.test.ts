import { describe, expect, it } from "vitest";
import {
  createLaneNode,
  createPlacementDomain,
  domainForLocalLbSite,
  ensureSiteDomain,
  migratePlacementDomains,
  remapNodesToPlatformDomains,
} from "./placementDomains";
import {
  parseGraphDocument,
  serializeGraphDocument,
  type DesignerNode,
} from "./types";

function group(
  id: string,
  label: string,
  placementDomain?: string,
  placementDomainId?: string,
): DesignerNode {
  return {
    id,
    type: "designerGroup",
    position: { x: 0, y: 0 },
    data: {
      kind: "group.frame",
      label,
      placementDomain,
      placementDomainId,
    },
  };
}

describe("placementDomains registry", () => {
  it("ensures a site domain by name", () => {
    const first = ensureSiteDomain([], "Oslo");
    expect(first.domain.name).toBe("Oslo");
    expect(first.domain.kind).toBe("site");
    const again = ensureSiteDomain(first.domains, "oslo");
    expect(again.domain.id).toBe(first.domain.id);
    expect(again.domains).toHaveLength(1);
  });

  it("migrates legacy free-text placementDomain into registry ids", () => {
    const nodes = [
      group("g1", "lb-oslo", "Oslo"),
      group("g2", "lb-oslo-2", "  Oslo  "),
      group("g3", "shared", "Shared Services"),
      group("g4", "orphan"),
    ];
    const { nodes: migrated, placementDomains } = migratePlacementDomains(nodes);
    expect(placementDomains).toHaveLength(2);
    expect(migrated[0].data.placementDomainId).toBe(migrated[1].data.placementDomainId);
    expect(migrated[0].data.placementDomain).toBe("Oslo");
    expect(migrated[2].data.placementDomain).toBe("Shared Services");
    expect(migrated[2].data.placementDomainId).toBeTruthy();
    expect(migrated[3].data.placementDomainId).toBeUndefined();
  });

  it("createLaneNode does not run ELK — just a lane with domain refs", () => {
    const domain = createPlacementDomain({
      name: "Trondheim",
      kind: "site",
      description: "Site placement: Trondheim",
    });
    const lane = createLaneNode(domain, { x: 10, y: 20 });
    expect(lane.data.kind).toBe("placement.lane");
    expect(lane.data.placementDomainId).toBe(domain.id);
    expect(lane.data.placementDomain).toBe("Trondheim");
    expect(lane.position).toEqual({ x: 10, y: 20 });
    expect(lane.parentId).toBeUndefined();
  });

  it("maps site name to domain via ensureSiteDomain (drop path)", () => {
    const { domains, domain } = ensureSiteDomain([], "Bergen");
    const nodes = [group("g1", "lb-bergen")];
    const assigned = nodes.map((n) => ({
      ...n,
      data: {
        ...n.data,
        placementDomainId: domain.id,
        placementDomain: domain.name,
      },
    }));
    expect(assigned[0].data.placementDomain).toBe("Bergen");
    expect(domains.find((d) => d.id === domain.id)?.kind).toBe("site");
  });

  it("serialize/parse round-trips placementDomains", () => {
    const domain = createPlacementDomain({ name: "Oslo", kind: "site" });
    const serialized = serializeGraphDocument({
      nodes: [createLaneNode(domain, { x: 0, y: 0 })],
      edges: [],
      viewport: { x: 0, y: 0, zoom: 1 },
      placementDomains: [domain],
    });
    const parsed = parseGraphDocument(serialized);
    expect(parsed.placementDomains).toHaveLength(1);
    expect(parsed.placementDomains?.[0].name).toBe("Oslo");
    expect(parsed.nodes[0].data.placementDomainId).toBe(domain.id);
  });

  it("remaps legacy node ids onto platform domains by name", () => {
    const platform = [createPlacementDomain({ id: "pd_platform", name: "Oslo", kind: "site" })];
    const nodes = [
      group("g1", "lb", "Oslo", "pd_legacy"),
      createLaneNode(
        createPlacementDomain({ id: "pd_legacy", name: "Oslo", kind: "site" }),
        { x: 0, y: 0 },
      ),
    ];
    const remapped = remapNodesToPlatformDomains(nodes, platform);
    expect(remapped[0].data.placementDomainId).toBe("pd_platform");
    expect(remapped[1].data.placementDomainId).toBe("pd_platform");
  });

  it("resolves domain for local LB site by name", () => {
    const domains = [
      createPlacementDomain({ name: "Shared Services", kind: "shared" }),
      createPlacementDomain({ name: "Oslo", kind: "site" }),
    ];
    expect(domainForLocalLbSite(domains, { siteName: "oslo" })?.name).toBe("Oslo");
    expect(domainForLocalLbSite(domains, { siteName: null })).toBeUndefined();
  });
});
