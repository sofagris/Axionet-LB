import { useCallback, useMemo, type DragEvent } from "react";
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  addEdge,
  type Connection,
  type Edge,
  type NodeTypes,
  type OnEdgesChange,
  type OnNodesChange,
  type OnSelectionChangeParams,
  type Viewport,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useReactFlow } from "@xyflow/react";
import { DesignerFlowNode } from "./DesignerNode";
import {
  DESIGNER_DND_MIME,
  newEdgeId,
  newNodeId,
  type DesignerEdge,
  type DesignerNode,
  type DesignerNodeData,
  type PaletteDragPayload,
} from "./types";

const nodeTypes: NodeTypes = {
  designer: DesignerFlowNode,
};

type Props = {
  nodes: DesignerNode[];
  edges: DesignerEdge[];
  onNodesChange: OnNodesChange<DesignerNode>;
  onEdgesChange: OnEdgesChange<DesignerEdge>;
  onNodes: (nodes: DesignerNode[]) => void;
  onEdges: (edges: DesignerEdge[] | ((prev: DesignerEdge[]) => DesignerEdge[])) => void;
  onViewportChange: (viewport: Viewport) => void;
  onSelectionChange: (selection: {
    node: DesignerNode | null;
    edge: DesignerEdge | null;
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
}: Props) {
  const { screenToFlowPosition } = useReactFlow();

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
      onSelectionChange({
        node: (selNodes[0] as DesignerNode | undefined) ?? null,
        edge: (selEdges[0] as DesignerEdge | undefined) ?? null,
      });
    },
    [onSelectionChange],
  );

  const onDragOver = useCallback((event: DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  }, []);

  const onDrop = useCallback(
    (event: DragEvent) => {
      event.preventDefault();
      const raw = event.dataTransfer.getData(DESIGNER_DND_MIME);
      if (!raw) return;
      let payload: PaletteDragPayload;
      try {
        payload = JSON.parse(raw) as PaletteDragPayload;
      } catch {
        return;
      }
      const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      let data: DesignerNodeData;
      if (payload.source === "catalog") {
        data = {
          kind: "catalog.service",
          label: payload.label,
          catalogId: payload.catalogId,
          catalogSlug: payload.catalogSlug,
          serviceType: payload.serviceType,
          catalogStatus: payload.catalogStatus,
          brand: payload.brand,
          comingSoon: payload.comingSoon,
        };
      } else if (payload.source === "instance") {
        data = {
          kind: "instance.ref",
          label: payload.label,
          serviceId: payload.serviceId,
          serviceType: payload.serviceType,
          catalogSlug: payload.catalogSlug,
          brand: payload.brand,
        };
      } else {
        data = {
          kind: "vip.ref",
          label: payload.label,
          vipId: payload.vipId,
          note: payload.address,
        };
      }
      const node: DesignerNode = {
        id: newNodeId(),
        type: "designer",
        position,
        data,
      };
      onNodes([...nodes, node]);
    },
    [nodes, onNodes, screenToFlowPosition],
  );

  const defaultEdgeOptions = useMemo(
    () => ({
      animated: false,
    }),
    [],
  );

  return (
    <div className="h-full w-full" onDragOver={onDragOver} onDrop={onDrop}>
      <ReactFlow
        nodes={nodes}
        edges={edges as Edge[]}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onSelectionChange={onSelectionChangeInternal}
        onMoveEnd={(_, vp) => onViewportChange(vp)}
        nodeTypes={nodeTypes}
        fitView
        defaultEdgeOptions={defaultEdgeOptions}
        proOptions={{ hideAttribution: true }}
        deleteKeyCode={["Backspace", "Delete"]}
      >
        <Background gap={16} size={1} />
        <Controls />
        <MiniMap pannable zoomable />
      </ReactFlow>
    </div>
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
  return nodes.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, ...patch } } : n));
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
