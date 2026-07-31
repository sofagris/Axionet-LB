import type { CatalogCategory, CatalogItem, CatalogItemKind } from "./catalogTypes";

export type CatalogFilterState = {
  category: CatalogCategory | "all";
  kind: CatalogItemKind | "all";
  query: string;
};

export function filterCatalogItems(
  items: CatalogItem[],
  filters: CatalogFilterState,
): CatalogItem[] {
  const q = filters.query.trim().toLowerCase();
  return items.filter((item) => {
    if (filters.category !== "all" && item.category !== filters.category) return false;
    if (filters.kind !== "all" && item.kind !== filters.kind) return false;
    if (!q) return true;
    const haystack = [
      item.name,
      item.summary,
      item.description,
      item.implementationHint ?? "",
      ...item.capabilities,
      ...item.tags,
      item.kind,
      item.category,
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(q);
  });
}
