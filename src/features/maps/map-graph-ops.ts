import type { MindMapNodeType } from "../../lib/supabase/database.types";
import type { EditableMapGraph, EditableMapNode } from "./map-types";

const accentByNodeType: Record<MindMapNodeType, "cyan" | "blue" | "violet"> = {
  idea: "cyan",
  task_candidate: "cyan",
  note: "blue",
  reference: "blue",
  option: "blue",
  milestone: "violet",
  decision: "violet",
  risk: "violet",
};

export function nodeAccentColor(nodeType: MindMapNodeType) {
  return accentByNodeType[nodeType];
}

export type NodeShape = "dot" | "planet" | "diamond" | "triangle" | "card" | "ring";

const shapeByNodeType: Record<MindMapNodeType, NodeShape> = {
  idea: "dot",
  task_candidate: "dot",
  milestone: "planet",
  decision: "diamond",
  risk: "triangle",
  note: "card",
  reference: "card",
  option: "ring",
};

export function nodeShape(nodeType: MindMapNodeType): NodeShape {
  return shapeByNodeType[nodeType];
}

function blankNode(id: string, position: { x: number; y: number }): EditableMapNode {
  return {
    id,
    title: "New idea",
    body: "",
    nodeType: "idea",
    status: "open",
    position,
    accent: "cyan",
    tags: [],
  };
}

export function createNodeAt(graph: EditableMapGraph, position: { x: number; y: number }, id: string): EditableMapGraph {
  return { ...graph, nodes: [...graph.nodes, blankNode(id, position)] };
}

export function createConnectedNode(
  graph: EditableMapGraph,
  sourceNodeId: string,
  nodeId: string,
  edgeId: string,
): EditableMapGraph {
  const source = graph.nodes.find((node) => node.id === sourceNodeId);
  if (!source) return graph;

  return {
    ...graph,
    nodes: [...graph.nodes, blankNode(nodeId, { x: source.position.x + 180, y: source.position.y + 40 })],
    edges: [
      ...graph.edges,
      { id: edgeId, sourceNodeId, targetNodeId: nodeId, edgeType: "association", label: "", isDirectional: false },
    ],
  };
}

export function createSiblingNode(
  graph: EditableMapGraph,
  selectedNodeId: string,
  nodeId: string,
  edgeId: string,
): EditableMapGraph {
  const selected = graph.nodes.find((node) => node.id === selectedNodeId);
  if (!selected) return graph;

  const parentEdge = graph.edges.find((edge) => edge.targetNodeId === selectedNodeId);
  if (!parentEdge) return createConnectedNode(graph, selectedNodeId, nodeId, edgeId);

  return {
    ...graph,
    nodes: [...graph.nodes, blankNode(nodeId, { x: selected.position.x, y: selected.position.y + 120 })],
    edges: [
      ...graph.edges,
      {
        id: edgeId,
        sourceNodeId: parentEdge.sourceNodeId,
        targetNodeId: nodeId,
        edgeType: "association",
        label: "",
        isDirectional: false,
      },
    ],
  };
}
