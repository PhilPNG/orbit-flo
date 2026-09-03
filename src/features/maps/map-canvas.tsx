import {
  addEdge,
  applyEdgeChanges,
  Background,
  BackgroundVariant,
  Controls,
  MarkerType,
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
  forwardRef,
  memo,
  useCallback,
  useImperativeHandle,
  useMemo,
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";
import {
  createConnectedNode,
  createNodeAt,
  createSiblingNode,
  deleteEdge,
  deleteNode,
  nodeAccentColor,
  nodeShape,
} from "./map-graph-ops";
import { StarNode, type StarNodeData } from "./map-star-node";
import { StarlightEdge } from "./map-starlight-edge";
import type { EditableMapEdge, EditableMapGraph, EditableMapNode } from "./map-types";
import type { MapSelection, SetGraphOptions } from "./use-map-editor";

export type MapCanvasHandle = {
  fitView: () => void;
  viewportCenter: () => { x: number; y: number };
};

export type MapCanvasProps = {
  graph: EditableMapGraph;
  selection: MapSelection;
  renamingNodeId: string | null;
  className?: string;
  onChange: (graph: EditableMapGraph, options?: SetGraphOptions) => void;
  onSelect: (selection: MapSelection) => void;
  onRenamingChange: (nodeId: string | null) => void;
};

const nodeTypes = { star: StarNode };
const edgeTypes = { starlight: StarlightEdge };
const fitViewOptions = { padding: 0.32, minZoom: 0.55, maxZoom: 1.15 };
const proOptions = { hideAttribution: true };
const arrowMarker = { type: MarkerType.ArrowClosed, color: "#67e8f9", width: 18, height: 18 };
const editableTags = new Set(["INPUT", "TEXTAREA", "SELECT"]);

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
    className: clsx("orbit-map-node", node.id === selectedNodeId && "orbit-map-node-selected"),
  };
}

