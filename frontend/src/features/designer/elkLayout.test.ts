import { describe, expect, it } from "vitest";
import {
  bucketByPlacementDomain,
  placementDomainOf,
  runElkLayout,
  sortPlacementDomains,
} from "./elkLayout";
import { DEFAULT_LAYOUT_PREFS, UNASSIGNED_DOMAIN } from "./layoutPrefs";
import type { DesignerNode } from "./types";

function group(
  id: string,
  label: string,
  placementDomain?: string,
  pinned?: boolean,
): DesignerNode {
  return {
    id,
    type: "designerGroup",
    position: { x: 0, y: 0 },
    style: { width: 280, height: 160 },
    data: {
      kind: "group.frame",
      label,
      placementDomain,
      pinned,
    },
  };
}

describe("placementDomain helpers", () => {
  it("falls back to Unassigned", () => {
    expect(placementDomainOf(group("g1", "a"))).toBe(UNASSIGNED_DOMAIN);
    expect(placementDomainOf(group("g2", "b", "  Site A  "))).toBe("Site A");
  });

  it("prefers placementDomainId over free-text label", () => {
    const withId: DesignerNode = {
      id: "g",
      type: "designerGroup",
      position: { x: 0, y: 0 },
      data: {
        kind: "group.frame",
        label: "lb",
        placementDomain: "Oslo",
        placementDomainId: "pd_abc",
      },
    };
    expect(placementDomainOf(withId)).toBe("pd_abc");
  });

  it("buckets top-level nodes by placement domain", () => {
    const nodes = [
      group("a", "horizon-a", "Site A"),
      group("b", "horizon-b", "Site B"),
      group("s", "identity", "Shared Services"),
      group("u", "orphan"),
    ];
    const buckets = bucketByPlacementDomain(nodes);
    expect(buckets.get("Site A")?.map((n) => n.id)).toEqual(["a"]);
    expect(buckets.get("Site B")?.map((n) => n.id)).toEqual(["b"]);
    expect(buckets.get("Shared Services")?.map((n) => n.id)).toEqual(["s"]);
    expect(buckets.get(UNASSIGNED_DOMAIN)?.map((n) => n.id)).toEqual(["u"]);
  });

  it("sorts Shared Services toward the middle", () => {
    const sorted = sortPlacementDomains([
      "Site B",
      "Shared Services",
      "Site A",
      UNASSIGNED_DOMAIN,
    ]);
    expect(sorted).toContain("Shared Services");
    const sharedIdx = sorted.indexOf("Shared Services");
    expect(sharedIdx).toBeGreaterThan(0);
    expect(sharedIdx).toBeLessThan(sorted.length - 1);
    expect(sorted[sorted.length - 1]).toBe(UNASSIGNED_DOMAIN);
  });
});

describe("layoutSwimlanes parenting", () => {
  it("sets group.parentId to lane and uses relative positions", async () => {
    const child: DesignerNode = {
      id: "fe",
      type: "designer",
      parentId: "g-oslo",
      extent: "parent",
      position: { x: 24, y: 48 },
      data: { kind: "catalog.component", label: "Frontend", componentRole: "frontend" },
    };
    const gOslo: DesignerNode = {
      ...group("g-oslo", "LB Oslo", "Oslo"),
      data: {
        kind: "group.frame",
        label: "LB Oslo",
        placementDomain: "Oslo",
        placementDomainId: "pd-oslo",
      },
    };
    const gBergen: DesignerNode = {
      ...group("g-bergen", "LB Bergen", "Bergen"),
      data: {
        kind: "group.frame",
        label: "LB Bergen",
        placementDomain: "Bergen",
        placementDomainId: "pd-bergen",
      },
    };

    const next = await runElkLayout({
      nodes: [gOslo, gBergen, child],
      edges: [],
      kind: "swimlanes",
      prefs: { ...DEFAULT_LAYOUT_PREFS, animate: false, preserveGroups: false },
      placementDomains: [
        { id: "pd-oslo", name: "Oslo", kind: "site" },
        { id: "pd-bergen", name: "Bergen", kind: "site" },
      ],
    });

    const laneOslo = next.find(
      (n) => n.data.kind === "placement.lane" && n.data.placementDomainId === "pd-oslo",
    );
    const laneBergen = next.find(
      (n) => n.data.kind === "placement.lane" && n.data.placementDomainId === "pd-bergen",
    );
    const groupOslo = next.find((n) => n.id === "g-oslo");
    const groupBergen = next.find((n) => n.id === "g-bergen");
    const fe = next.find((n) => n.id === "fe");

    expect(laneOslo).toBeTruthy();
    expect(laneBergen).toBeTruthy();
    expect(groupOslo?.parentId).toBe(laneOslo!.id);
    expect(groupOslo?.extent).toBe("parent");
    expect(groupBergen?.parentId).toBe(laneBergen!.id);
    // Relative to lane — not canvas-absolute y stacked far below
    expect(groupOslo!.position.y).toBeLessThan(200);
    expect(groupBergen!.position.y).toBeLessThan(200);
    // Nested component stays under group with original relative pos
    expect(fe?.parentId).toBe("g-oslo");
    expect(fe?.position).toEqual({ x: 24, y: 48 });
  });
});
