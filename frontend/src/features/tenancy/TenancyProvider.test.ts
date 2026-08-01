import { describe, expect, it } from "vitest";
import { parseTenancyMode, tenancyListTitleKey, tenancyNavLabelKey } from "./TenancyProvider";

describe("tenancy helpers", () => {
  it("parses valid modes", () => {
    expect(parseTenancyMode("off")).toBe("off");
    expect(parseTenancyMode("internal")).toBe("internal");
    expect(parseTenancyMode("customers")).toBe("customers");
    expect(parseTenancyMode("nope")).toBeNull();
  });

  it("hides nav when off and relabels for internal", () => {
    expect(tenancyNavLabelKey("off")).toBeNull();
    expect(tenancyNavLabelKey("internal")).toBe("nav.serviceAreas");
    expect(tenancyNavLabelKey("customers")).toBe("nav.customers");
  });

  it("picks list title key", () => {
    expect(tenancyListTitleKey("internal")).toBe("customers.titleInternal");
    expect(tenancyListTitleKey("customers")).toBe("customers.title");
  });
});
