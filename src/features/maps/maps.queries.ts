import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json, MindMapNodeType, MindMapView } from "../../lib/supabase/database.types";
import type { ConvertedObjectType, EditableMapEdge, EditableMapGraph, EditableMapNode } from "./map-types";
import { withFreshIds } from "./map-graph-ops";

type Client = SupabaseClient<Database>;
export type MindMap = Database["public"]["Tables"]["mind_maps"]["Row"];
type MindMapNode = Database["public"]["Tables"]["mind_map_nodes"]["Row"];
type MindMapEdge = Database["public"]["Tables"]["mind_map_edges"]["Row"];
type ReplaceMindMapGraphResult = {
  map: MindMap;
  nodes: MindMapNode[];
  edges: MindMapEdge[];
};
type ConvertMindMapNodeResult = {
  node: MindMapNode;
  convertedObject: { id: string } | null;
  alreadyConverted: boolean;
};

export type MindMapPreview = {
  nodes: Array<{ id: string; position: { x: number; y: number }; nodeType: MindMapNodeType }>;
  edges: Array<{ id: string; sourceNodeId: string; targetNodeId: string }>;
};

export const mindMapKeys = {
  list: (workspaceId: string, projectId?: string | null) => ["mind-maps", workspaceId, projectId ?? "global"] as const,
  previews: (workspaceId: string, projectId?: string | null) =>
    ["mind-map-previews", workspaceId, projectId ?? "global"] as const,
  graph: (workspaceId: string, mapId: string) => ["mind-map-graph", workspaceId, mapId] as const,
};

export type CreateMindMapInput = {
  id?: string;
  workspaceId: string;
  projectId?: string | null;
  userId: string;
  title: string;
  description: string;
  defaultView: MindMapView;
};

export async function listMindMaps(client: Client, input: { workspaceId: string; projectId?: string | null }) {
  let query = client
    .from("mind_maps")
    .select("*")
    .eq("workspace_id", input.workspaceId)
    .is("archived_at", null)
    .order("updated_at", { ascending: false });

  query = input.projectId ? query.eq("project_id", input.projectId) : query.is("project_id", null);

  const { data, error } = await query;
  if (error) throw error;
  return data as MindMap[];
}

export async function listMindMapPreviews(
  client: Client,
  input: { workspaceId: string; mapIds: string[] },
): Promise<Record<string, MindMapPreview>> {
  const previews: Record<string, MindMapPreview> = {};
  if (input.mapIds.length === 0) return previews;
  for (const mapId of input.mapIds) previews[mapId] = { nodes: [], edges: [] };

  const [{ data: nodes, error: nodesError }, { data: edges, error: edgesError }] = await Promise.all([
    client
      .from("mind_map_nodes")
      .select("id, map_id, node_type, position_x, position_y")
      .eq("workspace_id", input.workspaceId)
      .in("map_id", input.mapIds),
    client
      .from("mind_map_edges")
      .select("id, map_id, source_node_id, target_node_id")
      .eq("workspace_id", input.workspaceId)
      .in("map_id", input.mapIds),
  ]);

  if (nodesError) throw nodesError;
  if (edgesError) throw edgesError;

  for (const node of nodes ?? []) {
    previews[node.map_id]?.nodes.push({
      id: node.id,
      position: { x: Number(node.position_x), y: Number(node.position_y) },
      nodeType: node.node_type,
    });
  }
  for (const edge of edges ?? []) {
    previews[edge.map_id]?.edges.push({ id: edge.id, sourceNodeId: edge.source_node_id, targetNodeId: edge.target_node_id });
  }

  return previews;
}

export async function createMindMap(client: Client, input: CreateMindMapInput) {
  const { data, error } = await client
    .from("mind_maps")
    .insert({
      id: input.id,
      workspace_id: input.workspaceId,
      project_id: input.projectId ?? null,
      created_by: input.userId,
      title: input.title,
      description: input.description,
      default_view: input.defaultView,
    })
    .select("*")
    .single();

  if (error) throw error;
  return data as MindMap;
}

export async function getMindMapGraph(client: Client, input: { workspaceId: string; mapId: string }) {
  const [{ data: map, error: mapError }, { data: nodes, error: nodesError }, { data: edges, error: edgesError }] =
    await Promise.all([
      client.from("mind_maps").select("*").eq("workspace_id", input.workspaceId).eq("id", input.mapId).single(),
      client
        .from("mind_map_nodes")
        .select("*")
        .eq("workspace_id", input.workspaceId)
        .eq("map_id", input.mapId)
        .order("created_at", { ascending: true }),
      client
        .from("mind_map_edges")
        .select("*")
        .eq("workspace_id", input.workspaceId)
        .eq("map_id", input.mapId)
        .order("created_at", { ascending: true }),
    ]);

  if (mapError) throw mapError;
  if (nodesError) throw nodesError;
  if (edgesError) throw edgesError;
  return toEditableGraph({ map: map as MindMap, nodes: nodes as MindMapNode[], edges: edges as MindMapEdge[] });
}

