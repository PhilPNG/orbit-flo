import type { MindMapNodeType } from "../../lib/supabase/database.types";
import { placeNewNode } from "./map-layouts";
import type { EditableMapEdge, EditableMapGraph, EditableMapNode } from "./map-types";

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
    nodes: [
      ...graph.nodes,
      blankNode(nodeId, placeNewNode(graph.nodes, { x: source.position.x + 180, y: source.position.y + 40 })),
    ],
    edges: [
      ...graph.edges,
      { id: edgeId, sourceNodeId, targetNodeId: nodeId, edgeType: "association", label: "", isDirectional: false },
    ],
  };
}

export function withFreshIds(graph: EditableMapGraph): EditableMapGraph {
  const nodeIds = new Map(graph.nodes.map((node) => [node.id, crypto.randomUUID()]));

  return {
    ...graph,
    nodes: graph.nodes.map((node) => ({ ...node, id: nodeIds.get(node.id) as string })),
    edges: graph.edges.map((edge) => ({
      ...edge,
      id: crypto.randomUUID(),
      sourceNodeId: nodeIds.get(edge.sourceNodeId) ?? edge.sourceNodeId,
      targetNodeId: nodeIds.get(edge.targetNodeId) ?? edge.targetNodeId,
    })),
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
    nodes: [
      ...graph.nodes,
      blankNode(nodeId, placeNewNode(graph.nodes, { x: selected.position.x, y: selected.position.y + 120 })),
    ],
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

export function updateNode(graph: EditableMapGraph, nodeId: string, patch: Partial<Omit<EditableMapNode, "id">>): EditableMapGraph {
  return { ...graph, nodes: graph.nodes.map((node) => (node.id === nodeId ? { ...node, ...patch } : node)) };
}

export function deleteNode(graph: EditableMapGraph, nodeId: string): EditableMapGraph {
  return {
    ...graph,
    nodes: graph.nodes.filter((node) => node.id !== nodeId),
    edges: graph.edges.filter((edge) => edge.sourceNodeId !== nodeId && edge.targetNodeId !== nodeId),
  };
}

export function updateEdge(graph: EditableMapGraph, edgeId: string, patch: Partial<Omit<EditableMapEdge, "id">>): EditableMapGraph {
  return { ...graph, edges: graph.edges.map((edge) => (edge.id === edgeId ? { ...edge, ...patch } : edge)) };
}

export function deleteEdge(graph: EditableMapGraph, edgeId: string): EditableMapGraph {
  return { ...graph, edges: graph.edges.filter((edge) => edge.id !== edgeId) };
}
