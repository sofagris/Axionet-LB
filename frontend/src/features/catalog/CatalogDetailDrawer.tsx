import { useEffect, useId, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { BlueprintFlowPreview } from "./BlueprintFlowPreview";
import { CapabilityChips } from "./CapabilityChips";
import { catalogActionLabel } from "./catalogActions";
import { CatalogBrandIcon } from "./CatalogBrandIcon";
import { CatalogKindBadge } from "./CatalogKindBadge";
import { CatalogStatusBadge } from "./CatalogStatusBadge";
import { createInstancePath, isRealCreateAction } from "./mergeCatalog";
import { ProviderConnectionPreview } from "./ProviderConnectionPreview";
import type { CatalogItem } from "./catalogTypes";

type TabId = "overview" | "capabilities" | "architecture" | "dependencies";

type Props = {
  item: CatalogItem | null;
  onClose: () => void;
  onMockAction: (item: CatalogItem) => void;
};

export function CatalogDetailDrawer({ item, onClose, onMockAction }: Props) {
  const { t } = useTranslation();
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const [tab, setTab] = useState<TabId>("overview");

  useEffect(() => {
    setTab("overview");
  }, [item?.id]);

  useEffect(() => {
    if (!item) return;
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [item, onClose]);

  if (!item) return null;

  const realPath = createInstancePath(item);
  const tabs: { id: TabId; label: string; show: boolean }[] = [
    { id: "overview", label: t("catalog.tabs.overview"), show: true },
    { id: "capabilities", label: t("catalog.tabs.capabilities"), show: true },
    {
      id: "architecture",
      label: t("catalog.tabs.architecture"),
      show: Boolean(item.flowNodes?.length || item.components?.length),
    },
    {
      id: "dependencies",
      label: t("catalog.tabs.dependencies"),
      show: Boolean(item.dependencies?.length || item.requirements?.length || item.components?.length),
    },
  ];

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <button
        type="button"
        className="absolute inset-0 bg-ink/40"
        aria-label={t("common.close")}
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative flex h-full w-full max-w-lg flex-col border-l border-line bg-paper shadow-xl"
      >
        <header className="flex items-start gap-3 border-b border-line p-4">
          <CatalogBrandIcon brand={item.brand} name={item.name} itemId={item.id} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 id={titleId} className="text-lg font-semibold text-ink">
                {item.name}
              </h2>
              <CatalogKindBadge kind={item.kind} />
            </div>
            <div className="mt-1">
              <CatalogStatusBadge status={item.status} />
            </div>
          </div>
          <button
            ref={closeRef}
            type="button"
            className="font-mono text-xs text-ink-muted uppercase hover:text-ink"
            onClick={onClose}
          >
            {t("common.close")}
          </button>
        </header>

        <div className="flex gap-1 overflow-x-auto border-b border-line px-4" role="tablist">
          {tabs
            .filter((entry) => entry.show)
            .map((entry) => (
              <button
                key={entry.id}
                type="button"
                role="tab"
                aria-selected={tab === entry.id}
                className={[
                  "border-b-2 px-3 py-2 font-mono text-[10px] tracking-wide uppercase",
                  tab === entry.id
                    ? "border-accent text-accent"
                    : "border-transparent text-ink-muted hover:text-ink",
                ].join(" ")}
                onClick={() => setTab(entry.id)}
              >
                {entry.label}
              </button>
            ))}
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          {tab === "overview" ? (
            <div className="space-y-3">
              <p className="text-sm text-ink">{item.description}</p>
              {item.version || item.implementationHint || item.image ? (
                <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 font-mono text-xs text-ink-muted">
                  {item.version ? (
                    <>
                      <dt>{t("catalog.version")}</dt>
                      <dd className="text-ink">{item.version}</dd>
                    </>
                  ) : null}
                  {item.implementationHint ? (
                    <>
                      <dt>{t("catalog.implementation")}</dt>
                      <dd className="text-ink">{item.implementationHint}</dd>
                    </>
                  ) : null}
                  {item.image && isRealCreateAction(item) ? (
                    <>
                      <dt>{t("catalog.image")}</dt>
                      <dd className="text-ink">
                        {item.image}:{item.version}
                      </dd>
                    </>
                  ) : null}
                </dl>
              ) : null}
              {item.notes?.map((note) => (
                <p key={note} className="border border-line bg-paper-elevated p-3 text-sm text-ink-muted">
                  {note}
                </p>
              ))}
              {item.experimentalFlags?.length ? (
                <div className="space-y-1">
                  <p className="font-mono text-[10px] text-warn uppercase">
                    {t("catalog.experimental")}
                  </p>
                  <ul className="list-inside list-disc text-sm text-ink-muted">
                    {item.experimentalFlags.map((flag) => (
                      <li key={flag}>{flag}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {item.kind === "provider" ? (
                <ProviderConnectionPreview
                  providerName={item.name}
                  connectionState={item.connectionState ?? "disconnected"}
                  onMockConnect={() => onMockAction(item)}
                />
              ) : null}
            </div>
          ) : null}

          {tab === "capabilities" ? (
            <CapabilityChips capabilities={item.capabilities} limit={99} />
          ) : null}

          {tab === "architecture" ? (
            <div className="space-y-4">
              {item.flowNodes?.length ? (
                <BlueprintFlowPreview nodes={item.flowNodes} edges={item.flowEdges ?? []} />
              ) : null}
              {item.components?.length ? (
                <div>
                  <p className="mb-2 font-mono text-[10px] tracking-wide text-ink-muted uppercase">
                    {t("catalog.components")}
                  </p>
                  <ul className="space-y-2">
                    {item.components.map((component) => (
                      <li
                        key={component.id}
                        className="border border-line bg-paper-elevated px-3 py-2 text-sm"
                      >
                        <span className="font-semibold text-ink">{component.name}</span>
                        <span className="ml-2 font-mono text-[10px] text-ink-muted uppercase">
                          {component.role}
                          {component.required ? "" : ` · ${t("catalog.optional")}`}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}

          {tab === "dependencies" ? (
            <div className="space-y-3 text-sm">
              {item.dependencies?.length ? (
                <div>
                  <p className="font-mono text-[10px] text-ink-muted uppercase">
                    {t("catalog.dependencies")}
                  </p>
                  <ul className="mt-1 list-inside list-disc text-ink">
                    {item.dependencies.map((dep) => (
                      <li key={dep}>{dep}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {item.requirements?.length ? (
                <div>
                  <p className="font-mono text-[10px] text-ink-muted uppercase">
                    {t("catalog.requirements")}
                  </p>
                  <ul className="mt-1 list-inside list-disc text-ink">
                    {item.requirements.map((req) => (
                      <li key={req}>{req}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {item.components?.length ? (
                <p className="text-ink-muted">
                  {t("catalog.componentCount", { count: item.components.length })}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>

        <footer className="flex flex-wrap gap-2 border-t border-line p-4">
          {realPath && isRealCreateAction(item) ? (
            <Link
              to={realPath}
              className="border border-accent bg-accent px-3 py-1.5 text-sm font-medium text-white"
            >
              {catalogActionLabel(t, item.primaryAction)}
            </Link>
          ) : (
            <button
              type="button"
              className="border border-line px-3 py-1.5 text-sm text-ink hover:border-accent"
              onClick={() => onMockAction(item)}
            >
              {catalogActionLabel(t, item.primaryAction)}
            </button>
          )}
          <button
            type="button"
            className="border border-line px-3 py-1.5 text-sm text-ink-muted hover:text-ink"
            onClick={onClose}
          >
            {t("common.close")}
          </button>
        </footer>
      </aside>
    </div>
  );
}
