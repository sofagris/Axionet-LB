import { memo } from "react";
import { useTranslation } from "react-i18next";
import { NodeResizer, type NodeProps } from "@xyflow/react";
import { useDesignerDropTargetId } from "./DesignerDropTargetContext";
import { nodeFillBackground } from "./nodeAppearance";
import type { DesignerNode } from "./types";

function LaneIcon({ kind }: { kind?: string }) {
  if (kind === "shared") {
    return (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden>
        <circle cx="8" cy="10" r="3" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="16" cy="10" r="3" stroke="currentColor" strokeWidth="1.5" />
        <path d="M4 18c0-2.2 1.8-4 4-4h0c1 0 1.9.4 2.6 1M13.4 15c.7-.6 1.6-1 2.6-1h0c2.2 0 4 1.8 4 4" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    );
  }
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M4 20V9l8-5 8 5v11" stroke="currentColor" strokeWidth="1.5" />
      <path d="M9 20v-6h6v6" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function DesignerLaneNodeComponent({ id, data, selected }: NodeProps<DesignerNode>) {
  const { t } = useTranslation();
  const kind = data.placementKind ?? (/shared/i.test(data.label) ? "shared" : "site");
  const description = data.placementDescription ?? "";
  const fill = nodeFillBackground(data);
  const hasCustomFill = Boolean(fill.backgroundColor);
  const isDropTarget = useDesignerDropTargetId() === id;

  return (
    <>
      <NodeResizer
        minWidth={420}
        minHeight={160}
        isVisible={selected}
        lineClassName="!border-accent"
        handleClassName="!h-2.5 !w-2.5 !rounded-sm !border-accent !bg-paper"
      />
      <div
        className={[
          "pointer-events-none box-border flex h-full w-full overflow-hidden rounded-md border",
          hasCustomFill ? "" : "bg-paper/50",
          isDropTarget
            ? "designer-drop-target border-accent"
            : selected
              ? "border-accent"
              : "border-line/70",
        ].join(" ")}
        style={fill}
      >
        <div className="pointer-events-auto flex w-[11.5rem] shrink-0 flex-col gap-2 border-r border-line/60 bg-paper-elevated/90 px-3 py-3">
          <div className="text-accent">
            <LaneIcon kind={kind} />
          </div>
          <p className="font-mono text-[10px] tracking-[0.12em] text-ink-muted uppercase">
            {kind === "shared"
              ? t("designer.placement.kindShared")
              : t("designer.placement.kindSite")}
          </p>
          <p className="text-sm font-semibold leading-tight text-ink">{data.label}</p>
          {description ? (
            <p className="line-clamp-4 text-[11px] leading-snug text-ink-muted">{description}</p>
          ) : null}
        </div>
        <div className="min-w-0 flex-1 bg-[linear-gradient(180deg,transparent,rgba(0,0,0,0.02))]" />
      </div>
    </>
  );
}

export const DesignerLaneNode = memo(DesignerLaneNodeComponent);
