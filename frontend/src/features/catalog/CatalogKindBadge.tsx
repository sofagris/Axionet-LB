import { useTranslation } from "react-i18next";
import type { CatalogItemKind } from "./catalogTypes";

const kindKey: Record<CatalogItemKind, string> = {
  service: "catalog.kinds.service",
  "core-service": "catalog.kinds.coreService",
  stack: "catalog.kinds.stack",
  blueprint: "catalog.kinds.blueprint",
  integration: "catalog.kinds.integration",
  provider: "catalog.kinds.provider",
};

export function CatalogKindBadge({ kind }: { kind: CatalogItemKind }) {
  const { t } = useTranslation();
  return (
    <span className="inline-flex border border-line px-1.5 py-0.5 font-mono text-[10px] tracking-wide text-ink-muted uppercase">
      {t(kindKey[kind])}
    </span>
  );
}
