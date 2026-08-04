import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent, type MouseEvent } from "react";
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  addEdge,
  type Connection,
  type Edge,
  type Node,
  type NodeTypes,
  type OnEdgesChange,
  type OnNodesChange,
  type OnSelectionChangeParams,
  type Viewport,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useReactFlow } from "@xyflow/react";
import { useTranslation } from "react-i18next";
import { useTheme } from "../theme/ThemeProvider";
import { DesignerFlowNode } from "./DesignerNode";
import { DesignerGroupNode } from "./DesignerGroupNode";
import { DesignerLaneNode } from "./DesignerLaneNode";
import { DesignerDropTargetContext } from "./DesignerDropTargetContext";
import { buildDropGraph } from "./buildDropGraph";
import {
  addGroupToLane,
  addNodeToGroup,
  isGroupNode,
  isLaneNode,
  listGroups,
  listLanes,
  placeDropNodes,
  removeGroupFromLane,
  removeNodeFromGroup,
} from "./grouping";
import { getActivePaletteDrag, setActivePaletteDrag } from "./paletteDrag";
import { resolvePaletteDropTarget } from "./paletteDropTarget";
import { designerCapabilities } from "./serviceCapabilities";
import {
  DESIGNER_DND_MIME,
  newEdgeId,
  type DesignerEdge,
  type DesignerNode,
  type DesignerNodeData,
  type PaletteDragPayload,
} from "./types";

function minimapNodeColor(node: Node): string {
  const data = (node as DesignerNode).data;
  if (data?.fillColor) return data.fillColor;
  if (node.type === "designerLane") return "var(--ax-line)";
  if (node.type === "designerGroup") return "var(--ax-accent)";
  return "var(--ax-ink-muted)";
}

const nodeTypes: NodeTypes = {
  designer: DesignerFlowNode,
  designerGroup: DesignerGroupNode,
  designerLane: DesignerLaneNode,
};

type ContextMenuState = {
  x: number;
  y: number;
  node: DesignerNode;
};

type Props = {
  nodes: DesignerNode[];
  edges: DesignerEdge[];
  onNodesChange: OnNodesChange<DesignerNode>;
  onEdgesChange: OnEdgesChange<DesignerEdge>;
  onNodes: (nodes: DesignerNode[] | ((prev: DesignerNode[]) => DesignerNode[])) => void;
  onEdges: (edges: DesignerEdge[] | ((prev: DesignerEdge[]) => DesignerEdge[])) => void;
  onViewportChange: (viewport: Viewport) => void;
  onSelectionChange: (selection: {
    nodes: DesignerNode[];
    node: DesignerNode | null;
    edge: DesignerEdge | null;
  }) => void;
  snapToGrid?: boolean;
  /** Increment to trigger fitView after layout. */
  fitViewNonce?: number;
  /** Fired after a hydratable instance tree skeleton is placed — parent should hydrate from API. */
  onHydratableInstanceDropped?: (info: {
    groupId: string;
    serviceId: string;
    serviceType: string;
    label: string;
    catalogSlug?: string;
    brand?: DesignerNodeData["brand"];
  }) => void;
};

