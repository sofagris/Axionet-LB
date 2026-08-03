import { describe, expect, it } from "vitest";
import { buildDropGraph } from "./buildDropGraph";

describe("buildDropGraph", () => {
  it("drops HAProxy parent with frontend/backend/server chain", () => {
    const { nodes, edges } = buildDropGraph(
      { x: 10, y: 20 },
      {
        source: "catalog",
        catalogId: "haproxy",
        catalogSlug: "haproxy",
        label: "HAProxy",
        serviceType: "haproxy",
        catalogStatus: "available",
        brand: { monogram: "HA", accent: "traffic" },
        comingSoon: false,
        dropMode: "tree",
      },
    );
    expect(nodes).toHaveLength(4);
    expect(nodes[0]?.data.kind).toBe("catalog.service");
    expect(nodes.slice(1).map((n) => n.data.componentId)).toEqual([
      "frontend",
      "backend",
      "server",
    ]);
    expect(edges.length).toBeGreaterThanOrEqual(3);
    expect(nodes[1]?.position.x).toBeGreaterThan(nodes[0]!.position.x);
  });

  it("drops a single Frontend component", () => {
    const { nodes, edges } = buildDropGraph(
      { x: 0, y: 0 },
      {
        source: "catalog.component",
        catalogId: "haproxy",
        catalogSlug: "haproxy",
        label: "Frontend",
        serviceType: "haproxy",
        catalogStatus: "available",
        brand: { monogram: "HA", accent: "traffic" },
        comingSoon: false,
        componentId: "frontend",
        componentRole: "frontend",
      },
    );
    expect(nodes).toHaveLength(1);
    expect(edges).toHaveLength(0);
    expect(nodes[0]?.data.kind).toBe("catalog.component");
    expect(nodes[0]?.data.componentRole).toBe("frontend");
  });
});
