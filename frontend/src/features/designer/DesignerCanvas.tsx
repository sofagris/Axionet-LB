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
import { DesignerGroupNode } from "./DesignerGroupNode";
import { buildDropGraph } from "./buildDropGraph";
import {
  DESIGNER_DND_MIME,
  newEdgeId,
  type DesignerEdge,
  type DesignerNode,
  type DesignerNodeData,
  type PaletteDragPayload,
} from "./types";

const nodeTypes: NodeTypes = {
  designer: DesignerFlowNode,
  designerGroup: DesignerGroupNode,
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
    nodes: DesignerNode[];
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
      const typed = selNodes as DesignerNode[];
      onSelectionChange({
        nodes: typed,
        node: typed[typed.length - 1] ?? null,
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
      const drop = buildDropGraph(position, payload);
      onNodes([...nodes, ...drop.nodes]);
      if (drop.edges.length > 0) {
        onEdges((eds) => [...eds, ...drop.edges]);
      }
    },
    [nodes, onEdges, onNodes, screenToFlowPosition],
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
        multiSelectionKeyCode={["Meta", "Control", "Shift"]}
        defaultEdgeOptions={defaultEdgeOptions}
        proOptions={{ hideAttribution: true }}
        deleteKeyCode={null}
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
