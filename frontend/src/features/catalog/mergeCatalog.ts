import type { ServiceDefinition } from "../../api/serviceDefinitions";
import { CATALOG_ITEMS } from "./catalogData";
import type { CatalogItem } from "./catalogTypes";

/** Overlay live service-definitions onto mock catalog (HAProxy/FRR version & enabled). */
export function mergeCatalogWithApi(
  items: CatalogItem[] = CATALOG_ITEMS,
  definitions: ServiceDefinition[] | undefined,
): CatalogItem[] {
  if (!definitions?.length) return items.map((item) => ({ ...item }));

  const byType = new Map(definitions.map((def) => [def.service_type, def]));

  return items.map((item) => {
    const serviceType = item.deployableServiceType;
    if (!serviceType) return { ...item };
    const def = byType.get(serviceType);
    if (!def) return { ...item };

    const next: CatalogItem = {
      ...item,
      version: def.default_version || item.version,
      image: def.container_image || item.image,
      apiEnabled: def.enabled,
    };

    if (def.enabled) {
      next.status = "available";
      next.primaryAction = "create-instance";
    } else if (item.status === "available") {
      next.status = "planned";
      next.primaryAction = "create-service";
    }

    return next;
  });
}

export function isRealCreateAction(item: CatalogItem): boolean {
  return (
    item.primaryAction === "create-instance" &&
    Boolean(item.deployableServiceType) &&
    item.apiEnabled !== false &&
    item.status === "available"
  );
}

export function createInstancePath(item: CatalogItem): string | null {
  if (!isRealCreateAction(item) || !item.deployableServiceType) return null;
  return `/instances/new?type=${encodeURIComponent(item.deployableServiceType)}`;
}
