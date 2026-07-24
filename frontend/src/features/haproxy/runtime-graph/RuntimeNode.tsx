import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { statusTone, type RuntimeGraphNode } from "./buildGraph";

const toneClass: Record<ReturnType<typeof statusTone>, string> = {
  ok: "border-ok text-ok",
  warn: "border-warn text-warn",
  danger: "border-danger text-danger",
  muted: "border-line text-ink-muted",
};

const kindLabel: Record<string, string> = {
  frontend: "FRONTEND",
  backend: "BACKEND",
  server: "SERVER",
};

function RuntimeNodeComponent({ data, selected }: NodeProps<RuntimeGraphNode>) {
  const tone = statusTone(data.status);
  return (
    <div
      className={[
        "min-w-[200px] max-w-[240px] rounded-md border bg-paper-elevated px-3 py-2 shadow-sm",
        selected ? "ring-2 ring-accent" : "",
        toneClass[tone],
      ].join(" ")}
    >
      {data.kind !== "frontend" ? (
        <Handle type="target" position={Position.Left} className="!h-2 !w-2 !bg-accent" />
      ) : null}
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[10px] tracking-wide text-ink-muted uppercase">
          {kindLabel[data.kind]}
        </span>
        <span className="flex items-center gap-1 font-mono text-[10px] uppercase">
          <span
            className={[
              "inline-block h-1.5 w-1.5 rounded-full",
              tone === "ok"
                ? "bg-ok"
                : tone === "warn"
                  ? "bg-warn"
                  : tone === "danger"
                    ? "bg-danger"
                    : "bg-ink-muted",
            ].join(" ")}
          />
          {data.status}
        </span>
      </div>
      <p className="mt-1 truncate text-sm font-semibold text-ink">{data.name}</p>
      <p className="truncate font-mono text-[11px] text-ink-muted">{data.subtitle}</p>
      <div className="mt-2 grid grid-cols-2 gap-x-2 gap-y-0.5 font-mono text-[10px] text-ink-muted">
        <span>sess {data.sessions}</span>
        <span>
          {data.bytesIn}/{data.bytesOut}
        </span>
        {data.kind === "server" ? <span className="col-span-2">check {data.checkStatus}</span> : null}
      </div>
      {data.kind !== "server" ? (
        <Handle type="source" position={Position.Right} className="!h-2 !w-2 !bg-accent" />
      ) : null}
    </div>
  );
}

export const RuntimeNode = memo(RuntimeNodeComponent);
