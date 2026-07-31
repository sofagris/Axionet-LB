import { useTranslation } from "react-i18next";
import { CatalogBrandIcon } from "./CatalogBrandIcon";
import { CatalogKindBadge } from "./CatalogKindBadge";
import type { CatalogItem } from "./catalogTypes";

type Props = {
  items: CatalogItem[];
  onOpenDetails: (slug: string) => void;
};

export function CatalogFeatured({ items, onOpenDetails }: Props) {
  const { t } = useTranslation();
  const featured = items.filter((item) => item.featured).slice(0, 4);
  if (featured.length === 0) return null;

  return (
    <section className="space-y-3">
      <div>
        <h3 className="font-mono text-[10px] tracking-[0.14em] text-ink-muted uppercase">
          {t("catalog.featured")}
        </h3>
        <p className="mt-1 text-sm text-ink-muted">{t("catalog.featuredHint")}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {featured.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onOpenDetails(item.slug)}
            className="flex items-start gap-3 border border-line bg-paper-elevated p-3 text-left hover:border-accent"
          >
            <CatalogBrandIcon brand={item.brand} name={item.name} itemId={item.id} size="sm" />
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-ink">{item.name}</span>
              <span className="mt-1 block">
                <CatalogKindBadge kind={item.kind} />
              </span>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
