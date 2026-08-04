import { describe, expect, it } from "vitest";
import {
  designerCapabilities,
  designerInstanceDetailPath,
} from "./serviceCapabilities";

describe("designerCapabilities", () => {
  it("exposes hydrate/live-sync for HAProxy via manifest", () => {
    expect(designerCapabilities("haproxy")).toEqual({
      serviceType: "haproxy",
      known: true,
      canHydrate: true,
      canLiveSync: true,
    });
  });

  it("keeps skeleton services non-hydrating", () => {
    expect(designerCapabilities("frr")).toMatchObject({
      known: true,
      canHydrate: false,
      canLiveSync: false,
    });
  });

  it("treats unknown service types as not known", () => {
    expect(designerCapabilities("not-a-service")).toEqual({
      serviceType: "not-a-service",
      known: false,
      canHydrate: false,
      canLiveSync: false,
    });
  });
});

describe("designerInstanceDetailPath", () => {
  it("expands the manifest detail template", () => {
    expect(designerInstanceDetailPath("haproxy", "inst-1")).toBe(
      "/instances/inst-1/haproxy",
    );
  });

  it("falls back for unknown types", () => {
    expect(designerInstanceDetailPath("not-a-service", "x")).toBe("/instances");
  });
});
