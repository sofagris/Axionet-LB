import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { CatalogBrandIcon } from "../catalog/CatalogBrandIcon";
import type { DesignerNode } from "./types";

const kindLabel: Record<string, string> = {
  "catalog.service": "CATALOG",
  "instance.ref": "INSTANCE",
  "vip.ref": "VIP",
};

function DesignerNodeComponent({ data, selected }: NodeProps<DesignerNode>) {
  const muted = Boolean(data.comingSoon);
  return (
    <div
      className={[
        "min-w-[180px] max-w-[220px] rounded-md border bg-paper-elevated px-3 py-2 shadow-sm",
        selected ? "ring-2 ring-accent" : "border-line",
        muted ? "opacity-60" : "",
      ].join(" ")}
    >
      <Handle type="target" position={Position.Left} className="!h-2 !w-2 !bg-accent" />
      <div className="flex items-start gap-2">
        {data.brand ? (
          <CatalogBrandIcon
            brand={data.brand}
            name={data.label}
            itemId={data.catalogId}
            size="sm"
          />
        ) : (
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-line bg-paper font-mono text-[10px] text-ink-muted">
            {data.kind === "vip.ref" ? "VIP" : "IN"}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-[10px] tracking-wide text-ink-muted uppercase">
              {kindLabel[data.kind] ?? data.kind}
            </span>
            {muted ? (
              <span className="font-mono text-[9px] text-warn uppercase">soon</span>
            ) : null}
          </div>
          <p className="mt-0.5 truncate text-sm font-semibold text-ink">{data.label}</p>
          <p className="truncate font-mono text-[11px] text-ink-muted">
            {data.serviceType ?? data.catalogSlug ?? data.vipId?.slice(0, 8) ?? "—"}
          </p>
        </div>
      </div>
      <Handle type="source" position={Position.Right} className="!h-2 !w-2 !bg-accent" />
    </div>
  );
}

export const DesignerFlowNode = memo(DesignerNodeComponent);
