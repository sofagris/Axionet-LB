import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type SVGProps } from "react";
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
  useRemoteDesignerManifests,
  useUpdateDesignFlow,
} from "../features/designer/hooks";
import { CatalogPalette } from "../features/designer/CatalogPalette";
import { DeleteGroupDialog } from "../features/designer/DeleteGroupDialog";
import {
  DesignerCanvas,
  patchEdgeData,
  patchNodeData,
} from "../features/designer/DesignerCanvas";
import { DesignerPropertiesPanel } from "../features/designer/DesignerPropertiesPanel";
import { DesignerToolbar } from "../features/designer/DesignerToolbar";
import { DesignerToast } from "../features/designer/DesignerToast";
import {
  DESIGNER_FULL_WIDTH_EVENT,
  readDesignerFullWidth,
  writeDesignerFullWidth,
} from "../features/designer/fullWidth";
import { runElkLayout, interpolatePositions } from "../features/designer/elkLayout";
import {
  readDesignerLayoutPrefs,
  writeDesignerLayoutPrefs,
  type DesignerLayoutPrefs,
  type ElkLayoutKind,
} from "../features/designer/layoutPrefs";
import {
  createLaneNode,
  domainForLocalLbSite,
  domainsWithoutLane,
  fromPlatformRecord,
  migratePlacementDomains,
  remapNodesToPlatformDomains,
} from "../features/designer/placementDomains";
import {
  emptyDesignerGraph,
  parseGraphDocument,
  serializeGraphDocument,
  type DesignerEdge,
  type DesignerGraphDocument,
  type DesignerNode,
  type PlacementDomain,
} from "../features/designer/types";
import {
  useInventoryMutations,
  useLoadBalancers,
  usePlacementDomains,
  useSites,
} from "../features/inventory/hooks";
import {
  applySnapshotToGroup,
  fetchHaproxyConfigSnapshot,
  setGroupHydrating,
  type LinkedHaproxyGroup,
} from "../features/designer/haproxyRehydrate";
import type { HaproxyConfigSnapshot } from "../features/designer/haproxyConfigFingerprint";
import { useLinkedHaproxySync } from "../features/designer/useLinkedHaproxySync";
import { designerCapabilities } from "../features/designer/serviceCapabilities";
import {
  attachGroupsToMatchingLanes,
  deleteGroups,
  groupSelectedNodes,
  isGroupNode,
  isLaneNode,
  moveGroupToDomainLane,
  absolutePosition,
  ungroupNode,
} from "../features/designer/grouping";
import {
  buildApplySuggestions,
  validateDesignerGraph,
  type ApplySuggestion,
  type ValidationIssue,
} from "../features/designer/validate";

/** Stable hash of design content for dirty detection (ignore viewport / measured size). */
function designFingerprint(
  name: string,
  nodes: DesignerNode[],
  edges: DesignerEdge[],
  placementDomains: PlacementDomain[],
): string {
  const graph: DesignerGraphDocument = serializeGraphDocument({
    nodes,
    edges,
    viewport: { x: 0, y: 0, zoom: 1 },
    placementDomains,
  });
  return JSON.stringify({
    name: name.trim(),
    nodes: graph.nodes.map(({ width: _w, height: _h, ...rest }) => rest),
    edges: graph.edges,
    placementDomains: graph.placementDomains,
  });
}

type IconProps = SVGProps<SVGSVGElement>;

function iconBase(props: IconProps) {
  return {
    width: 18,
    height: 18,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.75,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true as const,
    ...props,
  };
}

/** Expand to fill available width. */
function IconExpandWidth(props: IconProps) {
  return (
    <svg {...iconBase(props)}>
      <path d="M4 8V4h4M20 8V4h-4M4 16v4h4M20 16v4h-4" />
      <path d="M9 12h6M9 12l2-2M9 12l2 2M15 12l-2-2M15 12l-2 2" />
    </svg>
  );
}

/** Constrain to standard content width. */
function IconConstrainWidth(props: IconProps) {
  return (
    <svg {...iconBase(props)}>
      <path d="M8 4H4v4M16 4h4v4M8 20H4v-4M16 20h4v-4" />
      <path d="M15 12H9M15 12l-2-2M15 12l-2 2M9 12l2-2M9 12l2 2" />
    </svg>
  );
}

