import { describe, expect, it } from "vitest";
import {
  DESIGNER_CROSS_GUIDANCE,
  DESIGNER_MANIFESTS,
  designerManifestByCatalogId,
  designerRoleSchema,
  designerServiceTrees,
} from "./designerManifests";
import { defaultComponentProps, componentPropFields } from "../designer/componentProps";
import { serviceTreeByCatalogId } from "../designer/paletteComponents";

describe("designerManifests", () => {
  it("covers all former service trees", () => {
    expect(designerServiceTrees().map((t) => t.catalogId).sort()).toEqual([
      "auth-gateway",
      "frr",
      "haproxy",
      "keycloak-apps",
      "keycloak-mgmt",
    ]);
  });

  it("keeps palette lookup in sync with manifests", () => {
    const tree = serviceTreeByCatalogId("haproxy");
    const manifest = designerManifestByCatalogId("haproxy");
    expect(tree?.components).toEqual(manifest?.components);
    expect(tree?.chain).toEqual(manifest?.chain);
  });

  it("derives HAProxy frontend defaults from role schema", () => {
    expect(defaultComponentProps("frontend")).toMatchObject({
      name: "fe_http",
      bind: "*:443",
      mode: "http",
    });
    expect(componentPropFields("frontend").some((f) => f.key === "bind")).toBe(true);
    expect(designerRoleSchema("frontend")).toBeDefined();
  });

  it("marks haproxy hydrate capability for future adapter registry", () => {
    expect(DESIGNER_MANIFESTS.find((m) => m.catalogId === "haproxy")?.hydrate).toBe("poll");
    expect(DESIGNER_MANIFESTS.find((m) => m.catalogId === "frr")?.hydrate).toBe("none");
  });

  it("declares detail and apply templates for deployable services", () => {
    const hap = designerManifestByCatalogId("haproxy");
    expect(hap?.detailPathTemplate).toContain("{serviceId}");
    expect(hap?.applySteps?.componentExtras?.[0]?.whenRole).toBe("error-page");
    expect(DESIGNER_CROSS_GUIDANCE[0]?.whenAll).toEqual(["haproxy", "auth-gateway"]);
  });
});
