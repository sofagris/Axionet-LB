import { useTranslation } from "react-i18next";
import type { CatalogStatus } from "./catalogTypes";

const statusKey: Record<CatalogStatus, string> = {
  available: "catalog.status.available",
  planned: "catalog.status.planned",
  concept: "catalog.status.concept",
  connected: "catalog.status.connected",
  disconnected: "catalog.status.disconnected",
};

const statusTone: Record<CatalogStatus, string> = {
  available: "text-ok",
  planned: "text-ink-muted",
  concept: "text-ink-muted",
  connected: "text-ok",
  disconnected: "text-warn",
};

export function CatalogStatusBadge({ status }: { status: CatalogStatus }) {
  const { t } = useTranslation();
  return (
    <span
      className={[
        "inline-flex items-center gap-1 font-mono text-[10px] tracking-wide uppercase",
        statusTone[status],
      ].join(" ")}
    >
      <span
        aria-hidden
        className={[
          "inline-block h-1.5 w-1.5 rounded-full",
          status === "available" || status === "connected"
            ? "bg-ok"
            : status === "disconnected"
              ? "bg-warn"
              : "bg-ink-muted",
        ].join(" ")}
      />
      {t(statusKey[status])}
    </span>
  );
}
