import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import type { DesignerNode } from "./types";

function DesignerLaneNodeComponent({ data }: NodeProps<DesignerNode>) {
  return (
    <div className="pointer-events-none box-border h-full w-full rounded-md border border-line/60 bg-paper/40">
      <div className="border-b border-line/50 px-4 py-2">
        <p className="font-mono text-[10px] tracking-[0.14em] text-ink-muted uppercase">
          Placement domain
        </p>
        <p className="text-sm font-semibold text-ink">{data.label}</p>
      </div>
    </div>
  );
}

export const DesignerLaneNode = memo(DesignerLaneNodeComponent);
