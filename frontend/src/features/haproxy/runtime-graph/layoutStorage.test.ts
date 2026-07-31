import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  applyLayoutPositions,
  clearLayoutPositions,
  layoutStorageKey,
  loadLayoutPositions,
  positionsFromNodes,
  saveLayoutPositions,
} from "./layoutStorage";

describe("layoutStorage", () => {
  const instanceId = "hap-test";

  beforeEach(() => {
    clearLayoutPositions(instanceId);
  });

  afterEach(() => {
    clearLayoutPositions(instanceId);
  });

  it("round-trips positions through localStorage", () => {
    saveLayoutPositions(instanceId, { "fe:main": { x: 12, y: 34 } });
    expect(loadLayoutPositions(instanceId)).toEqual({ "fe:main": { x: 12, y: 34 } });
    expect(layoutStorageKey(instanceId)).toContain(instanceId);
  });

  it("applies saved then previous then default", () => {
    const nodes = [
      { id: "a", position: { x: 0, y: 0 } },
      { id: "b", position: { x: 1, y: 1 } },
      { id: "c", position: { x: 2, y: 2 } },
    ];
    const merged = applyLayoutPositions(
      nodes,
      { a: { x: 100, y: 100 } },
      { b: { x: 50, y: 50 } },
    );
    expect(merged[0].position).toEqual({ x: 100, y: 100 });
    expect(merged[1].position).toEqual({ x: 50, y: 50 });
    expect(merged[2].position).toEqual({ x: 2, y: 2 });
  });

  it("builds positions map from nodes", () => {
    expect(
      positionsFromNodes([
        { id: "a", position: { x: 1, y: 2 } },
        { id: "b", position: { x: 3, y: 4 } },
      ]),
    ).toEqual({ a: { x: 1, y: 2 }, b: { x: 3, y: 4 } });
  });
});
