import { useCallback, useEffect, useMemo, useState, type MouseEvent } from "react";
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Edge,
  type NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useTranslation } from "react-i18next";
import type { HaproxyBackend, HaproxyFrontend, HaproxyRuntimeStatus } from "../../../types/haproxy";
import type { HaproxyRuntimeServerAction } from "../../../api/haproxy";
import {
  buildRuntimeGraph,
  statusTone,
  type RuntimeGraphNode,
  type RuntimeGraphNodeData,
} from "./buildGraph";
import { RuntimeNode } from "./RuntimeNode";

const nodeTypes: NodeTypes = {
  runtime: RuntimeNode,
};

type RuntimeActionPayload = {
  backend: string;
  server: string;
  action: HaproxyRuntimeServerAction;
  weight?: number;
};

type Props = {
  frontends: HaproxyFrontend[];
  backends: HaproxyBackend[];
  status: HaproxyRuntimeStatus | undefined;
  statusError: string | null;
  isFetching: boolean;
  runtimePending: boolean;
  clearPending: boolean;
  message: string | null;
  actionError: string | null;
  /** Pre-select a graph node (e.g. from Overview deep-link). */
  focusNodeId?: string | null;
  onRefresh: () => void;
  onClearCounters: () => void;
  onServerAction: (payload: RuntimeActionPayload) => void;
};

function FitViewOnLoad({ nodeCount }: { nodeCount: number }) {
  const { fitView } = useReactFlow();
  useEffect(() => {
    if (nodeCount === 0) return;
    const timer = window.setTimeout(() => {
      void fitView({ padding: 0.2, duration: 200 });
    }, 50);
    return () => window.clearTimeout(timer);
  }, [fitView, nodeCount]);
  return null;
}