function toFlowEdge(edge: EditableMapEdge, selectedEdgeId: string | null): Edge {
  return {
    id: edge.id,
    source: edge.sourceNodeId,
    target: edge.targetNodeId,
    label: edge.label || undefined,
    animated: false,
    type: "starlight",
    selected: edge.id === selectedEdgeId,
    markerEnd: edge.isDirectional ? arrowMarker : undefined,
    className: clsx(
      edge.edgeType === "sequence" ? "orbit-map-edge-sequence" : "orbit-map-edge",
      edge.id === selectedEdgeId && "orbit-map-edge-selected",
    ),
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
  while (existingIds.has(edgeId)) edgeId = crypto.randomUUID();
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

const MapCanvasInner = forwardRef<MapCanvasHandle, MapCanvasProps>(function MapCanvasInner(
  { graph, selection, renamingNodeId, className, onChange, onSelect, onRenamingChange },
  ref,
) {
  const { screenToFlowPosition, fitView } = useReactFlow();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const selectedNodeId = selection?.kind === "node" ? selection.id : null;
  const selectedEdgeId = selection?.kind === "edge" ? selection.id : null;

  useImperativeHandle(
    ref,
    () => ({
      fitView: () => {
        void fitView(fitViewOptions);
      },
      viewportCenter: () => {
        const rect = wrapperRef.current?.getBoundingClientRect();
        if (!rect) return { x: 0, y: 0 };
        return screenToFlowPosition({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
      },
    }),
    [fitView, screenToFlowPosition],
  );

  const handleRenameCommit = useCallback(
    (nodeId: string, title: string) => {
      onRenamingChange(null);
      onChange({ ...graph, nodes: graph.nodes.map((node) => (node.id === nodeId ? { ...node, title } : node)) }, {
        coalesceKey: `node:${nodeId}:title`,
      });
    },
    [graph, onChange, onRenamingChange],
  );
  const handleRenameCancel = useCallback(() => onRenamingChange(null), [onRenamingChange]);

  const nodes = useMemo(
    () => graph.nodes.map((node) => toFlowNode(node, selectedNodeId, renamingNodeId, handleRenameCommit, handleRenameCancel)),
    [graph.nodes, selectedNodeId, renamingNodeId, handleRenameCommit, handleRenameCancel],
  );
  const edges = useMemo(() => graph.edges.map((edge) => toFlowEdge(edge, selectedEdgeId)), [graph.edges, selectedEdgeId]);

  const handleCanvasDoubleClick = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      if ((event.target as HTMLElement).closest(".orbit-map-node, .react-flow__minimap, .react-flow__controls, .react-flow__edge")) return;
      const id = crypto.randomUUID();
      const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      onChange(createNodeAt(graph, position, id));
      onSelect({ kind: "node", id });
      onRenamingChange(id);
    },
    [graph, onChange, onRenamingChange, onSelect, screenToFlowPosition],
  );

  const handleNodeDoubleClick = useCallback((_: unknown, node: Node) => onRenamingChange(node.id), [onRenamingChange]);

  const handleCanvasKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      const target = event.target as HTMLElement;
      if (editableTags.has(target.tagName) || target.isContentEditable) return;

      if (event.key === "Escape") {
        onSelect(null);
        onRenamingChange(null);
        return;
      }

      if ((event.key === "Delete" || event.key === "Backspace") && selection) {
        event.preventDefault();
        onChange(selection.kind === "node" ? deleteNode(graph, selection.id) : deleteEdge(graph, selection.id));
        onSelect(null);
        return;
      }

      if (!selectedNodeId) return;

      if (event.key === "F2") {
        event.preventDefault();
        onRenamingChange(selectedNodeId);
        return;
      }

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
      onSelect({ kind: "node", id: nodeId });
      onRenamingChange(nodeId);
    },
    [graph, onChange, onRenamingChange, onSelect, selectedNodeId, selection],
  );

  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      const movedPositions = new Map<string, { x: number; y: number }>();
      const removedNodeIds = new Set<string>();
      let dragging = false;

      changes.forEach((change) => {
        if (change.type === "position" && change.position) {
          movedPositions.set(change.id, change.position);
          if (change.dragging) dragging = true;
        }
        if (change.type === "remove") removedNodeIds.add(change.id);
      });

      if (movedPositions.size === 0 && removedNodeIds.size === 0) return;

      onChange(
        {
          ...graph,
          nodes: graph.nodes
            .filter((node) => !removedNodeIds.has(node.id))
            .map((node) => {
              const position = movedPositions.get(node.id);
              return position ? { ...node, position } : node;
            }),
          edges: graph.edges.filter((edge) => !removedNodeIds.has(edge.sourceNodeId) && !removedNodeIds.has(edge.targetNodeId)),
        },
        { undoable: !dragging },
      );
    },
    [graph, onChange],
  );

  const handleEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      const relevant = changes.filter((change) => change.type === "remove" || change.type === "replace");
      if (relevant.length === 0) return;
      onChange({ ...graph, edges: toGraphEdges(applyEdgeChanges(changes, edges), graph.edges) });
    },
    [edges, graph, onChange],
  );

  const handleConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target || connection.source === connection.target) return;
      const edgeId = createRandomEdgeId(new Set(graph.edges.map((edge) => edge.id)));
      onChange({ ...graph, edges: toGraphEdges(addEdge({ ...connection, id: edgeId }, edges), graph.edges) });
    },
    [edges, graph, onChange],
  );

  const handleNodeClick = useCallback((_: unknown, node: Node) => onSelect({ kind: "node", id: node.id }), [onSelect]);
  const handleEdgeClick = useCallback((_: unknown, edge: Edge) => onSelect({ kind: "edge", id: edge.id }), [onSelect]);
  const handlePaneClick = useCallback(() => onSelect(null), [onSelect]);

  return (
    <div
      aria-label="Visual planning canvas"
      className={clsx("orbit-constellation-canvas overflow-hidden rounded-lg border border-white/10", className ?? "h-[max(28rem,calc(100vh-9.5rem))]")}
      data-testid="map-canvas"
      onDoubleClick={handleCanvasDoubleClick}
      onKeyDown={handleCanvasKeyDown}
      ref={wrapperRef}
      role="application"
      tabIndex={0}
    >
      <ReactFlow
        className="orbit-constellation-flow"
        deleteKeyCode={null}
        edgeTypes={edgeTypes}
        edges={edges}
        fitView
        fitViewOptions={fitViewOptions}
        nodes={nodes}
        nodeTypes={nodeTypes}
        onConnect={handleConnect}
        onEdgeClick={handleEdgeClick}
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
});

export const MapCanvas = memo(
  forwardRef<MapCanvasHandle, MapCanvasProps>(function MapCanvas(props, ref) {
    return (
      <ReactFlowProvider>
        <MapCanvasInner {...props} ref={ref} />
      </ReactFlowProvider>
    );
  }),
);
