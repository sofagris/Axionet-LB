import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { CatalogFlowEdge, CatalogFlowNode } from "./catalogTypes";

type Props = {
  nodes: CatalogFlowNode[];
  edges: CatalogFlowEdge[];
};

export function BlueprintFlowPreview({ nodes, edges }: Props) {
  const { t } = useTranslation();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = nodes.find((node) => node.id === selectedId) ?? null;

  if (nodes.length === 0) {
    return <p className="text-sm text-ink-muted">{t("catalog.noArchitecture")}</p>;
  }

  return (
    <div className="space-y-3">
      <p className="font-mono text-[10px] tracking-wide text-ink-muted uppercase">
        {t("catalog.architecture")}
      </p>
      <div className="flex flex-wrap items-center gap-2 rounded-md border border-line bg-paper p-3">
        {nodes.map((node, index) => (
          <div key={node.id} className="flex items-center gap-2">
            {index > 0 ? (
              <span className="font-mono text-[10px] text-ink-muted" aria-hidden>
                →
              </span>
            ) : null}
            <button
              type="button"
              onClick={() => setSelectedId(node.id === selectedId ? null : node.id)}
              className={[
                "border px-2.5 py-1.5 text-left text-xs",
                selectedId === node.id
                  ? "border-accent bg-accent-soft text-ink"
                  : "border-line bg-paper-elevated text-ink hover:border-accent",
              ].join(" ")}
            >
              <span className="block font-semibold">{node.label}</span>
              <span className="font-mono text-[10px] text-ink-muted uppercase">{node.role}</span>
            </button>
          </div>
        ))}
      </div>
      {edges.length > 0 ? (
        <ul className="space-y-1 font-mono text-[10px] text-ink-muted">
          {edges.map((edge) => (
            <li key={`${edge.from}-${edge.to}-${edge.label ?? ""}`}>
              {edge.from} → {edge.to}
              {edge.label ? ` (${edge.label})` : ""}
            </li>
          ))}
        </ul>
      ) : null}
      {selected ? (
        <div className="border border-line bg-paper-elevated p-3 text-sm">
          <p className="font-semibold text-ink">{selected.label}</p>
          <p className="mt-1 font-mono text-[10px] text-ink-muted uppercase">{selected.role}</p>
          <p className="mt-2 text-ink-muted">{t("catalog.flowNodeHint")}</p>
        </div>
      ) : null}
    </div>
  );
}
