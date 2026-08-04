import { describe, expect, it } from "vitest";
import { CATALOG_ITEMS } from "./catalogData";
import { filterCatalogItems } from "./filterCatalog";
import {
  createInstancePath,
  isRealCreateAction,
  mergeCatalogWithApi,
  mergeCatalogWithPackages,
} from "./mergeCatalog";

describe("mergeCatalogWithApi", () => {
  it("overlays HAProxy version and enabled from API", () => {
    const merged = mergeCatalogWithApi(CATALOG_ITEMS, [
      {
        service_type: "haproxy",
        display_name: "HAProxy",
        description: "x",
        container_image: "haproxy",
        default_version: "3.2.6",
        enabled: true,
        supported_actions: ["start"],
      },
    ]);
    const hap = merged.find((i) => i.id === "haproxy");
    expect(hap?.version).toBe("3.2.6");
    expect(hap?.apiEnabled).toBe(true);
    expect(isRealCreateAction(hap!)).toBe(true);
    expect(createInstancePath(hap!)).toBe("/instances/new?type=haproxy");
  });

  it("does not treat disabled API service as real create", () => {
    const merged = mergeCatalogWithApi(CATALOG_ITEMS, [
      {
        service_type: "haproxy",
        display_name: "HAProxy",
        description: "x",
        container_image: "haproxy",
        default_version: "3.2.6",
        enabled: false,
        supported_actions: [],
      },
    ]);
    const hap = merged.find((i) => i.id === "haproxy");
    expect(isRealCreateAction(hap!)).toBe(false);
  });
});

describe("mergeCatalogWithPackages", () => {
  it("overlays package catalog and derived flow onto matching items", () => {
    const merged = mergeCatalogWithPackages(CATALOG_ITEMS, [
      {
        id: "varnish",
        serviceType: "varnish",
        version: "0.1.0",
        name: "Varnish",
        summary: "HTTP reverse proxy cache.",
        description: "From package",
        kind: "service",
        category: "traffic",
        brand: { monogram: "VA", accent: "traffic" },
        tags: ["cache"],
        capabilities: ["HTTP cache"],
        primaryAction: "create-service",
        notes: ["from package"],
        flowNodes: [
          { id: "listen", label: "Listen", role: "varnish-listen" },
          { id: "cache", label: "Cache", role: "varnish-cache" },
        ],
        flowEdges: [{ from: "listen", to: "cache", label: "vcl" }],
      },
    ]);
    const varnish = merged.find((i) => i.id === "varnish");
    expect(varnish?.description).toBe("From package");
    expect(varnish?.notes).toEqual(["from package"]);
    expect(varnish?.flowNodes?.map((n) => n.id)).toEqual(["listen", "cache"]);
    expect(varnish?.deployableServiceType).toBe("varnish");
  });

  it("appends unknown non-reference packages", () => {
    const merged = mergeCatalogWithPackages(CATALOG_ITEMS, [
      {
        id: "brand-new",
        serviceType: "brand-new",
        version: "1.0.0",
        name: "Brand New",
        summary: "New",
        description: "Only in packages",
        kind: "service",
        category: "traffic",
        brand: { monogram: "BN", accent: "traffic" },
        tags: [],
        capabilities: ["x"],
        primaryAction: "create-service",
        notes: [],
        flowNodes: [],
        flowEdges: [],
      },
    ]);
    expect(merged.some((i) => i.id === "brand-new")).toBe(true);
  });
});

describe("filterCatalogItems", () => {
  it("filters by category and search", () => {
    const byProvider = filterCatalogItems(CATALOG_ITEMS, {
      category: "providers",
      kind: "all",
      query: "",
    });
    expect(byProvider.some((i) => i.id === "cloudflare")).toBe(true);
    expect(byProvider.every((i) => i.category === "providers")).toBe(true);

    const search = filterCatalogItems(CATALOG_ITEMS, {
      category: "all",
      kind: "all",
      query: "guacamole",
    });
    expect(search.map((i) => i.id)).toContain("guacamole");

    const powerdns = filterCatalogItems(CATALOG_ITEMS, {
      category: "all",
      kind: "all",
      query: "powerdns",
    });
    expect(powerdns.length).toBeGreaterThanOrEqual(3);
  });

  it("filters by kind", () => {
    const stacks = filterCatalogItems(CATALOG_ITEMS, {
      category: "all",
      kind: "stack",
      query: "",
    });
    expect(stacks.every((i) => i.kind === "stack")).toBe(true);
  });

  it("excludes BIND", () => {
    expect(CATALOG_ITEMS.some((i) => /bind/i.test(i.name))).toBe(false);
  });

  it("exposes Keycloak mgmt/apps and auth-gateway as deployables", () => {
    const mgmt = CATALOG_ITEMS.find((i) => i.id === "keycloak-mgmt");
    const apps = CATALOG_ITEMS.find((i) => i.id === "keycloak-apps");
    const gw = CATALOG_ITEMS.find((i) => i.id === "auth-gateway");
    expect(mgmt?.deployableServiceType).toBe("keycloak-mgmt");
    expect(apps?.deployableServiceType).toBe("keycloak-apps");
    expect(gw?.deployableServiceType).toBe("auth-gateway");
    expect(createInstancePath(mgmt!)).toBe("/instances/new?type=keycloak-mgmt");
    expect(createInstancePath(apps!)).toBe("/instances/new?type=keycloak-apps");
    expect(createInstancePath(gw!)).toBe("/instances/new?type=auth-gateway");
  });
});