function DesignerCanvasInner({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onNodes,
  onEdges,
  onViewportChange,
  onSelectionChange,
  snapToGrid = false,
  fitViewNonce = 0,
  onHydratableInstanceDropped,
}: Props) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { screenToFlowPosition, fitView } = useReactFlow();
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const nodesRef = useRef(nodes);
  const dragPointerRef = useRef({ x: 0, y: 0 });
  const dragRafRef = useRef(0);

  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  useEffect(() => {
    if (!fitViewNonce) return;
    void fitView({ padding: 0.15, duration: 200 });
  }, [fitViewNonce, fitView]);

  const clearDropHighlight = useCallback(() => {
    setDropTargetId(null);
    setActivePaletteDrag(null);
    if (dragRafRef.current) {
      cancelAnimationFrame(dragRafRef.current);
      dragRafRef.current = 0;
    }
  }, []);

  useEffect(() => {
    const onDragEnd = () => clearDropHighlight();
    window.addEventListener("dragend", onDragEnd);
    return () => window.removeEventListener("dragend", onDragEnd);
  }, [clearDropHighlight]);

  const onConnect = useCallback(
    (connection: Connection) => {
      onEdges((eds) =>
        addEdge(
          {
            ...connection,
            id: newEdgeId(),
            data: { protocol: "" },
          },
          eds,
        ) as DesignerEdge[],
      );
    },
    [onEdges],
  );

  const onSelectionChangeInternal = useCallback(
    ({ nodes: selNodes, edges: selEdges }: OnSelectionChangeParams) => {
      const typed = selNodes as DesignerNode[];
      onSelectionChange({
        nodes: typed,
        node: typed[typed.length - 1] ?? null,
        edge: (selEdges[0] as DesignerEdge | undefined) ?? null,
      });
    },
    [onSelectionChange],
  );

  const onDragOver = useCallback(
    (event: DragEvent) => {
      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";
      dragPointerRef.current = { x: event.clientX, y: event.clientY };
      if (dragRafRef.current) return;
      dragRafRef.current = requestAnimationFrame(() => {
        dragRafRef.current = 0;
        const payload = getActivePaletteDrag();
        if (!payload) {
          setDropTargetId(null);
          return;
        }
        const flowPos = screenToFlowPosition(dragPointerRef.current);
        const target = resolvePaletteDropTarget(nodesRef.current, flowPos, payload);
        setDropTargetId(target?.id ?? null);
      });
    },
    [screenToFlowPosition],
  );

  const onDragLeave = useCallback((event: DragEvent) => {
    // Leaving the canvas wrapper (not entering a child) clears the highlight.
    const related = event.relatedTarget;
    if (related instanceof globalThis.Node && event.currentTarget.contains(related)) return;
    setDropTargetId(null);
  }, []);

  const onDrop = useCallback(
    (event: DragEvent) => {
      event.preventDefault();
      setContextMenu(null);
      setDropTargetId(null);
      const raw = event.dataTransfer.getData(DESIGNER_DND_MIME);
      setActivePaletteDrag(null);
      if (!raw) return;
      let payload: PaletteDragPayload;
      try {
        payload = JSON.parse(raw) as PaletteDragPayload;
      } catch {
        return;
      }
      const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      const drop = buildDropGraph(position, payload);
      let placedGroupId: string | null = null;
      const dropServiceType =
        payload.source === "instance" ? payload.serviceType : undefined;
      const shouldHydrate =
        Boolean(dropServiceType) &&
        designerCapabilities(dropServiceType).canHydrate &&
        (payload.source === "instance"
          ? (payload.dropMode ?? "tree") === "tree"
          : false);
      onNodes((current) => {
        let next = placeDropNodes(current, drop.nodes, position);
        if (shouldHydrate && payload.source === "instance") {
          const group = next.find(
            (n) =>
              n.data.kind === "group.frame" &&
              n.data.serviceId === payload.serviceId &&
              drop.nodes.some((d) => d.id === n.id),
          );
          if (group) {
            placedGroupId = group.id;
            next = next.map((n) =>
              n.id === group.id ? { ...n, data: { ...n.data, hydrating: true } } : n,
            );
          }
        }
        return next;
      });
      if (drop.edges.length > 0) {
        onEdges((eds) => [...eds, ...drop.edges]);
      }

      if (
        placedGroupId &&
        shouldHydrate &&
        payload.source === "instance" &&
        onHydratableInstanceDropped
      ) {
        onHydratableInstanceDropped({
          groupId: placedGroupId,
          serviceId: payload.serviceId,
          serviceType: payload.serviceType,
          label: payload.label,
          catalogSlug: payload.catalogSlug,
          brand: payload.brand,
        });
      }
    },
    [onEdges, onHydratableInstanceDropped, onNodes, screenToFlowPosition],
  );

  const onNodeContextMenu = useCallback((event: MouseEvent, node: Node) => {
    event.preventDefault();
    // Lanes are containers only — no group membership actions apply.
    if (isLaneNode(node as DesignerNode)) {
      setContextMenu(null);
      return;
    }
    setContextMenu({
      x: event.clientX,
      y: event.clientY,
      node: node as DesignerNode,
    });
  }, []);

  const closeMenu = useCallback(() => setContextMenu(null), []);

  // Dismiss on any pointer outside the menu (nodes, edges, chrome, outside canvas).
  useEffect(() => {
    if (!contextMenu) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Element && target.closest("[data-designer-context-menu]")) {
        return;
      }
      setContextMenu(null);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setContextMenu(null);
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [contextMenu]);

  const groups = useMemo(() => listGroups(nodes), [nodes]);
  const lanes = useMemo(() => listLanes(nodes), [nodes]);
  const menuNode = contextMenu?.node;
  const canRemoveFromGroup = Boolean(
    menuNode && !isGroupNode(menuNode) && !isLaneNode(menuNode) && menuNode.parentId,
  );
  const canAddToGroup = Boolean(
    menuNode &&
      !isGroupNode(menuNode) &&
      !isLaneNode(menuNode) &&
      !menuNode.parentId &&
      groups.length > 0,
  );
  const menuParentIsLane = Boolean(
    menuNode?.parentId && nodes.some((n) => n.id === menuNode.parentId && isLaneNode(n)),
  );
  const canRemoveFromLane = Boolean(menuNode && isGroupNode(menuNode) && menuParentIsLane);
  const canAddToLane = Boolean(
    menuNode && isGroupNode(menuNode) && !menuParentIsLane && lanes.length > 0,
  );
  const canPin = Boolean(menuNode && menuNode.data.kind !== "placement.lane");
  const isPinned = Boolean(menuNode?.data.pinned);

  const defaultEdgeOptions = useMemo(
    () => ({
      animated: false,
      zIndex: 1001,
      interactionWidth: 24,
    }),
    [],
  );

  return (
    <DesignerDropTargetContext.Provider value={dropTargetId}>
      <div
        className="relative h-full w-full"
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        <ReactFlow
          nodes={nodes}
          edges={edges as Edge[]}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onSelectionChange={onSelectionChangeInternal}
          onNodeContextMenu={onNodeContextMenu}
          onPaneClick={closeMenu}
          onNodeClick={closeMenu}
          onEdgeClick={closeMenu}
          onMoveStart={closeMenu}
          onMoveEnd={(_, vp) => onViewportChange(vp)}
          nodeTypes={nodeTypes}
          fitView
          colorMode={theme}
          multiSelectionKeyCode={["Meta", "Control", "Shift"]}
          edgesFocusable
          elementsSelectable
          snapToGrid={snapToGrid}
          snapGrid={[16, 16]}
          defaultEdgeOptions={defaultEdgeOptions}
          proOptions={{ hideAttribution: true }}
          deleteKeyCode={null}
          className="designer-flow"
        >
          <Background gap={16} size={1} color="var(--ax-line)" />
          <Controls />
          <MiniMap
            pannable
            zoomable
            bgColor="var(--ax-paper-elevated)"
            maskColor="color-mix(in srgb, var(--ax-ink) 28%, transparent)"
            nodeColor={minimapNodeColor}
            nodeStrokeColor="var(--ax-line)"
            nodeBorderRadius={2}
          />
        </ReactFlow>

        {contextMenu && menuNode ? (
          <div
            data-designer-context-menu
            className="fixed z-[2000] min-w-[11rem] border border-line bg-paper-elevated py-1 text-sm shadow-lg"
            style={{ left: contextMenu.x, top: contextMenu.y }}
            role="menu"
          >
            {canPin ? (
              <button
                type="button"
                role="menuitem"
                className="block w-full px-3 py-1.5 text-left text-ink hover:bg-paper"
                onClick={() => {
                  onNodes((nds) =>
                    nds.map((n) =>
                      n.id === menuNode.id
                        ? { ...n, data: { ...n.data, pinned: !n.data.pinned } }
                        : n,
                    ),
                  );
                  closeMenu();
                }}
              >
                {isPinned ? t("designer.context.unpin") : t("designer.context.pin")}
              </button>
            ) : null}
            {canAddToGroup ? (
              <div className="border-b border-line px-1 pb-1 mb-1">
                <p className="px-2 py-1 font-mono text-[10px] tracking-wide text-ink-muted uppercase">
                  {t("designer.context.addToGroup")}
                </p>
                {groups.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    role="menuitem"
                    className="block w-full px-3 py-1.5 text-left text-ink hover:bg-paper"
                    onClick={() => {
                      onNodes((nds) => addNodeToGroup(nds, menuNode.id, g.id));
                      closeMenu();
                    }}
                  >
                    {g.data.label}
                  </button>
                ))}
              </div>
            ) : null}
            {canRemoveFromGroup ? (
              <button
                type="button"
                role="menuitem"
                className="block w-full px-3 py-1.5 text-left text-ink hover:bg-paper"
                onClick={() => {
                  onNodes((nds) => removeNodeFromGroup(nds, menuNode.id));
                  closeMenu();
                }}
              >
                {t("designer.context.removeFromGroup")}
              </button>
            ) : null}
            {canAddToLane ? (
              <div className="border-b border-line px-1 pb-1 mb-1">
                <p className="px-2 py-1 font-mono text-[10px] tracking-wide text-ink-muted uppercase">
                  {t("designer.context.addToLane")}
                </p>
                {lanes.map((lane) => (
                  <button
                    key={lane.id}
                    type="button"
                    role="menuitem"
                    className="block w-full px-3 py-1.5 text-left text-ink hover:bg-paper"
                    onClick={() => {
                      onNodes((nds) => addGroupToLane(nds, menuNode.id, lane.id));
                      closeMenu();
                    }}
                  >
                    {lane.data.label}
                  </button>
                ))}
              </div>
            ) : null}
            {canRemoveFromLane ? (
              <button
                type="button"
                role="menuitem"
                className="block w-full px-3 py-1.5 text-left text-ink hover:bg-paper"
                onClick={() => {
                  onNodes((nds) => removeGroupFromLane(nds, menuNode.id));
                  closeMenu();
                }}
              >
                {t("designer.context.removeFromLane")}
              </button>
            ) : null}
            {!canPin &&
            !canAddToGroup &&
            !canRemoveFromGroup &&
            !canAddToLane &&
            !canRemoveFromLane ? (
              <p className="px-3 py-2 text-xs text-ink-muted">{t("designer.context.noActions")}</p>
            ) : null}
          </div>
        ) : null}
      </div>
    </DesignerDropTargetContext.Provider>
  );
}

export function DesignerCanvas(props: Props) {
  return (
    <ReactFlowProvider>
      <DesignerCanvasInner {...props} />
    </ReactFlowProvider>
  );
}

export function patchNodeData(
  nodes: DesignerNode[],
  nodeId: string,
  patch: Partial<DesignerNodeData>,
): DesignerNode[] {
  return nodes.map((n) => {
    if (n.id !== nodeId) return n;
    const nextData = { ...n.data, ...patch };
    if (patch.props) {
      nextData.props = { ...(n.data.props ?? {}), ...patch.props };
    }
    return { ...n, data: nextData };
  });
}

export function patchEdgeData(
  edges: DesignerEdge[],
  edgeId: string,
  patch: Partial<DesignerEdge["data"]> & { label?: string },
): DesignerEdge[] {
  return edges.map((e) => {
    if (e.id !== edgeId) return e;
    const { label, ...dataPatch } = patch;
    return {
      ...e,
      label: label !== undefined ? label : e.label,
      data: { ...(e.data ?? {}), ...dataPatch },
    };
  });
}
