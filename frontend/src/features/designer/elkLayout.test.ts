import { describe, expect, it } from "vitest";
import {
  bucketByPlacementDomain,
  placementDomainOf,
  sortPlacementDomains,
} from "./elkLayout";
import { UNASSIGNED_DOMAIN } from "./layoutPrefs";
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