function RuntimeGraphInner({
  frontends,
  backends,
  status,
  statusError,
  isFetching,
  runtimePending,
  clearPending,
  message,
  actionError,
  focusNodeId,
  onRefresh,
  onClearCounters,
  onServerAction,
}: Props) {
  const { t } = useTranslation();
  const [weight, setWeight] = useState("100");
  const [selectedId, setSelectedId] = useState<string | null>(focusNodeId ?? null);

  const built = useMemo(
    () => buildRuntimeGraph({ frontends, backends, status }),
    [frontends, backends, status],
  );

  const [nodes, setNodes, onNodesChange] = useNodesState<RuntimeGraphNode>(built.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(built.edges);

  useEffect(() => {
    setNodes(built.nodes);
    setEdges(built.edges);
  }, [built.nodes, built.edges, setNodes, setEdges]);

  useEffect(() => {
    if (!focusNodeId) return;
    if (built.nodes.some((node) => node.id === focusNodeId)) {
      setSelectedId(focusNodeId);
    }
  }, [focusNodeId, built.nodes]);

  const selected = useMemo(
    () => nodes.find((node) => node.id === selectedId)?.data ?? null,
    [nodes, selectedId],
  );

  const onNodeClick = useCallback((_event: MouseEvent, node: RuntimeGraphNode) => {
    setSelectedId(node.id);
  }, []);

  const onPaneClick = useCallback(() => setSelectedId(null), []);

  return (
    <section className="space-y-3">
      {statusError ? <p className="text-danger">{statusError}</p> : null}
      <p className="text-sm text-ink-muted">{t("runtimeGraph.ephemeralHint")}</p>

      <div className="flex flex-wrap items-end gap-3">
        <label className="font-mono text-xs text-ink-muted">
          {t("runtimeGraph.weight")}
          <input
            type="number"
            min={0}
            max={256}
            className="ml-2 w-24 border border-line bg-paper px-2 py-1 text-ink"
            value={weight}
            onChange={(event) => setWeight(event.target.value)}
          />
        </label>
        <button
          type="button"
          className="border border-line px-3 py-1.5 text-sm text-ink hover:border-accent"
          onClick={onRefresh}
          disabled={isFetching}
        >
          {isFetching ? t("runtimeGraph.refreshing") : t("runtimeGraph.refresh")}
        </button>
        <button
          type="button"
          className="border border-line px-3 py-1.5 text-sm text-ink hover:border-accent"
          disabled={clearPending}
          onClick={onClearCounters}
        >
          {clearPending ? t("runtimeGraph.clearing") : t("runtimeGraph.clearCounters")}
        </button>
      </div>

      {message ? <p className="font-mono text-xs text-ink-muted">{message}</p> : null}
      {actionError ? <p className="text-danger">{actionError}</p> : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
        <div className="relative h-[32rem] overflow-hidden rounded-md border border-line bg-paper">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            nodeTypes={nodeTypes}
            fitView
            minZoom={0.3}
            maxZoom={1.5}
            proOptions={{ hideAttribution: true }}
          >
            <Background gap={18} size={1} color="var(--ax-line)" />
            <Controls showInteractive={false} />
            <MiniMap
              pannable
              zoomable
              className="!bg-paper-elevated"
              nodeColor={(node) => {
                const data = node.data as RuntimeGraphNodeData;
                const tone = statusTone(data.status);
                if (tone === "ok") return "var(--ax-ok)";
                if (tone === "warn") return "var(--ax-warn)";
                if (tone === "danger") return "var(--ax-danger)";
                return "var(--ax-ink-muted)";
              }}
            />
            <FitViewOnLoad nodeCount={nodes.length} />
          </ReactFlow>

          <div className="pointer-events-none absolute bottom-3 left-3 flex flex-wrap gap-3 rounded border border-line/80 bg-paper-elevated/90 px-2.5 py-1.5 font-mono text-[10px] text-ink-muted backdrop-blur">
            <span className="inline-flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-ok" /> {t("runtimeGraph.legendUp")}
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-danger" /> {t("runtimeGraph.legendDown")}
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-warn" /> {t("runtimeGraph.legendDrain")}
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-ink-muted" /> {t("runtimeGraph.legendMaint")}
            </span>
          </div>
        </div>

        <aside className="rounded-md border border-line bg-paper-elevated p-4">
          <p className="font-mono text-[10px] tracking-[0.14em] text-ink-muted uppercase">
            {t("runtimeGraph.selected")}
          </p>
          {!selected ? (
            <p className="mt-3 text-sm text-ink-muted">{t("runtimeGraph.selectHint")}</p>
          ) : (
            <div className="mt-3 space-y-3">
              <div>
                <p className="font-mono text-[10px] text-ink-muted uppercase">{selected.kind}</p>
                <p className="text-lg font-semibold text-ink">{selected.name}</p>
                <p className="mt-1 flex items-center gap-2 font-mono text-xs uppercase">
                  <span
                    className={[
                      "inline-block h-2 w-2 rounded-full",
                      statusTone(selected.status) === "ok"
                        ? "bg-ok"
                        : statusTone(selected.status) === "warn"
                          ? "bg-warn"
                          : statusTone(selected.status) === "danger"
                            ? "bg-danger"
                            : "bg-ink-muted",
                    ].join(" ")}
                  />
                  {selected.status}
                </p>
              </div>
              <dl className="space-y-1.5 text-sm">
                <Detail label={t("runtimeGraph.sessions")} value={selected.sessions} />
                <Detail
                  label={t("runtimeGraph.bytes")}
                  value={`${selected.bytesIn} / ${selected.bytesOut}`}
                />
                {selected.kind === "frontend" ? (
                  <>
                    <Detail label={t("runtimeGraph.bind")} value={selected.bind} />
                    <Detail label={t("runtimeGraph.mode")} value={selected.mode} />
                    <Detail label={t("runtimeGraph.defaultBackend")} value={selected.backendName} />
                  </>
                ) : null}
                {selected.kind === "backend" ? (
                  <>
                    <Detail label={t("runtimeGraph.algorithm")} value={selected.balance} />
                    <Detail label={t("runtimeGraph.mode")} value={selected.mode} />
                  </>
                ) : null}
                {selected.kind === "server" ? (
                  <>
                    <Detail label={t("runtimeGraph.address")} value={selected.bind} />
                    <Detail label={t("runtimeGraph.backend")} value={selected.backendName} />
                    <Detail label={t("runtimeGraph.check")} value={selected.checkStatus} />
                    <Detail label={t("runtimeGraph.weightLabel")} value={selected.weight} />
                    <Detail label={t("runtimeGraph.interval")} value={`${selected.intervalMs} ms`} />
                    <Detail label={t("runtimeGraph.riseFall")} value={selected.riseFall} />
                  </>
                ) : null}
              </dl>
              {selected.kind === "server" ? (
                <div className="space-y-2 border-t border-line pt-3">
                  <p className="font-mono text-[10px] tracking-[0.14em] text-ink-muted uppercase">
                    {t("runtimeGraph.actions")}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {(
                      [
                        ["enable", t("runtimeGraph.enable")],
                        ["disable", t("runtimeGraph.disable")],
                        ["drain", t("runtimeGraph.drain")],
                        ["set_weight", t("runtimeGraph.setWeight")],
                      ] as const
                    ).map(([action, label]) => (
                      <button
                        key={action}
                        type="button"
                        className={[
                          "border px-2.5 py-1 text-xs hover:border-accent disabled:opacity-50",
                          action === "drain"
                            ? "border-warn text-warn"
                            : "border-line text-ink",
                        ].join(" ")}
                        disabled={runtimePending}
                        onClick={() =>
                          onServerAction({
                            backend: selected.backendName,
                            server: selected.name,
                            action,
                            weight: action === "set_weight" ? Number(weight) || 0 : undefined,
                          })
                        }
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="font-mono text-ink">{value}</dd>
    </div>
  );
}

export function RuntimeGraph(props: Props) {
  return (
    <ReactFlowProvider>
      <RuntimeGraphInner {...props} />
    </ReactFlowProvider>
  );
}
