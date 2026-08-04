import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { useTranslation } from "react-i18next";
import { CatalogBrandIcon } from "../catalog/CatalogBrandIcon";
import type { DesignerNode } from "./types";
import { visualPaletteItem } from "./visualPalette";
import { VisualAnnotationIcon } from "./VisualAnnotationIcon";

const kindLabel: Record<string, string> = {
  "catalog.service": "SERVICE",
  "catalog.component": "COMPONENT",
  "instance.ref": "INSTANCE",
  "vip.ref": "VIP",
  "group.frame": "GROUP",
  "visual.annotation": "VISUAL",
};

function DesignerNodeComponent({ data, selected }: NodeProps<DesignerNode>) {
  const { t } = useTranslation();
  const muted = Boolean(data.comingSoon);
  const isVisual = data.kind === "visual.annotation";
  const visualMeta = data.visualId ? visualPaletteItem(data.visualId) : undefined;
  const propSummary =
    data.kind === "catalog.component" && data.props
      ? Object.entries(data.props)
          .filter(([, v]) => Boolean(v))
          .slice(0, 2)
          .map(([k, v]) => `${k}=${v}`)
          .join(" · ")
      : "";
  const subtitle = isVisual
    ? data.note?.trim() ||
      (visualMeta ? t(visualMeta.descriptionKey) : t("designer.palette.visualHint"))
    : data.kind === "catalog.component"
      ? propSummary || data.componentRole || data.componentId || "—"
      : (data.serviceType ?? data.catalogSlug ?? data.vipId?.slice(0, 8) ?? "—");

  return (
    <div
      className={[
        "min-w-[180px] max-w-[220px] rounded-md border bg-paper-elevated px-3 py-2 shadow-sm",
        selected ? "ring-2 ring-accent" : "border-line",
        muted ? "opacity-60" : "",
        data.kind === "catalog.component" ? "border-dashed" : "",
        isVisual ? "border-dashed border-ink-muted/50" : "",
      ].join(" ")}
    >
      <Handle type="target" position={Position.Left} className="!h-2 !w-2 !bg-accent" />
      <div className="flex items-start gap-2">
        {isVisual && data.visualId ? (
          <VisualAnnotationIcon visualId={data.visualId} size="sm" />
        ) : data.brand ? (
          <CatalogBrandIcon
            brand={data.brand}
            name={data.label}
            itemId={data.catalogId}
            size="sm"
          />
        ) : (
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-line bg-paper font-mono text-[10px] text-ink-muted">
            {data.kind === "vip.ref"
              ? "VIP"
              : data.kind === "catalog.component"
                ? (data.componentRole ?? "CO").slice(0, 2).toUpperCase()
                : "IN"}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-[10px] tracking-wide text-ink-muted uppercase">
              {isVisual && visualMeta
                ? t(visualMeta.labelKey)
                : data.kind === "catalog.component" && data.componentRole
                  ? data.componentRole
                  : (kindLabel[data.kind] ?? data.kind)}
            </span>
            <span className="flex items-center gap-1">
              {data.pinned ? (
                <span className="font-mono text-[9px] text-accent uppercase" title="Pinned">
                  pin
                </span>
              ) : null}
              {muted ? (
                <span className="font-mono text-[9px] text-warn uppercase">soon</span>
              ) : null}
            </span>
          </div>
          <p className="mt-0.5 truncate text-sm font-semibold text-ink">{data.label}</p>
          <p className="truncate font-mono text-[11px] text-ink-muted">{subtitle}</p>
        </div>
      </div>
      <Handle type="source" position={Position.Right} className="!h-2 !w-2 !bg-accent" />
    </div>
  );
}

export const DesignerFlowNode = memo(DesignerNodeComponent);
