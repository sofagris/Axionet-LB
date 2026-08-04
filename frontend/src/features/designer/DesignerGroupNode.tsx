import { memo } from "react";
import { NodeResizer, type NodeProps } from "@xyflow/react";
import { CatalogBrandIcon } from "../catalog/CatalogBrandIcon";
import { useDesignerDropTargetId } from "./DesignerDropTargetContext";
import { nodeFillBackground } from "./nodeAppearance";
import type { DesignerNode } from "./types";

function DesignerGroupNodeComponent({ id, data, selected }: NodeProps<DesignerNode>) {
  const fill = nodeFillBackground(data);
  const hasCustomFill = Boolean(fill.backgroundColor);
  const isDropTarget = useDesignerDropTargetId() === id;

  return (
    <>
      <NodeResizer
        minWidth={220}
        minHeight={140}
        isVisible={selected}
        lineClassName="!border-accent"
        handleClassName="!h-2.5 !w-2.5 !rounded-sm !border-accent !bg-paper"
      />
      {/* pointer-events none on body so edges inside the group remain clickable */}
      <div
        className={[
          "pointer-events-none box-border h-full w-full rounded-md border-2 border-dashed",
          hasCustomFill ? "" : "bg-paper/30",
          isDropTarget
            ? "designer-drop-target border-accent"
            : selected
              ? "border-accent"
              : "border-line",
        ].join(" ")}
        style={fill}
      >
        <div className="pointer-events-auto flex items-center gap-2 border-b border-line/70 bg-paper-elevated/90 px-3 py-1.5">
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
              {data.hydrating ? "loading…" : (data.serviceType ?? "group")}
              {data.placementDomain ? ` · ${data.placementDomain}` : ""}
            </p>
            <p className="truncate text-sm font-semibold text-ink">
              {data.label}
              {data.pinned ? (
                <span className="ml-1 font-mono text-[9px] font-normal text-accent uppercase">
                  pin
                </span>
              ) : null}
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

export const DesignerGroupNode = memo(DesignerGroupNodeComponent);
