import type { ServiceDefinition } from "../../api/serviceDefinitions";
import type { AppPackageCatalogCard } from "../../api/appPackages";
import { CATALOG_ITEMS } from "./catalogData";
import type {
  CatalogAccent,
  CatalogAction,
  CatalogCategory,
  CatalogItem,
  CatalogItemKind,
} from "./catalogTypes";
import { CATALOG_CATEGORIES, CATALOG_KINDS } from "./catalogTypes";

const CATALOG_ACTIONS: CatalogAction[] = [
  "create-instance",
  "create-service",
  "deploy-stack",
  "start-wizard",
  "configure-integration",
  "connect-provider",
  "manage-provider",
];

const CATALOG_ACCENTS: CatalogAccent[] = [
  "traffic",
  "routing",
  "core",
  "security",
  "observe",
  "provider",
  "blueprint",
];

function asKind(value: string): CatalogItemKind {
  return (CATALOG_KINDS as string[]).includes(value)
    ? (value as CatalogItemKind)
    : "service";
}

function asCategory(value: string): CatalogCategory {
  return (CATALOG_CATEGORIES as string[]).includes(value)
    ? (value as CatalogCategory)
    : "traffic";
}

function asAction(value: string | null | undefined): CatalogAction {
  if (value && (CATALOG_ACTIONS as string[]).includes(value)) {
    return value as CatalogAction;
  }
  return "create-service";
}

function asAccent(value: unknown): CatalogAccent {
  return typeof value === "string" && (CATALOG_ACCENTS as string[]).includes(value)
    ? (value as CatalogAccent)
    : "traffic";
}

/** Map a published app-package catalog card onto CatalogItem shape. */
export function catalogItemFromPackage(card: AppPackageCatalogCard): CatalogItem {
  const monogram =
    typeof card.brand?.monogram === "string" && card.brand.monogram
      ? card.brand.monogram
      : card.id.slice(0, 2).toUpperCase();
  return {
    id: card.id,
    slug: card.id,
    name: card.name,
    kind: asKind(card.kind),
    category: asCategory(card.category),
    status: "planned",
    summary: card.summary,
    description: card.description,
    version: card.version,
    implementationHint: card.implementationHint ?? undefined,
    capabilities: card.capabilities,
    tags: card.tags,
    primaryAction: asAction(card.primaryAction),
    brand: {
      monogram,
      accent: asAccent(card.brand?.accent),
    },
    deployableServiceType: card.serviceType,
    notes: card.notes.length ? card.notes : undefined,
    flowNodes: card.flowNodes.map((node) => ({
      id: String(node.id),
      label: String(node.label),
      role: String(node.role),
    })),
    flowEdges: card.flowEdges.map((edge) => ({
      from: String(edge.from),
      to: String(edge.to),
      ...(edge.label ? { label: String(edge.label) } : {}),
    })),
  };
}

/**
 * Overlay package catalog cards onto static catalog.
 * Matching id/slug/serviceType is updated from the package; unknown packages are appended.
 */
export function mergeCatalogWithPackages(
  items: CatalogItem[] = CATALOG_ITEMS,
  packages: AppPackageCatalogCard[] | undefined,
): CatalogItem[] {
  if (!packages?.length) return items.map((item) => ({ ...item }));

  const byId = new Map(packages.map((card) => [card.id, card]));
  const byType = new Map(packages.map((card) => [card.serviceType, card]));
  const used = new Set<string>();

  const merged = items.map((item) => {
    const card =
      byId.get(item.id) ??
      (item.deployableServiceType ? byType.get(item.deployableServiceType) : undefined);
    if (!card) return { ...item };
    used.add(card.id);
    const fromPackage = catalogItemFromPackage(card);
    return {
      ...item,
      ...fromPackage,
      // Keep mockup featured flags / image when package omits them.
      featured: item.featured,
      image: item.image,
      status: item.status === "available" ? item.status : fromPackage.status,
    };
  });

  for (const card of packages) {
    if (used.has(card.id) || card.reference) continue;
    merged.push(catalogItemFromPackage(card));
  }

  return merged;
}

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
