import { describe, expect, it } from "vitest";
import { resolvePaletteDropTarget, paletteDropCreatesGroup } from "./paletteDropTarget";
import type { DesignerNode, PaletteDragPayload } from "./types";

const lane: DesignerNode = {
  id: "lane-1",
  type: "designerLane",
  position: { x: 0, y: 0 },
  style: { width: 800, height: 400 },
  data: { kind: "placement.lane", label: "Oslo", placementDomainId: "pd" },
};

const group: DesignerNode = {
  id: "g1",
  type: "designerGroup",
  parentId: "lane-1",
  extent: "parent",
  position: { x: 220, y: 40 },
  style: { width: 300, height: 180 },
  data: { kind: "group.frame", label: "LB" },
};

const treePayload: PaletteDragPayload = {
  source: "catalog",
  catalogId: "haproxy",
  catalogSlug: "haproxy",
  label: "HAProxy",
  serviceType: "haproxy",
  catalogStatus: "available",
  brand: { monogram: "HA", accent: "traffic" },
  comingSoon: false,
  dropMode: "tree",
};

const componentPayload: PaletteDragPayload = {
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
};

describe("paletteDropTarget", () => {
  it("detects tree drops as group-creating", () => {
    expect(paletteDropCreatesGroup(treePayload)).toBe(true);
    expect(paletteDropCreatesGroup(componentPayload)).toBe(false);
  });

  it("highlights lane for tree drop and group for component drop", () => {
    const nodes = [lane, group];
    expect(resolvePaletteDropTarget(nodes, { x: 300, y: 100 }, treePayload)).toEqual({
      id: "lane-1",
      kind: "lane",
    });
    expect(resolvePaletteDropTarget(nodes, { x: 280, y: 80 }, componentPayload)).toEqual({
      id: "g1",
      kind: "group",
    });
    expect(resolvePaletteDropTarget(nodes, { x: 50, y: 50 }, componentPayload)).toBeNull();
  });

  it("prefers the lane of the group under the cursor when sibling lanes overlap", () => {
    const topLane: DesignerNode = {
      id: "lane-top",
      type: "designerLane",
      position: { x: 0, y: 0 },
      // Oversized — covers the lower lane's Y range
      style: { width: 900, height: 1200 },
      data: { kind: "placement.lane", label: "Shared", placementDomainId: "pd-top" },
    };
    const bottomLane: DesignerNode = {
      id: "lane-bottom",
      type: "designerLane",
      position: { x: 0, y: 700 },
      style: { width: 900, height: 300 },
      data: { kind: "placement.lane", label: "Oslo", placementDomainId: "pd-bottom" },
    };
    const bottomGroup: DesignerNode = {
      id: "g-bottom",
      type: "designerGroup",
      parentId: "lane-bottom",
      extent: "parent",
      position: { x: 220, y: 40 },
      style: { width: 280, height: 160 },
      data: { kind: "group.frame", label: "edge" },
    };
    const nodes = [topLane, bottomLane, bottomGroup];
    // Flow point inside bottom group (and also inside the oversized top lane)
    expect(resolvePaletteDropTarget(nodes, { x: 300, y: 760 }, treePayload)).toEqual({
      id: "lane-bottom",
      kind: "lane",
    });
  });
});
