import { memo } from "react";
import { type NodeProps } from "@xyflow/react";
import { CatalogBrandIcon } from "../catalog/CatalogBrandIcon";
import type { DesignerNode } from "./types";

function DesignerGroupNodeComponent({ data, selected }: NodeProps<DesignerNode>) {
  return (
    <div
      className={[
        "box-border h-full w-full rounded-md border-2 border-dashed bg-paper/40",
        selected ? "border-accent ring-2 ring-accent/30" : "border-line",
      ].join(" ")}
    >
      <div className="flex items-center gap-2 border-b border-line/70 bg-paper-elevated/80 px-3 py-1.5">
        {data.brand ? (
          <CatalogBrandIcon
            brand={data.brand}
            name={data.label}
            itemId={data.catalogId}
            size="sm"
          />
        ) : (
          <span className="inline-flex h-7 w-7 items-center justify-center rounded border border-line font-mono text-[9px] text-ink-muted">
            GP
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[10px] tracking-wide text-ink-muted uppercase">
            {data.serviceType ?? "group"}
          </p>
          <p className="truncate text-sm font-semibold text-ink">{data.label}</p>
        </div>
      </div>
    </div>
  );
}

export const DesignerGroupNode = memo(DesignerGroupNodeComponent);
