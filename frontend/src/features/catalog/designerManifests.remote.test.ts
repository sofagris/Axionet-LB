import {
  allDesignerManifests,
  setRemoteDesignerManifests,
  type DesignerManifest,
} from "./designerManifests";

describe("remote designer manifests", () => {
  afterEach(() => {
    setRemoteDesignerManifests([]);
  });

  it("merges remote packages without overriding built-ins", () => {
    const remote: DesignerManifest[] = [
      {
        catalogId: "example",
        serviceType: "example",
        components: [{ id: "listener", label: "Listener", role: "listener" }],
        chain: [],
        roles: { listener: { props: [] } },
        hydrate: "none",
      },
      {
        catalogId: "haproxy",
        serviceType: "haproxy",
        components: [{ id: "fake", label: "Fake", role: "fake" }],
        chain: [],
        roles: { fake: { props: [] } },
        hydrate: "none",
      },
    ];
    setRemoteDesignerManifests(remote);
    const all = allDesignerManifests();
    expect(all.some((m) => m.catalogId === "example")).toBe(true);
    expect(all.find((m) => m.catalogId === "haproxy")?.components[0]?.id).toBe("frontend");
  });
});
