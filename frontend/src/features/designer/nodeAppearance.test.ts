import { describe, expect, it } from "vitest";
import {
  DEFAULT_FILL_OPACITY,
  clampFillOpacity,
  nodeFillBackground,
  normalizeFillColor,
} from "./nodeAppearance";

describe("nodeAppearance", () => {
  it("normalizes hex colors", () => {
    expect(normalizeFillColor("#0F766E")).toBe("#0f766e");
    expect(normalizeFillColor("not-a-color")).toBeUndefined();
    expect(normalizeFillColor(undefined)).toBeUndefined();
  });

  it("clamps opacity", () => {
    expect(clampFillOpacity(undefined)).toBe(DEFAULT_FILL_OPACITY);
    expect(clampFillOpacity(-1)).toBe(0);
    expect(clampFillOpacity(2)).toBe(1);
    expect(clampFillOpacity(0.5)).toBe(0.5);
  });

  it("builds rgba background from color + opacity", () => {
    expect(nodeFillBackground({})).toEqual({});
    expect(nodeFillBackground({ fillColor: "#0f766e", fillOpacity: 0.5 })).toEqual({
      backgroundColor: "rgba(15, 118, 110, 0.5)",
    });
  });
});
