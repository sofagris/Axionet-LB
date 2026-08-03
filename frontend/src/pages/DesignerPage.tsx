import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  applyNodeChanges,
  applyEdgeChanges,
  type OnEdgesChange,
  type OnNodesChange,
  type Viewport,
} from "@xyflow/react";
import { MutationGate } from "../components/MutationGate";
import { useInstances } from "../features/instances/hooks";
import { useVips } from "../features/vips/hooks";
import {
  useCreateDesignFlow,
  useDeleteDesignFlow,
  useDesignFlow,
  useDesignFlows,
  useUpdateDesignFlow,
} from "../features/designer/hooks";
import { CatalogPalette } from "../features/designer/CatalogPalette";
import {
  DesignerCanvas,
  patchEdgeData,
  patchNodeData,
} from "../features/designer/DesignerCanvas";
import { DesignerPropertiesPanel } from "../features/designer/DesignerPropertiesPanel";
import {
  groupSelectedNodes,
  isGroupNode,
  ungroupNode,
} from "../features/designer/grouping";
import {
  emptyDesignerGraph,
  parseGraphDocument,
  serializeGraphDocument,
  type DesignerEdge,
  type DesignerNode,
} from "../features/designer/types";
import {
  buildApplySuggestions,
  validateDesignerGraph,
  type ApplySuggestion,
  type ValidationIssue,
} from "../features/designer/validate";

