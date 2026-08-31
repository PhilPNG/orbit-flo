import {
  addEdge,
  applyEdgeChanges,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { clsx } from "clsx";
import {
  memo,
  useCallback,
  useMemo,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";
import type { MindMapView } from "../../lib/supabase/database.types";
import { createConnectedNode, createNodeAt, createSiblingNode, nodeAccentColor, nodeShape } from "./map-graph-ops";
import { applyViewLayout } from "./map-layouts";
import { StarNode, type StarNodeData } from "./map-star-node";
import { StarlightEdge } from "./map-starlight-edge";
import type { EditableMapEdge, EditableMapGraph, EditableMapNode } from "./map-types";

type MapCanvasProps = {
  graph: EditableMapGraph;
  selectedNodeId: string | null;
  view: MindMapView;
  onChange: (graph: EditableMapGraph) => void;
  onSelectNode: (nodeId: string | null) => void;
};

const nodeTypes = { star: StarNode };
const edgeTypes = { starlight: StarlightEdge };
const fitViewOptions = { padding: 0.32, minZoom: 0.55, maxZoom: 1.15 };
const proOptions = { hideAttribution: true };

function toFlowNode(
  node: EditableMapNode,
  selectedNodeId: string | null,
  renamingNodeId: string | null,
  onRenameCommit: (nodeId: string, title: string) => void,
  onRenameCancel: () => void,
): Node<StarNodeData> {
  return {
    id: node.id,
    type: "star",
    position: node.position,
    data: {
      label: node.title,
      accent: nodeAccentColor(node.nodeType),
      shape: nodeShape(node.nodeType),
      isConverted: node.status === "converted",
      isRenaming: node.id === renamingNodeId,
      onRenameCommit: (title: string) => onRenameCommit(node.id, title),
      onRenameCancel,
    },
    selected: node.id === selectedNodeId,
    className: clsx(
      "orbit-map-node",
      node.id === selectedNodeId && "orbit-map-node-selected",
    ),
  };
}

function toFlowEdge(edge: EditableMapGraph["edges"][number]): Edge {
  return {
    id: edge.id,
    source: edge.sourceNodeId,
    target: edge.targetNodeId,
    label: edge.label || undefined,
    animated: false,
    type: "starlight",
    className: edge.edgeType === "sequence" ? "orbit-map-edge-sequence" : "orbit-map-edge",
  };
}

function createEdgeId(source: string, target: string, existingIds: Set<string>, preferredId?: string | null) {
  const baseId = preferredId || `${source}-${target}`;
  if (!existingIds.has(baseId)) return baseId;

  let index = 2;
  let nextId = `${baseId}-${index}`;
  while (existingIds.has(nextId)) {
    index += 1;
    nextId = `${baseId}-${index}`;
  }
  return nextId;
}

function createRandomEdgeId(existingIds: Set<string>) {
  let edgeId = crypto.randomUUID();

  while (existingIds.has(edgeId)) {
    edgeId = crypto.randomUUID();
  }

  return edgeId;
}

function toGraphEdges(flowEdges: Edge[], graphEdges: EditableMapEdge[]) {
  const usedIds = new Set<string>();
  const graphEdgesById = new Map(graphEdges.map((edge) => [edge.id, edge]));

  return flowEdges.reduce<EditableMapEdge[]>((nextEdges, flowEdge) => {
    if (!flowEdge.source || !flowEdge.target) return nextEdges;

    const existingEdge = graphEdgesById.get(flowEdge.id);
    const id = createEdgeId(flowEdge.source, flowEdge.target, usedIds, flowEdge.id);
    usedIds.add(id);

    nextEdges.push({
      id,
      sourceNodeId: flowEdge.source,
      targetNodeId: flowEdge.target,
      edgeType: existingEdge?.edgeType ?? "association",
      label: existingEdge?.label ?? "",
      isDirectional: existingEdge?.isDirectional ?? false,
    });

    return nextEdges;
  }, []);
}

function MapCanvasInner({ graph, selectedNodeId, view, onChange, onSelectNode }: MapCanvasProps) {
  const [renamingNodeId, setRenamingNodeId] = useState<string | null>(null);
  const { screenToFlowPosition } = useReactFlow();

  const handleRenameCommit = useCallback((nodeId: string, title: string) => {
    setRenamingNodeId(null);
    onChange({
      ...graph,
      nodes: graph.nodes.map((node) => (node.id === nodeId ? { ...node, title } : node)),
    });
  }, [graph, onChange]);

  const handleRenameCancel = useCallback(() => setRenamingNodeId(null), []);

  const canvasNodes = useMemo(
    () => (view === "mind_map" ? graph.nodes : applyViewLayout(view, graph.nodes)),
    [graph.nodes, view],
  );
  const nodes = useMemo(
    () =>
      canvasNodes.map((node) =>
        toFlowNode(node, selectedNodeId, renamingNodeId, handleRenameCommit, handleRenameCancel),
      ),
    [canvasNodes, selectedNodeId, renamingNodeId, handleRenameCommit, handleRenameCancel],
  );
  const edges = useMemo(() => graph.edges.map(toFlowEdge), [graph.edges]);

  const handleCanvasDoubleClick = useCallback((event: ReactMouseEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest(".react-flow__node")) return;

    const id = crypto.randomUUID();
    const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
    onChange(createNodeAt(graph, position, id));
    onSelectNode(id);
    setRenamingNodeId(id);
  }, [graph, onChange, onSelectNode, screenToFlowPosition]);

  const handleNodeDoubleClick = useCallback((_: unknown, node: Node) => {
    setRenamingNodeId(node.id);
  }, []);

  const handleCanvasKeyDown = useCallback((event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (!selectedNodeId) return;
    const target = event.target as HTMLElement;
    if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;
    if (event.key !== "Tab" && event.key !== "Enter") return;

    event.preventDefault();
    const nodeId = crypto.randomUUID();
    const edgeId = crypto.randomUUID();
    const nextGraph =
      event.key === "Tab"
        ? createConnectedNode(graph, selectedNodeId, nodeId, edgeId)
        : createSiblingNode(graph, selectedNodeId, nodeId, edgeId);

    if (nextGraph === graph) return;
    onChange(nextGraph);
    onSelectNode(nodeId);
    setRenamingNodeId(nodeId);
  }, [graph, onChange, onSelectNode, selectedNodeId]);

  const handleNodesChange = useCallback((changes: NodeChange[]) => {
    const movedPositions = new Map<string, { x: number; y: number }>();
    const movedNodeIds = new Set<string>();
    const removedNodeIds = new Set<string>();

    changes.forEach((change) => {
      if (view === "mind_map" && change.type === "position" && change.position) {
        movedNodeIds.add(change.id);
        movedPositions.set(change.id, change.position);
      }
      if (change.type === "remove") {
        removedNodeIds.add(change.id);
      }
    });

    if (movedNodeIds.size === 0 && removedNodeIds.size === 0) return;

    onChange({
      ...graph,
      nodes: graph.nodes
        .filter((node) => !removedNodeIds.has(node.id))
        .map((node) => {
          const position = movedPositions.get(node.id);
          return position && movedNodeIds.has(node.id) ? { ...node, position } : node;
      }),
      edges: graph.edges.filter((edge) => !removedNodeIds.has(edge.sourceNodeId) && !removedNodeIds.has(edge.targetNodeId)),
    });
  }, [graph, onChange, view]);

  const handleEdgesChange = useCallback((changes: EdgeChange[]) => {
    const nextFlowEdges = applyEdgeChanges(changes, edges);

    onChange({
      ...graph,
      edges: toGraphEdges(nextFlowEdges, graph.edges),
    });
  }, [edges, graph, onChange]);

  const handleConnect = useCallback((connection: Connection) => {
    if (!connection.source || !connection.target) return;
    if (connection.source === connection.target) return;

    const existingIds = new Set(graph.edges.map((edge) => edge.id));
    const edgeId = createRandomEdgeId(existingIds);
    const nextFlowEdges = addEdge({ ...connection, id: edgeId }, edges);

    onChange({
      ...graph,
      edges: toGraphEdges(nextFlowEdges, graph.edges),
    });
  }, [edges, graph, onChange]);

  const handleNodeClick = useCallback((_: unknown, node: Node) => onSelectNode(node.id), [onSelectNode]);
  const handlePaneClick = useCallback(() => onSelectNode(null), [onSelectNode]);

  return (
    <div
      aria-label="Visual planning canvas"
      className="orbit-constellation-canvas h-[max(32rem,calc(100vh-15rem))] overflow-hidden rounded-lg border border-white/10"
      onDoubleClick={handleCanvasDoubleClick}
      onKeyDown={handleCanvasKeyDown}
      role="application"
      tabIndex={0}
    >
      <ReactFlow
        className="orbit-constellation-flow"
        edgeTypes={edgeTypes}
        edges={edges}
        fitView
        fitViewOptions={fitViewOptions}
        nodes={nodes}
        nodeTypes={nodeTypes}
        onConnect={handleConnect}
        onEdgesChange={handleEdgesChange}
        onNodeClick={handleNodeClick}
        onNodeDoubleClick={handleNodeDoubleClick}
        onNodesChange={handleNodesChange}
        onPaneClick={handlePaneClick}
        proOptions={proOptions}
        zoomOnDoubleClick={false}
      >
        <Background color="rgba(148, 163, 184, 0.18)" gap={32} size={1} variant={BackgroundVariant.Dots} />
        <MiniMap bgColor="var(--orbit-surface-quiet)" maskColor="rgba(2, 8, 23, 0.72)" nodeColor="#67e8f9" pannable />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}

export const MapCanvas = memo(function MapCanvas(props: MapCanvasProps) {
  return (
    <ReactFlowProvider>
      <MapCanvasInner {...props} />
    </ReactFlowProvider>
  );
});
