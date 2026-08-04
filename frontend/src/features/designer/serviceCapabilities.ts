import {
  designerManifestByServiceType,
  expandDesignerPathTemplate,
} from "../catalog/designerManifests";

export type DesignerServiceCapabilities = {
  serviceType: string;
  /** Has a designer manifest (known deployable package). */
  known: boolean;
  /** Group can be hydrated / refreshed from live instance config. */
  canHydrate: boolean;
  /** Linked groups should poll live config while on the canvas. */
  canLiveSync: boolean;
};

/**
 * Capability view derived from Catalog designer manifests.
 * Canvas/UI should call this instead of `serviceType === "haproxy"`.
 */
export function designerCapabilities(
  serviceType: string | undefined | null,
): DesignerServiceCapabilities {
  if (!serviceType) {
    return { serviceType: "", known: false, canHydrate: false, canLiveSync: false };
  }
  const manifest = designerManifestByServiceType(serviceType);
  const hydrate = manifest?.hydrate ?? "none";
  return {
    serviceType,
    known: Boolean(manifest),
    canHydrate: hydrate === "onDrop" || hydrate === "poll",
    canLiveSync: hydrate === "poll",
  };
}

/** Instance detail path from manifest template (falls back to /instances if unknown). */
export function designerInstanceDetailPath(
  serviceType: string,
  serviceId: string,
): string {
  const manifest = designerManifestByServiceType(serviceType);
  if (!manifest) return "/instances";
  const template =
    manifest.detailPathTemplate ?? "/instances/{serviceId}/{serviceType}";
  return expandDesignerPathTemplate(template, { serviceId, serviceType });
}