export function DesignerPage() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const flowId = searchParams.get("flow");

  const flowsQuery = useDesignFlows();
  const flowQuery = useDesignFlow(flowId);
  const createMutation = useCreateDesignFlow();
  const updateMutation = useUpdateDesignFlow(flowId);
  const deleteMutation = useDeleteDesignFlow();
  const instancesQuery = useInstances();
  const vipsQuery = useVips();

  const [name, setName] = useState("");
  const [nodes, setNodes] = useState<DesignerNode[]>([]);
  const [edges, setEdges] = useState<DesignerEdge[]>([]);
  const [viewport, setViewport] = useState<Viewport>({ x: 0, y: 0, zoom: 1 });
  const [selectedNode, setSelectedNode] = useState<DesignerNode | null>(null);
  const [selectedNodes, setSelectedNodes] = useState<DesignerNode[]>([]);
  const [selectedEdge, setSelectedEdge] = useState<DesignerEdge | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [createName, setCreateName] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [validationIssues, setValidationIssues] = useState<ValidationIssue[]>([]);
  const [applySuggestions, setApplySuggestions] = useState<ApplySuggestion[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [canvasKey, setCanvasKey] = useState(0);
  const loadedStampRef = useRef<string | null>(null);

  const instances = instancesQuery.data ?? [];
  const vips = vipsQuery.data ?? [];

  useEffect(() => {
    if (!flowId) {
      loadedStampRef.current = null;
      return;
    }
    if (!flowQuery.data || flowQuery.data.id !== flowId) return;
    const stamp = `${flowQuery.data.id}:${flowQuery.data.updated_at}`;
    if (loadedStampRef.current === stamp) return;
    loadedStampRef.current = stamp;
    const doc = parseGraphDocument(flowQuery.data.graph_json);
    setName(flowQuery.data.name);
    setNodes(doc.nodes);
    setEdges(doc.edges);
    setViewport(doc.viewport);
    setSelectedNode(null);
    setSelectedNodes([]);
    setSelectedEdge(null);
    setValidationIssues([]);
    setApplySuggestions([]);
    setCanvasKey((k) => k + 1);
  }, [flowId, flowQuery.data]);

  const onNodesChange: OnNodesChange<DesignerNode> = useCallback((changes) => {
    setNodes((nds) => applyNodeChanges(changes, nds));
  }, []);

  const onEdgesChange: OnEdgesChange<DesignerEdge> = useCallback((changes) => {
    setEdges((eds) => applyEdgeChanges(changes, eds));
  }, []);

  const onSelectionChange = useCallback(
    (selection: {
      nodes: DesignerNode[];
      node: DesignerNode | null;
      edge: DesignerEdge | null;
    }) => {
      setSelectedNodes(selection.nodes);
      setSelectedNode(selection.node);
      setSelectedEdge(selection.edge);
    },
    [],
  );

  const canGroup =
    selectedNodes.filter((n) => !isGroupNode(n) && !n.parentId).length >= 2;
  const canUngroup = Boolean(selectedNode && isGroupNode(selectedNode));

  const onGroup = () => {
    if (!canGroup) return;
    setNodes((nds) =>
      groupSelectedNodes(
        nds,
        selectedNodes.map((n) => n.id),
        t("designer.group.defaultLabel"),
      ),
    );
    setSelectedNode(null);
    setSelectedNodes([]);
    setMessage(t("designer.messages.grouped"));
  };

  const onUngroup = () => {
    if (!selectedNode || !isGroupNode(selectedNode)) return;
    setNodes((nds) => ungroupNode(nds, selectedNode.id));
    setSelectedNode(null);
    setSelectedNodes([]);
    setMessage(t("designer.messages.ungrouped"));
  };

  const deleteSelection = useCallback(() => {
    if (selectedEdge) {
      setEdges((eds) => eds.filter((e) => e.id !== selectedEdge.id));
      setSelectedEdge(null);
      return;
    }
    const ids = new Set(
      (selectedNodes.length > 0
        ? selectedNodes
        : selectedNode
          ? [selectedNode]
          : []
      ).map((n) => n.id),
    );
    if (ids.size === 0) return;

    setNodes((nds) => {
      let next = nds;
      for (const id of ids) {
        const node = next.find((n) => n.id === id);
        if (node && isGroupNode(node)) {
          next = ungroupNode(next, id).filter((n) => n.id !== id);
        }
      }
      return next.filter((n) => !ids.has(n.id));
    });
    setEdges((eds) => eds.filter((e) => !ids.has(e.source) && !ids.has(e.target)));
    setSelectedNode(null);
    setSelectedNodes([]);
  }, [selectedEdge, selectedNode, selectedNodes]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!flowId) return;
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
        return;
      }
      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        deleteSelection();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [deleteSelection, flowId]);

  const selectFlow = (id: string | null) => {
    if (!id) {
      setSearchParams({});
      setNodes([]);
      setEdges([]);
      setName("");
      return;
    }
    setSearchParams({ flow: id });
  };

  const onCreate = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    try {
      const created = await createMutation.mutateAsync({
        name: createName.trim(),
        graph_json: emptyDesignerGraph(),
      });
      setCreateName("");
      setShowCreate(false);
      selectFlow(created.id);
      setMessage(t("designer.messages.created"));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("designer.messages.createFailed"));
    }
  };

  const onSave = async () => {
    if (!flowId) return;
    setError(null);
    setMessage(null);
    try {
      await updateMutation.mutateAsync({
        name: name.trim() || undefined,
        graph_json: serializeGraphDocument({ nodes, edges, viewport }),
      });
      setMessage(t("designer.messages.saved"));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("designer.messages.saveFailed"));
    }
  };

  const onDelete = async () => {
    if (!flowId) return;
    if (!window.confirm(t("designer.confirmDelete"))) return;
    try {
      await deleteMutation.mutateAsync(flowId);
      selectFlow(null);
      setMessage(t("designer.messages.deleted"));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("designer.messages.deleteFailed"));
    }
  };

  const onValidate = () => {
    const issues = validateDesignerGraph({ nodes, edges, instances, vips });
    setValidationIssues(issues);
    setApplySuggestions([]);
    setShowPreview(false);
    if (issues.length === 0) {
      setMessage(t("designer.messages.validateOk"));
    } else {
      setMessage(t("designer.messages.validateIssues", { count: issues.length }));
    }
  };

  const onPreview = () => {
    setShowPreview(true);
    setApplySuggestions([]);
  };

  const onApply = async () => {
    const issues = validateDesignerGraph({ nodes, edges, instances, vips });
    const errors = issues.filter((i) => i.severity === "error");
    setValidationIssues(issues);
    if (errors.length > 0) {
      setMessage(t("designer.messages.applyBlocked"));
      setApplySuggestions([]);
      return;
    }
    if (flowId) {
      try {
        await updateMutation.mutateAsync({
          name: name.trim() || undefined,
          graph_json: serializeGraphDocument({ nodes, edges, viewport }),
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : t("designer.messages.saveFailed"));
        return;
      }
    }
    const suggestions = buildApplySuggestions(nodes, instances);
    setApplySuggestions(suggestions);
    setShowPreview(false);
    setMessage(t("designer.messages.applyReady"));
  };

  const previewSummary = useMemo(() => {
    const catalog = nodes.filter((n) => n.data.kind === "catalog.service").length;
    const refs = nodes.filter((n) => n.data.kind === "instance.ref").length;
    const vipCount = nodes.filter((n) => n.data.kind === "vip.ref").length;
    return { catalog, refs, vipCount, edges: edges.length };
  }, [nodes, edges]);

  return (
    <div className="flex h-[calc(100vh-5.5rem)] flex-col gap-3">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-line pb-3">
        <div>
          <p className="font-mono text-[10px] tracking-[0.16em] text-domain-traffic uppercase">
            {t("designer.eyebrow")}
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-ink">{t("designer.title")}</h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-muted">{t("designer.subtitle")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="border border-line bg-paper px-2 py-1.5 text-sm text-ink"
            value={flowId ?? ""}
            onChange={(e) => selectFlow(e.target.value || null)}
          >
            <option value="">{t("designer.selectFlow")}</option>
            {(flowsQuery.data ?? []).map((flow) => (
              <option key={flow.id} value={flow.id}>
                {flow.name}
              </option>
            ))}
          </select>
          <MutationGate hide>
            <button
              type="button"
              className="border border-domain-traffic bg-domain-traffic-soft px-3 py-1.5 text-sm text-domain-traffic"
              onClick={() => setShowCreate((v) => !v)}
            >
              {t("designer.new")}
            </button>
          </MutationGate>
        </div>
      </header>

      <MutationGate>
        {showCreate ? (
          <form
            onSubmit={onCreate}
            className="flex flex-wrap items-end gap-2 border border-line bg-paper-elevated/40 p-3"
          >
            <label className="text-sm">
              <span className="text-ink-muted">{t("designer.name")}</span>
              <input
                className="mt-1 block w-56 border border-line bg-paper px-2 py-1.5 text-ink"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                required
                maxLength={128}
              />
            </label>
            <button
              type="submit"
              className="border border-domain-traffic bg-domain-traffic-soft px-3 py-1.5 text-sm text-domain-traffic"
              disabled={createMutation.isPending || !createName.trim()}
            >
              {t("designer.create")}
            </button>
            <button
              type="button"
              className="border border-line px-3 py-1.5 text-sm text-ink-muted"
              onClick={() => setShowCreate(false)}
            >
              {t("common.cancel")}
            </button>
          </form>
        ) : null}
      </MutationGate>

      {!flowId ? (
        <div className="flex flex-1 items-center justify-center border border-dashed border-line text-sm text-ink-muted">
          {t("designer.empty")}
        </div>
      ) : flowQuery.isLoading ? (
        <p className="text-sm text-ink-muted">{t("common.loading")}</p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <input
              className="min-w-[12rem] flex-1 border border-line bg-paper px-2 py-1.5 text-sm text-ink"
              value={name}
              onChange={(e) => setName(e.target.value)}
              aria-label={t("designer.name")}
            />
            <MutationGate hide>
              <button
                type="button"
                className="border border-line px-3 py-1.5 text-sm text-ink hover:border-accent"
                onClick={() => void onSave()}
                disabled={updateMutation.isPending}
              >
                {t("designer.save")}
              </button>
              <button
                type="button"
                className="border border-line px-3 py-1.5 text-sm text-ink hover:border-accent"
                onClick={onValidate}
              >
                {t("designer.validate")}
              </button>
              <button
                type="button"
                className="border border-line px-3 py-1.5 text-sm text-ink hover:border-accent"
                onClick={onPreview}
              >
                {t("designer.preview")}
              </button>
              <button
                type="button"
                className="border border-line px-3 py-1.5 text-sm text-ink hover:border-accent disabled:opacity-40"
                onClick={onGroup}
                disabled={!canGroup}
                title={t("designer.group.hint")}
              >
                {t("designer.group.action")}
              </button>
              <button
                type="button"
                className="border border-line px-3 py-1.5 text-sm text-ink hover:border-accent disabled:opacity-40"
                onClick={onUngroup}
                disabled={!canUngroup}
              >
                {t("designer.group.ungroup")}
              </button>
              <button
                type="button"
                className="border border-accent bg-accent px-3 py-1.5 text-sm font-medium text-white"
                onClick={() => void onApply()}
              >
                {t("designer.apply")}
              </button>
              <button
                type="button"
                className="border border-line px-3 py-1.5 text-sm text-danger hover:border-danger"
                onClick={() => void onDelete()}
              >
                {t("designer.delete")}
              </button>
            </MutationGate>
          </div>

          {message ? <p className="text-sm text-ok">{message}</p> : null}
          {error ? <p className="text-sm text-danger">{error}</p> : null}

          {(validationIssues.length > 0 || applySuggestions.length > 0 || showPreview) && (
            <div className="max-h-36 space-y-2 overflow-y-auto border border-line bg-paper-elevated/50 p-3 text-sm">
              {showPreview ? (
                <p className="text-ink-muted">
                  {t("designer.previewSummary", {
                    catalog: previewSummary.catalog,
                    refs: previewSummary.refs,
                    vips: previewSummary.vipCount,
                    edges: previewSummary.edges,
                  })}
                </p>
              ) : null}
              {validationIssues.map((issue) => (
                <p
                  key={issue.id}
                  className={issue.severity === "error" ? "text-danger" : "text-warn"}
                >
                  {t(issue.messageKey, issue.messageParams)}
                </p>
              ))}
              {applySuggestions.map((s) => (
                <div key={s.id} className="flex flex-wrap items-center gap-2 text-ink">
                  <span>{t(s.messageKey, s.messageParams)}</span>
                  {s.href ? (
                    <Link to={s.href} className="text-accent underline">
                      {s.kind === "create-instance"
                        ? t("designer.properties.createInstance")
                        : t("designer.openLink")}
                    </Link>
                  ) : null}
                </div>
              ))}
            </div>
          )}

          <div className="flex min-h-0 flex-1 overflow-hidden rounded-md border border-line">
            <CatalogPalette instances={instances} vips={vips} />
            <div className="min-w-0 flex-1 bg-paper">
              <DesignerCanvas
                key={canvasKey}
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onNodes={setNodes}
                onEdges={setEdges}
                onViewportChange={setViewport}
                onSelectionChange={onSelectionChange}
              />
            </div>
            <DesignerPropertiesPanel
              selectedNode={selectedNode}
              selectedEdge={selectedEdge}
              instances={instances}
              vips={vips}
              onUpdateNode={(nodeId, patch) => {
                setNodes((nds) => patchNodeData(nds, nodeId, patch));
                setSelectedNode((prev) =>
                  prev && prev.id === nodeId ? { ...prev, data: { ...prev.data, ...patch } } : prev,
                );
              }}
              onUpdateEdge={(edgeId, patch) => {
                setEdges((eds) => patchEdgeData(eds, edgeId, patch));
                setSelectedEdge((prev) => {
                  if (!prev || prev.id !== edgeId) return prev;
                  const { label, ...dataPatch } = patch;
                  return {
                    ...prev,
                    label: label !== undefined ? label : prev.label,
                    data: { ...(prev.data ?? {}), ...dataPatch },
                  };
                });
              }}
              onDeleteSelection={deleteSelection}
            />
          </div>
        </>
      )}
    </div>
  );
}