export function DesignerPage() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const flowId = searchParams.get("flow");

  const flowsQuery = useDesignFlows();
  useRemoteDesignerManifests();
  const flowQuery = useDesignFlow(flowId);
  const createMutation = useCreateDesignFlow();
  const updateMutation = useUpdateDesignFlow(flowId);
  const deleteMutation = useDeleteDesignFlow();
  const instancesQuery = useInstances();
  const vipsQuery = useVips();
  const platformDomainsQuery = usePlacementDomains();
  const loadBalancersQuery = useLoadBalancers();
  const sitesQuery = useSites();
  const inventoryMutations = useInventoryMutations();

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
  const [savedFingerprint, setSavedFingerprint] = useState<string | null>(null);
  const [validationIssues, setValidationIssues] = useState<ValidationIssue[]>([]);
  const [applySuggestions, setApplySuggestions] = useState<ApplySuggestion[]>([]);
  const [canvasKey, setCanvasKey] = useState(0);
  const [groupDeletePrompt, setGroupDeletePrompt] = useState<{
    groupIds: string[];
    otherIds: string[];
  } | null>(null);
  const [fullWidth, setFullWidth] = useState(readDesignerFullWidth);
  const [layoutPrefs, setLayoutPrefs] = useState<DesignerLayoutPrefs>(readDesignerLayoutPrefs);
  const [layoutBusy, setLayoutBusy] = useState(false);
  const [fitViewNonce, setFitViewNonce] = useState(0);
  const [placementDomains, setPlacementDomains] = useState<PlacementDomain[]>([]);
  const loadedStampRef = useRef<string | null>(null);
  const fingerprintsRef = useRef(new Map<string, string>());
  const inFlightRef = useRef(new Set<string>());
  /** When true, next flow stamp change from our own save must not remount/rehydrate. */
  const preserveLocalGraphRef = useRef(false);
  /** Gate live HAProxy sync until domain remap after load has finished. */
  const [haproxySyncReady, setHaproxySyncReady] = useState(false);
  const graphRef = useRef({ nodes, edges });
  useEffect(() => {
    graphRef.current = { nodes, edges };
  }, [nodes, edges]);

  useEffect(() => {
    const sync = () => setFullWidth(readDesignerFullWidth());
    const onCustom = (event: Event) => {
      const detail = (event as CustomEvent<{ fullWidth?: boolean }>).detail;
      if (typeof detail?.fullWidth === "boolean") {
        setFullWidth(detail.fullWidth);
      } else {
        sync();
      }
    };
    window.addEventListener(DESIGNER_FULL_WIDTH_EVENT, onCustom);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(DESIGNER_FULL_WIDTH_EVENT, onCustom);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const toggleFullWidth = () => {
    writeDesignerFullWidth(!fullWidth);
  };

  const instances = instancesQuery.data ?? [];
  const vips = vipsQuery.data ?? [];
  const platformDomains = useMemo(
    () => (platformDomainsQuery.data ?? []).map(fromPlatformRecord),
    [platformDomainsQuery.data],
  );
  const localLb = useMemo(
    () => (loadBalancersQuery.data ?? []).find((lb) => lb.is_local),
    [loadBalancersQuery.data],
  );
  const localSite = useMemo(() => {
    if (!localLb?.site_id) return undefined;
    return (sitesQuery.data ?? []).find((s) => s.id === localLb.site_id);
  }, [localLb, sitesQuery.data]);

  // Keep Designer registry aligned with platform source of truth.
  useEffect(() => {
    if (!platformDomainsQuery.data) return;
    setPlacementDomains(platformDomains);
  }, [platformDomains, platformDomainsQuery.data]);

  useEffect(() => {
    if (!flowId) {
      loadedStampRef.current = null;
      fingerprintsRef.current.clear();
      inFlightRef.current.clear();
      preserveLocalGraphRef.current = false;
      setSavedFingerprint(null);
      setHaproxySyncReady(false);
      return;
    }
    if (!flowQuery.data || flowQuery.data.id !== flowId) return;
    const stamp = `${flowQuery.data.id}:${flowQuery.data.updated_at}`;
    if (loadedStampRef.current === stamp) return;
    // Own save: keep in-memory canvas + fingerprints (avoid sync rehydrate grid reset).
    if (preserveLocalGraphRef.current) {
      preserveLocalGraphRef.current = false;
      loadedStampRef.current = stamp;
      return;
    }
    loadedStampRef.current = stamp;
    fingerprintsRef.current.clear();
    inFlightRef.current.clear();
    setHaproxySyncReady(false);
    const doc = parseGraphDocument(flowQuery.data.graph_json);
    const migrated = migratePlacementDomains(doc.nodes, doc.placementDomains ?? []);
    const loadedName = flowQuery.data.name;
    const loadedNodes = attachGroupsToMatchingLanes(migrated.nodes);
    const loadedEdges = doc.edges;
    setName(loadedName);
    setNodes(loadedNodes);
    setEdges(loadedEdges);
    setViewport(doc.viewport);
    setSelectedNode(null);
    setSelectedNodes([]);
    setSelectedEdge(null);
    setValidationIssues([]);
    setApplySuggestions([]);
    setCanvasKey((k) => k + 1);
    setSavedFingerprint(
      designFingerprint(loadedName, loadedNodes, loadedEdges, migrated.placementDomains),
    );

    // Ensure design-local domains exist on the platform, then remap node ids.
    void (async () => {
      try {
        let platform = (await platformDomainsQuery.refetch()).data?.map(fromPlatformRecord) ?? [];
        for (const local of migrated.placementDomains) {
          const exists = platform.some(
            (p) => p.name.trim().toLowerCase() === local.name.trim().toLowerCase(),
          );
          if (exists) continue;
          await inventoryMutations.createPlacementDomain.mutateAsync({
            name: local.name,
            kind: local.kind,
            description: local.description ?? null,
            icon: local.icon ?? null,
          });
        }
        platform = (await platformDomainsQuery.refetch()).data?.map(fromPlatformRecord) ?? [];
        setPlacementDomains(platform);
        // Remap whatever is currently on the canvas (never clobber a concurrent hydrate).
        const { nodes: currentNodes, edges: currentEdges } = graphRef.current;
        const remapped = attachGroupsToMatchingLanes(
          remapNodesToPlatformDomains(currentNodes, platform),
        );
        setNodes(remapped);
        setSavedFingerprint(
          designFingerprint(loadedName, remapped, currentEdges, platform),
        );
      } catch {
        // Keep design-local registry if platform sync fails.
        setPlacementDomains(migrated.placementDomains);
        setSavedFingerprint(
          designFingerprint(
            loadedName,
            loadedNodes,
            loadedEdges,
            migrated.placementDomains,
          ),
        );
      } finally {
        setHaproxySyncReady(true);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-run on flow stamp change
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

  const onLayoutPrefsChange = (prefs: DesignerLayoutPrefs) => {
    setLayoutPrefs(prefs);
    writeDesignerLayoutPrefs(prefs);
  };

  const onRunLayout = useCallback(
    async (kind: ElkLayoutKind) => {
      if (kind === "selected" && selectedNodes.length === 0) {
        setMessage(t("designer.messages.layoutNeedSelection"));
        return;
      }
      setLayoutBusy(true);
      setError(null);
      try {
        const scopeGroupId =
          kind !== "selected" && selectedNode && isGroupNode(selectedNode)
            ? selectedNode.id
            : null;
        const scopeIds =
          kind === "selected" ? selectedNodes.map((n) => n.id) : null;
        const hubId = selectedNode?.id ?? null;
        const before = nodes;
        const next = await runElkLayout({
          nodes,
          edges,
          kind,
          prefs: layoutPrefs,
          hubId,
          scopeIds,
          scopeGroupId,
          placementDomains,
        });

        if (layoutPrefs.animate && before.length > 0) {
          const duration = 280;
          const start = performance.now();
          await new Promise<void>((resolve) => {
            const tick = (now: number) => {
              const t = Math.min(1, (now - start) / duration);
              const eased = 1 - (1 - t) * (1 - t);
              setNodes(interpolatePositions(before, next, eased));
              if (t < 1) requestAnimationFrame(tick);
              else {
                setNodes(next);
                resolve();
              }
            };
            requestAnimationFrame(tick);
          });
        } else {
          setNodes(next);
        }

        if (layoutPrefs.fitView) {
          setFitViewNonce((n) => n + 1);
        }
        setMessage(
          scopeGroupId
            ? t("designer.messages.layoutGroup")
            : t("designer.messages.layoutCanvas"),
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : t("designer.messages.layoutFailed"));
      } finally {
        setLayoutBusy(false);
      }
    },
    [edges, layoutPrefs, nodes, placementDomains, selectedNode, selectedNodes, t],
  );

  const onPlaceLane = useCallback(
    (domain: PlacementDomain) => {
      const already = nodes.some(
        (n) =>
          n.data.kind === "placement.lane" &&
          (n.data.placementDomainId === domain.id ||
            (n.data.placementDomain ?? n.data.label).trim().toLowerCase() ===
              domain.name.trim().toLowerCase()),
      );
      if (already) {
        setMessage(t("designer.messages.laneAlreadyPresent", { name: domain.name }));
        return;
      }
      const y =
        nodes
          .filter((n) => n.data.kind === "placement.lane")
          .reduce((max, n) => {
            const h = typeof n.style?.height === "number" ? n.style.height : 220;
            return Math.max(max, n.position.y + h + 40);
          }, 0) || 40;
      setPlacementDomains((ds) =>
        ds.some((d) => d.id === domain.id) ? ds : [...ds, domain],
      );
      setNodes((nds) =>
        attachGroupsToMatchingLanes([...nds, createLaneNode(domain, { x: 24, y })]),
      );
      setMessage(t("designer.messages.laneAdded", { name: domain.name }));
      setError(null);
    },
    [nodes, t],
  );

  const onCreateLaneDomain = useCallback(
    async (kind: "site" | "shared") => {
      const suggested =
        kind === "shared"
          ? t("designer.placement.defaultShared")
          : t("designer.placement.defaultSite", {
              n: placementDomains.filter((d) => d.kind === "site").length + 1,
            });
      const raw = window.prompt(t("designer.placement.createDomainPrompt"), suggested);
      const name = raw?.trim();
      if (!name) return;

      const existing = placementDomains.find(
        (d) => d.name.trim().toLowerCase() === name.toLowerCase(),
      );
      if (existing) {
        onPlaceLane(existing);
        return;
      }

      try {
        const created = await inventoryMutations.createPlacementDomain.mutateAsync({
          name,
          kind,
          description:
            kind === "shared"
              ? t("designer.placement.sharedDescription")
              : t("designer.placement.siteDescription", { name }),
        });
        onPlaceLane(fromPlatformRecord(created));
      } catch (err) {
        // Name clash on platform — refetch and place the existing domain.
        const message = err instanceof Error ? err.message : "";
        if (/already exists/i.test(message)) {
          try {
            const refreshed =
              (await platformDomainsQuery.refetch()).data?.map(fromPlatformRecord) ?? [];
            setPlacementDomains(refreshed);
            const match = refreshed.find(
              (d) => d.name.trim().toLowerCase() === name.toLowerCase(),
            );
            if (match) {
              onPlaceLane(match);
              return;
            }
          } catch {
            // fall through
          }
        }
        setError(err instanceof Error ? err.message : t("designer.messages.laneAddFailed"));
      }
    },
    [
      inventoryMutations.createPlacementDomain,
      onPlaceLane,
      placementDomains,
      platformDomainsQuery,
      t,
    ],
  );

  const availableLaneDomains = useMemo(
    () => domainsWithoutLane(placementDomains, nodes),
    [placementDomains, nodes],
  );

  const rehydrateHaproxyGroup = useCallback(
    async (
      link: LinkedHaproxyGroup,
      options?: {
        snapshot?: HaproxyConfigSnapshot;
        force?: boolean;
        /** Wait one frame so a just-dropped skeleton is in graphRef. */
        waitRaf?: boolean;
        silent?: boolean;
      },
    ) => {
      if (inFlightRef.current.has(link.groupId) && !options?.force) return;
      inFlightRef.current.add(link.groupId);
      setNodes((current) => setGroupHydrating(current, link.groupId, true));
      try {
        const snapshot =
          options?.snapshot ?? (await fetchHaproxyConfigSnapshot(link.serviceId));
        if (options?.waitRaf) {
          await new Promise<void>((resolve) => {
            requestAnimationFrame(() => resolve());
          });
        }
        const { nodes: currentNodes, edges: currentEdges } = graphRef.current;
        const result = applySnapshotToGroup(currentNodes, currentEdges, link, snapshot);
        if (!result) {
          setNodes((current) => setGroupHydrating(current, link.groupId, false));
          return;
        }
        setNodes(result.nodes);
        setEdges(result.edges);
        fingerprintsRef.current.set(link.serviceId, result.fingerprint);
        setMessage(
          t(
            options?.silent
              ? "designer.messages.synced"
              : "designer.messages.hydrated",
            { label: link.label },
          ),
        );
        setError(null);
      } catch (err) {
        setNodes((current) => setGroupHydrating(current, link.groupId, false));
        setError(
          err instanceof Error ? err.message : t("designer.messages.hydrateFailed"),
        );
      } finally {
        inFlightRef.current.delete(link.groupId);
      }
    },
    [t],
  );

  const applyDomainFromLocalLb = useCallback(
    (groupId: string) => {
      const raw = platformDomainsQuery.data ?? [];
      const linked =
        localLb?.site_id != null
          ? raw.find((d) => d.site_id === localLb.site_id)
          : undefined;
      const domain = linked
        ? fromPlatformRecord(linked)
        : domainForLocalLbSite(placementDomains, {
            siteId: localLb?.site_id,
            siteName: localSite?.name,
          });
      if (!domain) return;
      setNodes((nds) => {
        const patched = nds.map((n) =>
          n.id === groupId
            ? {
                ...n,
                data: {
                  ...n.data,
                  placementDomainId: domain.id,
                  placementDomain: domain.name,
                },
              }
            : n,
        );
        return moveGroupToDomainLane(patched, groupId);
      });
    },
    [
      localLb?.site_id,
      localSite?.name,
      placementDomains,
      platformDomainsQuery.data,
    ],
  );

  const onHydratableInstanceDropped = useCallback(
    (info: {
      groupId: string;
      serviceId: string;
      serviceType: string;
      label: string;
      catalogSlug?: string;
      brand?: LinkedHaproxyGroup["brand"];
    }) => {
      if (!designerCapabilities(info.serviceType).canHydrate) return;
      // HAProxy is the only hydrate adapter registered today.
      applyDomainFromLocalLb(info.groupId);
      void rehydrateHaproxyGroup(info, { waitRaf: true });
    },
    [applyDomainFromLocalLb, rehydrateHaproxyGroup],
  );

  const onRefreshFromInstance = useCallback(() => {
    if (!selectedNode || selectedNode.data.kind !== "group.frame") return;
    if (!selectedNode.data.serviceId) return;
    if (!designerCapabilities(selectedNode.data.serviceType).canHydrate) return;
    void rehydrateHaproxyGroup(
      {
        groupId: selectedNode.id,
        serviceId: selectedNode.data.serviceId,
        label: selectedNode.data.label,
        catalogSlug: selectedNode.data.catalogSlug,
        brand: selectedNode.data.brand,
      },
      { force: true },
    );
  }, [rehydrateHaproxyGroup, selectedNode]);

  const onLinkedConfigChanged = useCallback(
    (link: LinkedHaproxyGroup, snapshot: HaproxyConfigSnapshot) => {
      void rehydrateHaproxyGroup(link, { snapshot, silent: true });
    },
    [rehydrateHaproxyGroup],
  );

  useLinkedHaproxySync({
    nodes,
    fingerprintsRef,
    inFlightRef,
    onConfigChanged: onLinkedConfigChanged,
    enabled: Boolean(flowId) && haproxySyncReady,
  });

  const applyNodeDeletion = useCallback(
    (groupIds: string[], otherIds: string[], deleteGroupContents: boolean) => {
      const { nodes: afterGroups, removedIds } = deleteGroups(
        nodes,
        groupIds,
        deleteGroupContents,
      );
      const otherSet = new Set(otherIds);
      const allRemoved = new Set([...removedIds, ...otherSet]);
      setNodes(afterGroups.filter((n) => !otherSet.has(n.id)));
      setEdges((eds) =>
        eds.filter((e) => !allRemoved.has(e.source) && !allRemoved.has(e.target)),
      );
      setSelectedNode(null);
      setSelectedNodes([]);
      setSelectedEdge(null);
      setGroupDeletePrompt(null);
      setMessage(
        deleteGroupContents
          ? t("designer.messages.groupDeletedWithNodes")
          : t("designer.messages.groupDeletedKeepNodes"),
      );
    },
    [nodes, t],
  );

  const deleteSelection = useCallback(() => {
    if (selectedEdge) {
      setEdges((eds) => eds.filter((e) => e.id !== selectedEdge.id));
      setSelectedEdge(null);
      return;
    }
    const selected =
      selectedNodes.length > 0 ? selectedNodes : selectedNode ? [selectedNode] : [];
    if (selected.length === 0) return;

    const groupIds = selected.filter(isGroupNode).map((n) => n.id);
    const otherIds = selected.filter((n) => !isGroupNode(n)).map((n) => n.id);

    if (groupIds.length > 0) {
      setGroupDeletePrompt({ groupIds, otherIds });
      return;
    }

    const ids = new Set(otherIds);
    setNodes((nds) => {
      const byId = new Map(nds.map((n) => [n.id, n]));
      return nds
        .filter((n) => !ids.has(n.id))
        .map((n) => {
          if (!n.parentId || !ids.has(n.parentId)) return n;
          const parent = byId.get(n.parentId);
          if (!parent || !isLaneNode(parent) || !isGroupNode(n)) return n;
          const abs = absolutePosition(n, byId);
          return { ...n, parentId: undefined, extent: undefined, position: abs };
        });
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
    preserveLocalGraphRef.current = true;
    try {
      const updated = await updateMutation.mutateAsync({
        name: name.trim() || undefined,
        graph_json: serializeGraphDocument({ nodes, edges, viewport, placementDomains }),
      });
      loadedStampRef.current = `${updated.id}:${updated.updated_at}`;
      setSavedFingerprint(designFingerprint(name, nodes, edges, placementDomains));
      setMessage(t("designer.messages.saved"));
    } catch (err) {
      preserveLocalGraphRef.current = false;
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
    if (issues.length === 0) {
      setMessage(t("designer.messages.validateOk"));
    } else {
      setMessage(t("designer.messages.validateIssues", { count: issues.length }));
    }
  };

  const onPreview = () => {
    setApplySuggestions([]);
    const catalog = nodes.filter((n) => n.data.kind === "catalog.service").length;
    const refs = nodes.filter((n) => n.data.kind === "instance.ref").length;
    const vipCount = nodes.filter((n) => n.data.kind === "vip.ref").length;
    setMessage(
      t("designer.previewSummary", {
        catalog,
        refs,
        vips: vipCount,
        edges: edges.length,
      }),
    );
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
      preserveLocalGraphRef.current = true;
      try {
        const updated = await updateMutation.mutateAsync({
          name: name.trim() || undefined,
          graph_json: serializeGraphDocument({ nodes, edges, viewport, placementDomains }),
        });
        loadedStampRef.current = `${updated.id}:${updated.updated_at}`;
      } catch (err) {
        preserveLocalGraphRef.current = false;
        setError(err instanceof Error ? err.message : t("designer.messages.saveFailed"));
        return;
      }
    }
    const suggestions = buildApplySuggestions(nodes, instances);
    setApplySuggestions(suggestions);
    setSavedFingerprint(designFingerprint(name, nodes, edges, placementDomains));
    setMessage(t("designer.messages.applyReady"));
  };

  const dirty = useMemo(() => {
    if (!flowId || savedFingerprint == null) return false;
    return designFingerprint(name, nodes, edges, placementDomains) !== savedFingerprint;
  }, [flowId, savedFingerprint, name, nodes, edges, placementDomains]);

  const dismissToast = useCallback(() => {
    setMessage(null);
    setError(null);
  }, []);

  const dismissFeedbackPanel = useCallback(() => {
    setValidationIssues([]);
    setApplySuggestions([]);
  }, []);

  useEffect(() => {
    if (validationIssues.length === 0 && applySuggestions.length === 0) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Element && target.closest("[data-designer-feedback-panel]")) {
        return;
      }
      dismissFeedbackPanel();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") dismissFeedbackPanel();
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [validationIssues.length, applySuggestions.length, dismissFeedbackPanel]);

  const toast =
    error != null
      ? { message: error, tone: "error" as const, icon: "error" as const }
      : message != null
        ? {
            message,
            tone: "ok" as const,
            icon:
              message === t("designer.messages.saved") ||
              message === t("designer.messages.applyReady")
                ? ("save" as const)
                : message === t("designer.messages.validateOk")
                  ? ("success" as const)
                  : ("info" as const),
          }
        : null;

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
          <button
            type="button"
            className="inline-flex size-9 items-center justify-center border border-line text-ink hover:border-accent hover:text-accent"
            onClick={toggleFullWidth}
            aria-pressed={fullWidth}
            aria-label={
              fullWidth ? t("designer.constrainedWidth") : t("designer.fullWidth")
            }
            title={fullWidth ? t("designer.constrainedWidth") : t("designer.fullWidth")}
          >
            {fullWidth ? <IconConstrainWidth /> : <IconExpandWidth />}
          </button>
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
          <div className="relative flex min-h-0 flex-1 overflow-hidden rounded-md border border-line">
            {toast ? (
              <DesignerToast
                message={toast.message}
                tone={toast.tone}
                icon={toast.icon}
                onDismiss={dismissToast}
              />
            ) : null}
            {(validationIssues.length > 0 || applySuggestions.length > 0) && (
              <div
                data-designer-feedback-panel
                className="absolute top-12 right-3 left-3 z-[30] max-h-36 space-y-2 overflow-y-auto border border-line bg-paper-elevated p-3 text-sm shadow-lg sm:left-auto sm:w-[28rem]"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1 space-y-2">
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
                  <button
                    type="button"
                    className="shrink-0 px-1 text-lg leading-none text-ink-muted hover:text-ink"
                    onClick={dismissFeedbackPanel}
                    aria-label={t("common.close")}
                  >
                    ×
                  </button>
                </div>
              </div>
            )}
            <CatalogPalette instances={instances} vips={vips} />
            <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-paper">
              <MutationGate hide className="w-full shrink-0">
                <DesignerToolbar
                  saving={updateMutation.isPending}
                  dirty={dirty}
                  designName={name}
                  onDesignNameChange={setName}
                  canGroup={canGroup}
                  canUngroup={canUngroup}
                  layoutPrefs={layoutPrefs}
                  onLayoutPrefsChange={onLayoutPrefsChange}
                  onRunLayout={(kind) => void onRunLayout(kind)}
                  layoutBusy={layoutBusy}
                  onSave={() => void onSave()}
                  onValidate={onValidate}
                  onPreview={onPreview}
                  onGroup={onGroup}
                  onUngroup={onUngroup}
                  onApply={() => void onApply()}
                  onDelete={() => void onDelete()}
                  availableLaneDomains={availableLaneDomains}
                  onAddLaneFromDomain={onPlaceLane}
                  onCreateLaneDomain={(kind) => void onCreateLaneDomain(kind)}
                />
              </MutationGate>
              <div className="min-h-0 flex-1">
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
                  snapToGrid={layoutPrefs.snapToGrid}
                  fitViewNonce={fitViewNonce}
                  onHydratableInstanceDropped={(info) => onHydratableInstanceDropped(info)}
                />
              </div>
            </div>
            <DesignerPropertiesPanel
              selectedNode={selectedNode}
              selectedEdge={selectedEdge}
              instances={instances}
              vips={vips}
              placementDomains={placementDomains}
              applianceSiteName={localSite?.name}
              applianceDomainId={
                localLb?.site_id
                  ? (platformDomainsQuery.data ?? []).find((d) => d.site_id === localLb.site_id)?.id
                  : undefined
              }
              onRefreshFromInstance={onRefreshFromInstance}
              onCreatePlacementDomain={(name, nodeId) => {
                void (async () => {
                  try {
                    const created = await inventoryMutations.createPlacementDomain.mutateAsync({
                      name,
                      kind: /shared/i.test(name) ? "shared" : "site",
                    });
                    const domain = fromPlatformRecord(created);
                    setPlacementDomains((ds) =>
                      ds.some((d) => d.id === domain.id) ? ds : [...ds, domain],
                    );
                    setNodes((nds) => {
                      const patched = nds.map((n) =>
                        n.id === nodeId
                          ? {
                              ...n,
                              data: {
                                ...n.data,
                                placementDomainId: domain.id,
                                placementDomain: domain.name,
                              },
                            }
                          : n,
                      );
                      return moveGroupToDomainLane(patched, nodeId);
                    });
                    setSelectedNode((prev) =>
                      prev && prev.id === nodeId
                        ? {
                            ...prev,
                            data: {
                              ...prev.data,
                              placementDomainId: domain.id,
                              placementDomain: domain.name,
                            },
                          }
                        : prev,
                    );
                  } catch (err) {
                    setError(
                      err instanceof Error ? err.message : t("designer.messages.domainSaveFailed"),
                    );
                  }
                })();
              }}
              onUpsertPlacementDomain={(domain) => {
                void (async () => {
                  const previousId = domain.id;
                  try {
                    const existsOnPlatform = platformDomains.some((d) => d.id === domain.id);
                    const saved = existsOnPlatform
                      ? await inventoryMutations.updatePlacementDomain.mutateAsync({
                          id: domain.id,
                          payload: {
                            name: domain.name,
                            kind: domain.kind,
                            description: domain.description ?? null,
                            icon: domain.icon ?? null,
                          },
                        })
                      : await inventoryMutations.createPlacementDomain.mutateAsync({
                          name: domain.name,
                          kind: domain.kind,
                          description: domain.description ?? null,
                          icon: domain.icon ?? null,
                        });
                    const next = fromPlatformRecord(saved);
                    setPlacementDomains((ds) => {
                      const withoutPrev = ds.filter(
                        (d) => d.id !== previousId && d.id !== next.id,
                      );
                      return [...withoutPrev, next];
                    });
                    setNodes((nds) =>
                      nds.map((n) => {
                        if (
                          n.data.placementDomainId !== previousId &&
                          n.data.placementDomainId !== next.id
                        ) {
                          return n;
                        }
                        if (n.data.kind === "placement.lane") {
                          return {
                            ...n,
                            data: {
                              ...n.data,
                              label: next.name,
                              placementDomainId: next.id,
                              placementDomain: next.name,
                              placementKind: next.kind,
                              placementDescription: next.description,
                              placementIcon: next.icon,
                            },
                          };
                        }
                        return {
                          ...n,
                          data: {
                            ...n.data,
                            placementDomainId: next.id,
                            placementDomain: next.name,
                          },
                        };
                      }),
                    );
                    setSelectedNode((prev) =>
                      prev &&
                      (prev.data.placementDomainId === previousId ||
                        prev.data.placementDomainId === next.id)
                        ? {
                            ...prev,
                            data: {
                              ...prev.data,
                              label:
                                prev.data.kind === "placement.lane" ? next.name : prev.data.label,
                              placementDomainId: next.id,
                              placementDomain: next.name,
                              placementKind: next.kind,
                              placementDescription: next.description,
                              placementIcon: next.icon,
                            },
                          }
                        : prev,
                    );
                  } catch (err) {
                    setError(
                      err instanceof Error ? err.message : t("designer.messages.domainSaveFailed"),
                    );
                  }
                })();
              }}
              onAssignPlacementDomain={(nodeId, domainId) => {
                const domain = domainId
                  ? placementDomains.find((d) => d.id === domainId)
                  : undefined;
                setNodes((nds) => {
                  const patched = nds.map((n) =>
                    n.id === nodeId
                      ? {
                          ...n,
                          data: {
                            ...n.data,
                            placementDomainId: domainId,
                            placementDomain: domain?.name,
                          },
                        }
                      : n,
                  );
                  const node = patched.find((n) => n.id === nodeId);
                  if (node && isGroupNode(node)) {
                    return moveGroupToDomainLane(patched, nodeId);
                  }
                  return patched;
                });
                setSelectedNode((prev) =>
                  prev && prev.id === nodeId
                    ? {
                        ...prev,
                        data: {
                          ...prev.data,
                          placementDomainId: domainId,
                          placementDomain: domain?.name,
                        },
                      }
                    : prev,
                );
              }}
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

      {groupDeletePrompt ? (
        <DeleteGroupDialog
          groupCount={groupDeletePrompt.groupIds.length}
          onCancel={() => setGroupDeletePrompt(null)}
          onConfirm={(deleteNodesInside) =>
            applyNodeDeletion(
              groupDeletePrompt.groupIds,
              groupDeletePrompt.otherIds,
              deleteNodesInside,
            )
          }
        />
      ) : null}
    </div>
  );
}
