import { describe, expect, it } from "vitest";
import { buildDropGraph } from "./buildDropGraph";
import {
  attachGroupsToMatchingLanes,
  groupSelectedNodes,
  isGroupNode,
  placeDropNodes,
  ungroupNode,
} from "./grouping";
import type { DesignerNode } from "./types";

describe("buildDropGraph", () => {
  it("drops HAProxy parent as a group containing FE/BE/server/error-page", () => {
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
    expect(nodes).toHaveLength(5);
    expect(nodes[0]?.data.kind).toBe("group.frame");
    expect(nodes[0]?.type).toBe("designerGroup");
    const children = nodes.slice(1);
    expect(children.every((n) => n.parentId === nodes[0]?.id)).toBe(true);
    expect(children.map((n) => n.data.componentId)).toEqual([
      "frontend",
      "backend",
      "server",
      "error-page",
    ]);
    expect(children[0]?.data.props?.bind).toBe("*:443");
    expect(children[3]?.data.props?.status_code).toBe("404");
    expect(edges).toHaveLength(3);
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

  it("drops a visual annotation without config fields", () => {
    const { nodes, edges } = buildDropGraph(
      { x: 40, y: 50 },
      {
        source: "visual",
        visualId: "internet-cloud",
        label: "Internet",
      },
    );
    expect(edges).toHaveLength(0);
    expect(nodes).toHaveLength(1);
    expect(nodes[0]?.data).toMatchObject({
      kind: "visual.annotation",
      visualId: "internet-cloud",
      label: "Internet",
    });
    expect(nodes[0]?.data.serviceType).toBeUndefined();
    expect(nodes[0]?.data.serviceId).toBeUndefined();
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

  it("parents a dropped group.frame under a lane hit by flow position", () => {
    const lane: DesignerNode = {
      id: "lane-oslo",
      type: "designerLane",
      position: { x: 0, y: 0 },
      style: { width: 800, height: 400 },
      data: {
        kind: "placement.lane",
        label: "Oslo",
        placementDomainId: "pd-oslo",
        placementDomain: "Oslo",
        placementKind: "site",
      },
    };
    const dropped: DesignerNode[] = [
      {
        id: "g-new",
        type: "designerGroup",
        position: { x: 300, y: 100 },
        style: { width: 280, height: 160 },
        data: { kind: "group.frame", label: "HAProxy", serviceType: "haproxy" },
      },
      {
        id: "fe",
        type: "designer",
        parentId: "g-new",
        extent: "parent",
        position: { x: 24, y: 48 },
        data: { kind: "catalog.component", label: "Frontend", componentRole: "frontend" },
      },
    ];
    const next = placeDropNodes([lane], dropped, { x: 300, y: 100 });
    const group = next.find((n) => n.id === "g-new");
    const child = next.find((n) => n.id === "fe");
    expect(group?.parentId).toBe("lane-oslo");
    expect(group?.extent).toBe("parent");
    expect(group?.data.placementDomainId).toBe("pd-oslo");
    expect(group?.position.x).toBeGreaterThanOrEqual(184);
    // Component stays relative to group, not to lane
    expect(child?.parentId).toBe("g-new");
    expect(child?.position).toEqual({ x: 24, y: 48 });
  });

  it("attachGroupsToMatchingLanes parents free groups into matching lanes", () => {
    const nodes: DesignerNode[] = [
      {
        id: "lane-a",
        type: "designerLane",
        position: { x: 0, y: 0 },
        style: { width: 800, height: 300 },
        data: {
          kind: "placement.lane",
          label: "Oslo",
          placementDomainId: "pd-oslo",
          placementDomain: "Oslo",
        },
      },
      {
        id: "g1",
        type: "designerGroup",
        position: { x: 250, y: 40 },
        style: { width: 280, height: 160 },
        data: {
          kind: "group.frame",
          label: "LB",
          placementDomainId: "pd-oslo",
          placementDomain: "Oslo",
        },
      },
    ];
    const next = attachGroupsToMatchingLanes(nodes);
    const group = next.find((n) => n.id === "g1");
    expect(group?.parentId).toBe("lane-a");
    expect(group?.extent).toBe("parent");
    expect(group!.position.x).toBe(250);
    expect(group!.position.y).toBe(40);
  });
});
