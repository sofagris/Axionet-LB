import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { catalogActionLabel } from "./catalogActions";
import type { CatalogItem } from "./catalogTypes";

type Props = {
  open: boolean;
  item: CatalogItem | null;
  onClose: () => void;
};

export function MockActionDialog({ open, item, onClose }: Props) {
  const { t } = useTranslation();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !item) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="catalog-mock-title"
    >
      <div className="w-full max-w-md space-y-4 border border-line bg-paper p-5 shadow-lg">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-mono text-[10px] tracking-wide text-ink-muted uppercase">
              {t("catalog.designPreview")}
            </p>
            <h2 id="catalog-mock-title" className="mt-1 text-lg font-semibold text-ink">
              {item.name}
            </h2>
          </div>
          <button
            ref={closeRef}
            type="button"
            className="font-mono text-xs text-ink-muted uppercase hover:text-ink"
            onClick={onClose}
          >
            {t("common.close")}
          </button>
        </div>
        <p className="text-sm text-ink-muted">
          {t("catalog.mockActionBody", {
            action: catalogActionLabel(t, item.primaryAction),
          })}
        </p>
        <p className="text-sm text-ink-muted">{t("catalog.notImplementedYet")}</p>
        <button
          type="button"
          className="border border-line px-3 py-1.5 text-sm text-ink hover:border-accent"
          onClick={onClose}
        >
          {t("common.close")}
        </button>
      </div>
    </div>
  );
}
