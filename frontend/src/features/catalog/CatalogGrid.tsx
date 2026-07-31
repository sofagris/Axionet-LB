import { useTranslation } from "react-i18next";
import { CatalogCard } from "./CatalogCard";
import type { CatalogItem } from "./catalogTypes";

type Props = {
  items: CatalogItem[];
  onOpenDetails: (slug: string) => void;
  onMockAction: (item: CatalogItem) => void;
};

export function CatalogGrid({ items, onOpenDetails, onMockAction }: Props) {
  const { t } = useTranslation();
  if (items.length === 0) {
    return <p className="text-sm text-ink-muted">{t("catalog.empty")}</p>;
  }
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => (
        <CatalogCard
          key={item.id}
          item={item}
          onOpenDetails={onOpenDetails}
          onMockAction={onMockAction}
        />
      ))}
    </div>
  );
}
