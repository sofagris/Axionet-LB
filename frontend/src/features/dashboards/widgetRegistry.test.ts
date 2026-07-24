import { describe, expect, it } from "vitest";
import { DashboardSchema, WidgetTypeSchema } from "../../types/dashboards";
import { WIDGET_CATALOG } from "./widgetRegistry";

describe("dashboard types", () => {
  it("parses a dashboard with traffic_flow widget", () => {
    const parsed = DashboardSchema.parse({
      id: "d1",
      name: "Ops",
      description: null,
      widgets: [{ id: "w1", type: "traffic_flow", config: {} }],
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    });
    expect(parsed.widgets[0].type).toBe("traffic_flow");
  });

  it("rejects unknown widget types", () => {
    expect(() => WidgetTypeSchema.parse("nope")).toThrow();
  });

  it("catalog only lists known widget types", () => {
    for (const item of WIDGET_CATALOG) {
      expect(WidgetTypeSchema.parse(item.type)).toBe(item.type);
    }
  });
});
