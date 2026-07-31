import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { accentBar } from "./catalogAccents";
import { catalogActionLabel } from "./catalogActions";
import { CapabilityChips } from "./CapabilityChips";
import { CatalogBrandIcon } from "./CatalogBrandIcon";
import { CatalogKindBadge } from "./CatalogKindBadge";
import { CatalogStatusBadge } from "./CatalogStatusBadge";
import { createInstancePath, isRealCreateAction } from "./mergeCatalog";
import type { CatalogItem } from "./catalogTypes";

type Props = {
  item: CatalogItem;
  onOpenDetails: (slug: string) => void;
  onMockAction: (item: CatalogItem) => void;
};

export function CatalogCard({ item, onOpenDetails, onMockAction }: Props) {
  const { t } = useTranslation();
  const realPath = createInstancePath(item);
  const componentCount = item.components?.length;

  return (
    <article
      tabIndex={0}
      role="button"
      aria-label={item.name}
      onClick={() => onOpenDetails(item.slug)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpenDetails(item.slug);
        }
      }}
      className="group relative flex h-full flex-col overflow-hidden border border-line bg-paper-elevated p-4 shadow-sm outline-none transition hover:border-accent focus-visible:ring-2 focus-visible:ring-accent"
    >
      <span
        aria-hidden
        className={["absolute inset-y-0 left-0 w-0.5", accentBar[item.brand.accent]].join(" ")}
      />
      <div className="flex items-start gap-3 pl-1">
        <CatalogBrandIcon brand={item.brand} name={item.name} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-base font-semibold text-ink">{item.name}</h3>
            <CatalogKindBadge kind={item.kind} />
          </div>
          <div className="mt-1">
            <CatalogStatusBadge status={item.status} />
          </div>
        </div>
      </div>

      <p className="mt-3 line-clamp-2 pl-1 text-sm text-ink-muted">{item.summary}</p>

      <div className="mt-3 pl-1">
        <CapabilityChips capabilities={item.capabilities} limit={4} />
      </div>

      <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 pl-1 font-mono text-[10px] text-ink-muted">
        {item.version ? <span>v{item.version}</span> : null}
        {item.implementationHint ? <span>{item.implementationHint}</span> : null}
        {componentCount ? (
          <span>{t("catalog.componentCount", { count: componentCount })}</span>
        ) : null}
      </div>

      <div className="mt-auto flex flex-wrap gap-2 pt-4 pl-1">
        {realPath && isRealCreateAction(item) ? (
          <Link
            to={realPath}
            onClick={(event) => event.stopPropagation()}
            className="border border-accent bg-accent px-3 py-1.5 text-sm font-medium text-white"
          >
            {catalogActionLabel(t, item.primaryAction)}
          </Link>
        ) : (
          <button
            type="button"
            className="border border-line px-3 py-1.5 text-sm text-ink hover:border-accent"
            onClick={(event) => {
              event.stopPropagation();
              onMockAction(item);
            }}
          >
            {catalogActionLabel(t, item.primaryAction)}
          </button>
        )}
        <button
          type="button"
          className="border border-line px-3 py-1.5 text-sm text-ink-muted hover:border-accent hover:text-ink"
          onClick={(event) => {
            event.stopPropagation();
            onOpenDetails(item.slug);
          }}
        >
          {t("catalog.details")}
        </button>
      </div>
    </article>
  );
}
