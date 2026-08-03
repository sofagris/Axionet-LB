import { describe, expect, it } from "vitest";
import { validateDesignerGraph } from "./validate";
import type { DesignerNode } from "./types";

describe("validateDesignerGraph", () => {
  it("flags planned catalog nodes as errors", () => {
    const nodes: DesignerNode[] = [
      {
        id: "n1",
        type: "designer",
        position: { x: 0, y: 0 },
        data: {
          kind: "catalog.service",
          label: "dnsdist",
          catalogStatus: "planned",
          comingSoon: true,
        },
      },
    ];
    const issues = validateDesignerGraph({ nodes, edges: [], instances: [], vips: [] });
    expect(issues.some((i) => i.messageKey === "designer.validate.plannedNode")).toBe(true);
  });

  it("flags broken instance refs", () => {
    const nodes: DesignerNode[] = [
      {
        id: "n1",
        type: "designer",
        position: { x: 0, y: 0 },
        data: {
          kind: "instance.ref",
          label: "gone",
          serviceId: "missing",
          serviceType: "haproxy",
        },
      },
    ];
    const issues = validateDesignerGraph({ nodes, edges: [], instances: [], vips: [] });
    expect(issues.some((i) => i.messageKey === "designer.validate.brokenInstance")).toBe(true);
  });
});
