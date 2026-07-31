import { useTranslation } from "react-i18next";
import {
  CATALOG_CATEGORIES,
  CATALOG_KINDS,
  type CatalogCategory,
  type CatalogItemKind,
} from "./catalogTypes";
import type { CatalogFilterState } from "./filterCatalog";

const kindI18n: Record<CatalogItemKind, string> = {
  service: "catalog.kinds.service",
  "core-service": "catalog.kinds.coreService",
  stack: "catalog.kinds.stack",
  blueprint: "catalog.kinds.blueprint",
  integration: "catalog.kinds.integration",
  provider: "catalog.kinds.provider",
};

type Props = {
  filters: CatalogFilterState;
  onChange: (next: CatalogFilterState) => void;
  resultCount: number;
};

export function CatalogFilters({ filters, onChange, resultCount }: Props) {
  const { t } = useTranslation();

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor="catalog-search">
          {t("catalog.search")}
        </label>
        <input
          id="catalog-search"
          type="search"
          value={filters.query}
          onChange={(event) => onChange({ ...filters, query: event.target.value })}
          placeholder={t("catalog.searchPlaceholder")}
          className="min-w-[14rem] flex-1 border border-line bg-paper-elevated px-3 py-2 text-sm text-ink"
        />
        <span className="font-mono text-[10px] text-ink-muted uppercase">
          {t("catalog.resultCount", { count: resultCount })}
        </span>
      </div>

      <div className="flex flex-wrap gap-1.5" role="group" aria-label={t("catalog.categoriesLabel")}>
        <FilterChip
          active={filters.category === "all"}
          onClick={() => onChange({ ...filters, category: "all" })}
          label={t("catalog.categoryAll")}
        />
        {CATALOG_CATEGORIES.map((category) => (
          <FilterChip
            key={category}
            active={filters.category === category}
            onClick={() => onChange({ ...filters, category })}
            label={t(`catalog.categories.${category}`)}
          />
        ))}
      </div>

      <div className="flex flex-wrap gap-1.5" role="group" aria-label={t("catalog.kindsLabel")}>
        <FilterChip
          active={filters.kind === "all"}
          onClick={() => onChange({ ...filters, kind: "all" })}
          label={t("catalog.kindAll")}
        />
        {CATALOG_KINDS.map((kind) => (
          <FilterChip
            key={kind}
            active={filters.kind === kind}
            onClick={() => onChange({ ...filters, kind })}
            label={t(kindI18n[kind])}
          />
        ))}
      </div>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={[
        "border px-2.5 py-1 font-mono text-[10px] tracking-wide uppercase",
        active
          ? "border-accent bg-accent-soft text-accent"
          : "border-line text-ink-muted hover:border-accent hover:text-ink",
      ].join(" ")}
    >
      {label}
    </button>
  );
}

export function parseCategoryParam(value: string | null): CatalogCategory | "all" {
  if (!value || value === "all") return "all";
  return (CATALOG_CATEGORIES as string[]).includes(value)
    ? (value as CatalogCategory)
    : "all";
}

export function parseKindParam(value: string | null): CatalogItemKind | "all" {
  if (!value || value === "all") return "all";
  return (CATALOG_KINDS as string[]).includes(value) ? (value as CatalogItemKind) : "all";
}
