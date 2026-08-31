import { describe, expect, it, vi } from "vitest";
import { convertMindMapNode, createMindMap, listMindMaps, replaceMindMapGraph, toEditableGraph } from "./maps.queries";

function queryBuilder(result: unknown) {
  const builder = {
    select: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    is: vi.fn(() => builder),
    order: vi.fn(() => builder),
    single: vi.fn().mockResolvedValue({ data: result, error: null }),
    then: (resolve: (value: unknown) => void) => resolve({ data: result, error: null }),
  };
  return builder;
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
      p_default_view: "flowchart",
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
});