export type UpdateMindMapInput = {
  id: string;
  workspaceId: string;
  title?: string;
  description?: string;
  defaultView?: MindMapView;
  archivedAt?: string | null;
};

export async function updateMindMap(client: Client, input: UpdateMindMapInput) {
  const patch: Database["public"]["Tables"]["mind_maps"]["Update"] = {};
  if (input.title !== undefined) patch.title = input.title;
  if (input.description !== undefined) patch.description = input.description;
  if (input.defaultView !== undefined) patch.default_view = input.defaultView;
  if (input.archivedAt !== undefined) patch.archived_at = input.archivedAt;

  const { data, error } = await client
    .from("mind_maps")
    .update(patch)
    .eq("id", input.id)
    .eq("workspace_id", input.workspaceId)
    .select("*")
    .single();

  if (error) throw error;
  return data as MindMap;
}

export function archiveMindMap(client: Client, input: { id: string; workspaceId: string }) {
  return updateMindMap(client, { ...input, archivedAt: new Date().toISOString() });
}

export async function duplicateMindMap(
  client: Client,
  input: { workspaceId: string; projectId?: string | null; userId: string; sourceMapId: string; title: string },
) {
  const source = await getMindMapGraph(client, { workspaceId: input.workspaceId, mapId: input.sourceMapId });
  const graph = withFreshIds({ ...source, title: input.title });
  const map = await createMindMap(client, {
    workspaceId: input.workspaceId,
    projectId: input.projectId ?? null,
    userId: input.userId,
    title: input.title,
    description: source.description,
    defaultView: "mind_map",
  });
  try {
    await replaceMindMapGraph(client, { workspaceId: input.workspaceId, mapId: map.id, graph });
  } catch (cause) {
    await archiveMindMap(client, { id: map.id, workspaceId: input.workspaceId }).catch(() => undefined);
    throw cause;
  }
  return map;
}

export async function replaceMindMapGraph(
  client: Client,
  input: { workspaceId: string; mapId: string; graph: EditableMapGraph },
) {
  const nodes = input.graph.nodes.map((node) => ({
    id: node.id,
    node_type: node.nodeType,
    status: node.status,
    title: node.title,
    body: node.body,
    position_x: node.position.x,
    position_y: node.position.y,
    width: node.width ?? null,
    height: node.height ?? null,
    accent: node.accent,
    start_date: node.startDate ?? null,
    due_date: node.dueDate ?? null,
    tags: node.tags,
    metadata: {} as Json,
    linked_type: node.linkedType ?? null,
    linked_id: node.linkedId ?? null,
  }));

  const edges = input.graph.edges.map((edge) => ({
    id: edge.id,
    source_node_id: edge.sourceNodeId,
    target_node_id: edge.targetNodeId,
    edge_type: edge.edgeType,
    label: edge.label,
    is_directional: edge.isDirectional,
    metadata: {} as Json,
  }));

  const { data, error } = await client.rpc("replace_mind_map_graph", {
    p_map_id: input.mapId,
    p_workspace_id: input.workspaceId,
    p_title: input.graph.title,
    p_description: input.graph.description,
    // The editor only ever renders the mind-map view; a stored legacy value must not
    // survive a save and send the map back to a view the UI no longer offers.
    p_default_view: "mind_map",
    p_nodes: nodes as unknown as Json,
    p_edges: edges as unknown as Json,
  });

  if (error) throw error;
  return toEditableGraph(data as unknown as ReplaceMindMapGraphResult);
}

export async function convertMindMapNode(
  client: Client,
  input: { id: string; workspaceId: string; projectId?: string | null; convertedType: ConvertedObjectType },
) {
  const { data, error } = await client.rpc("convert_mind_map_node", {
    p_node_id: input.id,
    p_workspace_id: input.workspaceId,
    p_project_id: input.projectId ?? null,
    p_converted_type: input.convertedType,
  });

  if (error) throw error;
  return data as unknown as ConvertMindMapNodeResult;
}

export function toEditableGraph(input: { map: MindMap; nodes: MindMapNode[]; edges: MindMapEdge[] }): EditableMapGraph {
  return {
    title: input.map.title,
    description: input.map.description,
    defaultView: input.map.default_view,
    nodes: input.nodes.map((node) => ({
      id: node.id,
      title: node.title,
      body: node.body,
      nodeType: node.node_type,
      status: node.status,
      position: { x: Number(node.position_x), y: Number(node.position_y) },
      width: node.width === null ? null : Number(node.width),
      height: node.height === null ? null : Number(node.height),
      accent: node.accent,
      startDate: node.start_date,
      dueDate: node.due_date,
      tags: node.tags,
      linkedType: node.linked_type as EditableMapNode["linkedType"],
      linkedId: node.linked_id,
      convertedType: node.converted_type as EditableMapNode["convertedType"],
      convertedId: node.converted_id,
      convertedAt: node.converted_at,
    })),
    edges: input.edges.map((edge) => ({
      id: edge.id,
      sourceNodeId: edge.source_node_id,
      targetNodeId: edge.target_node_id,
      edgeType: edge.edge_type,
      label: edge.label,
      isDirectional: edge.is_directional,
    })),
  };
}
