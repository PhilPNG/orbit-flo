import { describe, expect, it, vi } from "vitest";
import {
  archiveMindMap,
  convertMindMapNode,
  createMindMap,
  duplicateMindMap,
  listMindMapPreviews,
  listMindMaps,
  replaceMindMapGraph,
  toEditableGraph,
} from "./maps.queries";

function queryBuilder(result: unknown) {
  const builder = {
    select: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    update: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    in: vi.fn(() => builder),
    is: vi.fn(() => builder),
    order: vi.fn(() => builder),
    single: vi.fn().mockResolvedValue({ data: result, error: null }),
    then: (resolve: (value: unknown) => void) => resolve({ data: result, error: null }),
  };
  return builder;
}

function nodeRow(id: string, mapId: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    map_id: mapId,
    workspace_id: "workspace-1",
    node_type: "idea",
    status: "open",
    title: id,
    body: "",
    position_x: 10,
    position_y: 20,
    width: null,
    height: null,
    accent: "cyan",
    start_date: null,
    due_date: null,
    tags: [],
    metadata: {},
    linked_type: null,
    linked_id: null,
    converted_type: null,
    converted_id: null,
    converted_at: null,
    created_by: "user-1",
    created_at: "2026-07-01T00:00:00.000Z",
    updated_at: "2026-07-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("maps queries", () => {
  it("lists global maps when projectId is null", async () => {
    const builder = queryBuilder([]);
    const client = { from: vi.fn(() => builder) };

    await listMindMaps(client as never, { workspaceId: "workspace-1", projectId: null });

    expect(client.from).toHaveBeenCalledWith("mind_maps");
    expect(builder.is).toHaveBeenCalledWith("project_id", null);
  });

  it("creates a project map", async () => {
    const builder = queryBuilder({ id: "map-1" });
    const client = { from: vi.fn(() => builder) };

    await createMindMap(client as never, {
      workspaceId: "workspace-1",
      projectId: "project-1",
      userId: "user-1",
      title: "Feature map",
      description: "",
      defaultView: "mind_map",
    });

    expect(builder.insert).toHaveBeenCalledWith(expect.objectContaining({ project_id: "project-1", title: "Feature map" }));
  });

  it("forwards an explicit id when creating a map", async () => {
    const builder = queryBuilder({ id: "map-explicit" });
    const client = { from: vi.fn(() => builder) };

    await createMindMap(client as never, {
      id: "map-explicit",
      workspaceId: "workspace-1",
      projectId: null,
      userId: "user-1",
      title: "Explicit map",
      description: "",
      defaultView: "mind_map",
    });

    expect(builder.insert).toHaveBeenCalledWith(expect.objectContaining({ id: "map-explicit" }));
  });

  it("maps database rows into editable graph state", () => {
    const graph = toEditableGraph({
      map: { title: "Map", description: "", default_view: "mind_map" },
      nodes: [
        {
          id: "node-1",
          title: "Idea",
          body: "",
          node_type: "idea",
          status: "open",
          position_x: 10,
          position_y: 20,
          width: null,
          height: null,
          accent: "cyan",
          start_date: null,
          due_date: null,
          tags: [],
          linked_type: null,
          linked_id: null,
          converted_type: null,
          converted_id: null,
          converted_at: null,
        },
      ],
      edges: [],
    } as never);

    expect(graph.nodes[0].position).toEqual({ x: 10, y: 20 });
  });

  it("replaces a map graph through the atomic RPC", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        map: { title: "Saved map", description: "", default_view: "flowchart" },
        nodes: [
          {
            id: "node-1",
            title: "Saved idea",
            body: "",
            node_type: "idea",
            status: "open",
            position_x: 10,
            position_y: 20,
            width: null,
            height: null,
            accent: "cyan",
            start_date: null,
            due_date: null,
            tags: [],
            linked_type: null,
            linked_id: null,
            converted_type: null,
            converted_id: null,
            converted_at: null,
          },
        ],
        edges: [],
      },
      error: null,
    });
    const client = { rpc };

    const graph = await replaceMindMapGraph(client as never, {
      workspaceId: "workspace-1",
      mapId: "map-1",
      graph: {
        title: "Saved map",
        description: "",
        defaultView: "flowchart",
        nodes: [
          {
            id: "node-1",
            title: "Saved idea",
            body: "",
            nodeType: "idea",
            status: "open",
            position: { x: 10, y: 20 },
            accent: "cyan",
            tags: ["launch"],
            convertedType: "task",
            convertedId: "task-1",
            convertedAt: "2026-07-01T01:00:00.000Z",
          },
        ],
        edges: [],
      },
    });

    expect(rpc).toHaveBeenCalledWith("replace_mind_map_graph", {
      p_map_id: "map-1",
      p_workspace_id: "workspace-1",
      p_title: "Saved map",
      p_description: "",
      p_default_view: "mind_map",
      p_nodes: [
        {
          id: "node-1",
          node_type: "idea",
          status: "open",
          title: "Saved idea",
          body: "",
          position_x: 10,
          position_y: 20,
          width: null,
          height: null,
          accent: "cyan",
          start_date: null,
          due_date: null,
          tags: ["launch"],
          metadata: {},
          linked_type: null,
          linked_id: null,
        },
      ],
      p_edges: [],
    });
    expect(graph.nodes[0].title).toBe("Saved idea");
  });

  it("converts a node through the transactional RPC", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        node: {
          id: "node-1",
          workspace_id: "workspace-1",
          map_id: "map-1",
          status: "converted",
          converted_type: "note",
          converted_id: "note-1",
          converted_at: "2026-07-01T01:00:00.000Z",
        },
        convertedObject: { id: "note-1" },
        alreadyConverted: false,
      },
      error: null,
    });
    const client = { rpc };

    const result = await convertMindMapNode(client as never, {
      id: "node-1",
      workspaceId: "workspace-1",
      projectId: null,
      convertedType: "note",
    });

    expect(rpc).toHaveBeenCalledWith("convert_mind_map_node", {
      p_node_id: "node-1",
      p_workspace_id: "workspace-1",
      p_project_id: null,
      p_converted_type: "note",
    });
    expect(result.node.converted_id).toBe("note-1");
    expect(result.alreadyConverted).toBe(false);
  });

  it("groups preview nodes and edges by map id", async () => {
    const nodes = [nodeRow("n1", "map-1"), nodeRow("n2", "map-1"), nodeRow("n3", "map-2")];
    const edges = [{ id: "e1", map_id: "map-1", source_node_id: "n1", target_node_id: "n2" }];
    const builders: Record<string, ReturnType<typeof queryBuilder>> = {
      mind_map_nodes: queryBuilder(nodes),
      mind_map_edges: queryBuilder(edges),
    };
    const client = { from: vi.fn((table: string) => builders[table]) };

    const previews = await listMindMapPreviews(client as never, { workspaceId: "workspace-1", mapIds: ["map-1", "map-2", "map-3"] });

    expect(builders.mind_map_nodes.in).toHaveBeenCalledWith("map_id", ["map-1", "map-2", "map-3"]);
    expect(previews["map-1"].nodes).toHaveLength(2);
    expect(previews["map-1"].nodes[0]).toEqual({ id: "n1", position: { x: 10, y: 20 }, nodeType: "idea" });
    expect(previews["map-1"].edges).toEqual([{ id: "e1", sourceNodeId: "n1", targetNodeId: "n2" }]);
    expect(previews["map-2"].nodes).toHaveLength(1);
    expect(previews["map-3"]).toEqual({ nodes: [], edges: [] });
  });

  it("returns an empty record for no map ids without querying", async () => {
    const client = { from: vi.fn() };

    expect(await listMindMapPreviews(client as never, { workspaceId: "workspace-1", mapIds: [] })).toEqual({});
    expect(client.from).not.toHaveBeenCalled();
  });

  it("archives a map by setting archived_at", async () => {
    const builder = queryBuilder({ id: "map-1", archived_at: "2026-09-01T00:00:00.000Z" });
    const client = { from: vi.fn(() => builder) };

    await archiveMindMap(client as never, { id: "map-1", workspaceId: "workspace-1" });

    expect(client.from).toHaveBeenCalledWith("mind_maps");
    expect(builder.update).toHaveBeenCalledWith({ archived_at: expect.any(String) });
    expect(builder.eq).toHaveBeenCalledWith("id", "map-1");
    expect(builder.eq).toHaveBeenCalledWith("workspace_id", "workspace-1");
  });

  it("duplicates a map with fresh node and edge ids", async () => {
    const sourceMap = { id: "map-1", title: "Plan", description: "desc", default_view: "mind_map" };
    const mapsBuilder = queryBuilder(sourceMap);
    mapsBuilder.single = vi
      .fn()
      .mockResolvedValueOnce({ data: sourceMap, error: null })
      .mockResolvedValueOnce({ data: { id: "map-2", title: "Plan copy" }, error: null });
    const builders: Record<string, ReturnType<typeof queryBuilder>> = {
      mind_maps: mapsBuilder,
      mind_map_nodes: queryBuilder([nodeRow("n1", "map-1"), nodeRow("n2", "map-1")]),
      mind_map_edges: queryBuilder([
        { id: "e1", map_id: "map-1", source_node_id: "n1", target_node_id: "n2", edge_type: "association", label: "", is_directional: false },
      ]),
    };
    const rpc = vi.fn().mockResolvedValue({
      data: { map: { id: "map-2", title: "Plan copy", description: "desc", default_view: "mind_map" }, nodes: [], edges: [] },
      error: null,
    });
    const client = { from: vi.fn((table: string) => builders[table]), rpc };

    const result = await duplicateMindMap(client as never, {
      workspaceId: "workspace-1",
      projectId: null,
      userId: "user-1",
      sourceMapId: "map-1",
      title: "Plan copy",
    });

    expect(result.id).toBe("map-2");
    expect(mapsBuilder.insert).toHaveBeenCalledWith(expect.objectContaining({ title: "Plan copy", description: "desc" }));
    const payload = rpc.mock.calls[0][1] as { p_map_id: string; p_nodes: Array<{ id: string }>; p_edges: Array<{ source_node_id: string; target_node_id: string }> };
    expect(payload.p_map_id).toBe("map-2");
    expect(payload.p_nodes.map((node) => node.id)).not.toContain("n1");
    expect(payload.p_edges[0].source_node_id).toBe(payload.p_nodes[0].id);
    expect(payload.p_edges[0].target_node_id).toBe(payload.p_nodes[1].id);
  });

  it("archives the new map when copying the graph fails", async () => {
    const sourceMap = { id: "map-1", title: "Plan", description: "desc", default_view: "mind_map" };
    const mapsBuilder = queryBuilder(sourceMap);
    mapsBuilder.single = vi
      .fn()
      .mockResolvedValueOnce({ data: sourceMap, error: null })
      .mockResolvedValueOnce({ data: { id: "map-2", title: "Plan copy" }, error: null });
    const builders: Record<string, ReturnType<typeof queryBuilder>> = {
      mind_maps: mapsBuilder,
      mind_map_nodes: queryBuilder([nodeRow("n1", "map-1"), nodeRow("n2", "map-1")]),
      mind_map_edges: queryBuilder([
        { id: "e1", map_id: "map-1", source_node_id: "n1", target_node_id: "n2", edge_type: "association", label: "", is_directional: false },
      ]),
    };
    const rpc = vi.fn().mockRejectedValue(new Error("graph failed"));
    const client = { from: vi.fn((table: string) => builders[table]), rpc };

    await expect(
      duplicateMindMap(client as never, {
        workspaceId: "workspace-1",
        projectId: null,
        userId: "user-1",
        sourceMapId: "map-1",
        title: "Plan copy",
      }),
    ).rejects.toThrow("graph failed");

    expect(mapsBuilder.update).toHaveBeenCalledWith({ archived_at: expect.any(String) });
    expect(mapsBuilder.eq).toHaveBeenCalledWith("id", "map-2");
  });
});
