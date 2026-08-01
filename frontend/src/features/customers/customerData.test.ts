import { describe, expect, it } from "vitest";
import { getApplication, listCustomers } from "./customerData";

describe("customerData", () => {
  it("includes Kunde A and Kunde B", () => {
    const names = listCustomers().map((c) => c.name);
    expect(names).toContain("Kunde A");
    expect(names).toContain("Kunde B");
  });

  it("geo app has two sites and pool member counts", () => {
    const resolved = getApplication("kunde-a", "app-web");
    expect(resolved).toBeDefined();
    expect(resolved!.application.sites).toHaveLength(2);
    const pools = resolved!.application.resources.filter((r) => r.kind === "pool");
    expect(pools).toHaveLength(2);
    expect(pools.every((p) => /50 members/.test(p.detail))).toBe(true);
  });

  it("horizon app includes certificate resource", () => {
    const resolved = getApplication("kunde-b", "horizon");
    expect(resolved).toBeDefined();
    expect(resolved!.application.resources.some((r) => r.kind === "certificate")).toBe(true);
    expect(resolved!.application.catalogItemSlug).toBe("horizon-uag");
  });
});
