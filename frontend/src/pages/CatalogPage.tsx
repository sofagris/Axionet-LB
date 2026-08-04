import { useCallback, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useServiceDefinitions, useAppPackageCatalog } from "../features/catalog/hooks";
import { CatalogDetailDrawer } from "../features/catalog/CatalogDetailDrawer";
import { CatalogFeatured } from "../features/catalog/CatalogFeatured";
import { CatalogFilters, parseCategoryParam, parseKindParam } from "../features/catalog/CatalogFilters";
import { CatalogGrid } from "../features/catalog/CatalogGrid";
import { filterCatalogItems } from "../features/catalog/filterCatalog";
import { mergeCatalogWithApi, mergeCatalogWithPackages } from "../features/catalog/mergeCatalog";
import { MockActionDialog } from "../features/catalog/MockActionDialog";
import type { CatalogItem } from "../features/catalog/catalogTypes";

export function CatalogPage() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const catalogQuery = useServiceDefinitions();
  const packagesQuery = useAppPackageCatalog();
  const [mockItem, setMockItem] = useState<CatalogItem | null>(null);

  const filters = useMemo(
    () => ({
      category: parseCategoryParam(searchParams.get("category")),
      kind: parseKindParam(searchParams.get("kind")),
      query: searchParams.get("q") ?? "",
    }),
    [searchParams],
  );

  const selectedSlug = searchParams.get("item");

  const items = useMemo(() => {
    const withPackages = mergeCatalogWithPackages(undefined, packagesQuery.data);
    return mergeCatalogWithApi(withPackages, catalogQuery.data);
  }, [packagesQuery.data, catalogQuery.data]);

  const filtered = useMemo(() => filterCatalogItems(items, filters), [items, filters]);

  const selectedItem = useMemo(
    () => (selectedSlug ? (items.find((item) => item.slug === selectedSlug) ?? null) : null),
    [items, selectedSlug],
  );

  const updateParams = useCallback(
    (patch: Record<string, string | null>) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          for (const [key, value] of Object.entries(patch)) {
            if (!value) next.delete(key);
            else next.set(key, value);
          }
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const openDetails = useCallback(
    (slug: string) => updateParams({ item: slug }),
    [updateParams],
  );

  const closeDetails = useCallback(() => updateParams({ item: null }), [updateParams]);

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-xl font-semibold tracking-tight text-ink">{t("catalog.title")}</h2>
        <p className="mt-1 max-w-2xl text-ink-muted">{t("catalog.subtitle")}</p>
        <p className="mt-2 max-w-2xl text-sm text-ink-muted">{t("catalog.mockupHint")}</p>
      </section>

      {catalogQuery.isError ? (
        <p className="text-sm text-danger">
          {t("catalog.loadFailed", {
            message:
              catalogQuery.error instanceof Error
                ? catalogQuery.error.message
                : t("common.unknownError"),
          })}
        </p>
      ) : null}

      <CatalogFeatured items={items} onOpenDetails={openDetails} />

      <CatalogFilters
        filters={filters}
        resultCount={filtered.length}
        onChange={(next) =>
          updateParams({
            category: next.category === "all" ? null : next.category,
            kind: next.kind === "all" ? null : next.kind,
            q: next.query.trim() ? next.query : null,
          })
        }
      />

      <CatalogGrid
        items={filtered}
        onOpenDetails={openDetails}
        onMockAction={setMockItem}
      />

      <CatalogDetailDrawer
        item={selectedItem}
        onClose={closeDetails}
        onMockAction={setMockItem}
      />

      <MockActionDialog open={Boolean(mockItem)} item={mockItem} onClose={() => setMockItem(null)} />
    </div>
  );
}
