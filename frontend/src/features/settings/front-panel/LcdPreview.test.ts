import { describe, expect, it } from "vitest";
import { clampBrightness, clampLcdLine } from "./LcdPreview";

describe("LCD helpers", () => {
  it("limits each line to 16 characters", () => {
    expect(clampLcdLine("ABCDEFGHIJKLMNOPQRST").length).toBe(16);
    expect(clampLcdLine("AX-LB-01")).toBe("AX-LB-01");
  });

  it("clamps brightness to 0–255", () => {
    expect(clampBrightness(-10)).toBe(0);
    expect(clampBrightness(300)).toBe(255);
    expect(clampBrightness(128.7)).toBe(129);
  });
});
