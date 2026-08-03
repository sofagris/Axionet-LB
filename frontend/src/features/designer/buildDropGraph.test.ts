import { describe, expect, it } from "vitest";
import { buildDropGraph } from "./buildDropGraph";
import {
  groupSelectedNodes,
  isGroupNode,
  placeDropNodes,
  ungroupNode,
} from "./grouping";
import type { DesignerNode } from "./types";

describe("buildDropGraph", () => {
  it("drops HAProxy parent as a group containing FE/BE/server", () => {
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
    expect(nodes[0]?.data.kind).toBe("group.frame");
    expect(nodes[0]?.type).toBe("designerGroup");
    const children = nodes.slice(1);
    expect(children.every((n) => n.parentId === nodes[0]?.id)).toBe(true);
    expect(children.map((n) => n.data.componentId)).toEqual([
      "frontend",
      "backend",
      "server",
    ]);
    expect(children[0]?.data.props?.bind).toBe("*:443");
    expect(edges).toHaveLength(2);
  });

  it("drops a single Frontend component with default props", () => {
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
    expect(nodes[0]?.data.props?.mode).toBe("http");
  });
});

describe("grouping", () => {
  it("groups and ungroups free nodes", () => {
    const nodes: DesignerNode[] = [
      {
        id: "a",
        type: "designer",
        position: { x: 0, y: 0 },
        data: { kind: "catalog.component", label: "A", componentRole: "frontend" },
      },
      {
        id: "b",
        type: "designer",
        position: { x: 240, y: 0 },
        data: { kind: "catalog.component", label: "B", componentRole: "backend" },
      },
    ];
    const grouped = groupSelectedNodes(nodes, ["a", "b"], "Bundle");
    const group = grouped.find((n) => isGroupNode(n));
    expect(group?.data.label).toBe("Bundle");
    expect(grouped.filter((n) => n.parentId === group?.id)).toHaveLength(2);
    const flat = ungroupNode(grouped, group!.id);
    expect(flat.find((n) => isGroupNode(n))).toBeUndefined();
    expect(flat).toHaveLength(2);
    expect(flat.every((n) => !n.parentId)).toBe(true);
  });

  it("places a dropped server inside an existing group", () => {
    const existing: DesignerNode[] = [
      {
        id: "g1",
        type: "designerGroup",
        position: { x: 0, y: 0 },
        style: { width: 700, height: 200 },
        data: { kind: "group.frame", label: "HAProxy", serviceType: "haproxy" },
      },
    ];
    const dropped: DesignerNode[] = [
      {
        id: "s1",
        type: "designer",
        position: { x: 100, y: 80 },
        data: {
          kind: "catalog.component",
          label: "Server",
          componentId: "server",
          componentRole: "server",
        },
      },
    ];
    const next = placeDropNodes(existing, dropped, { x: 100, y: 80 });
    const server = next.find((n) => n.id === "s1");
    expect(server?.parentId).toBe("g1");
    expect(server?.position.x).toBeGreaterThanOrEqual(24);
  });
});
