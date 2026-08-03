import { describe, expect, it } from "vitest";
import {
  applyDesignerAutoLayout,
  componentLayoutKey,
  layoutSiblingNodes,
  mergePreservedChildPositions,
} from "./autoLayout";
import type { DesignerEdge, DesignerNode } from "./types";

function node(
  id: string,
  partial: Partial<DesignerNode> & { data: DesignerNode["data"] },
): DesignerNode {
  return {
    id,
    type: "designer",
    position: { x: 0, y: 0 },
    ...partial,
  };
}

describe("componentLayoutKey", () => {
  it("includes backend for servers", () => {
    expect(
      componentLayoutKey(
        node("s", {
          data: {
            kind: "catalog.component",
            label: "s1",
            componentRole: "server",
            props: { name: "s1", backend: "app" },
          },
        }),
      ),
    ).toBe("server:app:s1");
  });
});

describe("layoutSiblingNodes", () => {
  it("places frontends left of backends in flow mode", () => {
    const siblings = [
      node("fe", {
        data: {
          kind: "catalog.component",
          label: "web",
          componentRole: "frontend",
          props: { name: "web" },
        },
      }),
      node("be", {
        data: {
          kind: "catalog.component",
          label: "app",
          componentRole: "backend",
          props: { name: "app" },
        },
      }),
    ];
    const edges: DesignerEdge[] = [
      { id: "e1", source: "fe", target: "be", data: { protocol: "default_backend" } },
    ];
    const laid = layoutSiblingNodes(siblings, edges, "flow");
    const fe = laid.find((n) => n.id === "fe")!;
    const be = laid.find((n) => n.id === "be")!;
    expect(fe.position.x).toBeLessThan(be.position.x);
  });

  it("stacks vertically in stack mode", () => {
    const siblings = [
      node("a", { data: { kind: "catalog.component", label: "a", componentRole: "frontend" } }),
      node("b", { data: { kind: "catalog.component", label: "b", componentRole: "backend" } }),
    ];
    const laid = layoutSiblingNodes(siblings, [], "stack");
    expect(laid[0]!.position.x).toBe(laid[1]!.position.x);
    expect(laid[1]!.position.y).toBeGreaterThan(laid[0]!.position.y);
  });
});

describe("applyDesignerAutoLayout", () => {
  it("layouts only group children when scopeGroupId is set", () => {
    const nodes: DesignerNode[] = [
      {
        id: "g1",
        type: "designerGroup",
        position: { x: 10, y: 20 },
        style: { width: 280, height: 160 },
        data: { kind: "group.frame", label: "g" },
      },
      node("fe", {
        parentId: "g1",
        extent: "parent",
        position: { x: 200, y: 200 },
        data: {
          kind: "catalog.component",
          label: "web",
          componentRole: "frontend",
          props: { name: "web" },
        },
      }),
      node("be", {
        parentId: "g1",
        extent: "parent",
        position: { x: 10, y: 10 },
        data: {
          kind: "catalog.component",
          label: "app",
          componentRole: "backend",
          props: { name: "app" },
        },
      }),
      node("outside", {
        position: { x: 999, y: 999 },
        data: { kind: "catalog.service", label: "other", serviceType: "haproxy" },
      }),
    ];
    const edges: DesignerEdge[] = [
      { id: "e1", source: "fe", target: "be" },
    ];
    const next = applyDesignerAutoLayout(nodes, edges, "flow", "g1");
    expect(next.find((n) => n.id === "outside")?.position).toEqual({ x: 999, y: 999 });
    const fe = next.find((n) => n.id === "fe")!;
    const be = next.find((n) => n.id === "be")!;
    expect(fe.position.x).toBeLessThan(be.position.x);
    const group = next.find((n) => n.id === "g1")!;
    expect(typeof group.style?.width).toBe("number");
    expect((group.style?.width as number) > 280 || (group.style?.height as number) > 160).toBe(
      true,
    );
  });
});

describe("mergePreservedChildPositions", () => {
  it("keeps previous position for matching keys", () => {
    const prev = [
      node("old", {
        position: { x: 55, y: 66 },
        data: {
          kind: "catalog.component",
          label: "web",
          componentRole: "frontend",
          props: { name: "web" },
        },
      }),
    ];
    const next = [
      node("new", {
        position: { x: 0, y: 0 },
        data: {
          kind: "catalog.component",
          label: "web",
          componentRole: "frontend",
          props: { name: "web" },
        },
      }),
    ];
    expect(mergePreservedChildPositions(prev, next)[0]?.position).toEqual({ x: 55, y: 66 });
  });
});
