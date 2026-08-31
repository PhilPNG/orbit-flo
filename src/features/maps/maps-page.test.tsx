import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Database } from "../../lib/supabase/database.types";
import type { EditableMapGraph } from "./map-types";
import { MapsPage } from "./maps-page";

const mapMocks = vi.hoisted(() => ({
  convertMindMapNode: vi.fn(),
  createMindMap: vi.fn(),
  getMindMapGraph: vi.fn(),
  listMindMaps: vi.fn(),
  replaceMindMapGraph: vi.fn(),
  updateMindMap: vi.fn(),
}));

vi.mock("../../lib/supabase/client", () => ({ supabase: {} }));
vi.mock("../workspaces/workspace-context", () => ({
  useWorkspaceId: () => "workspace-1",
}));
vi.mock("../auth/use-auth", () => ({ useAuth: () => ({ isLoading: false, user: { id: "user-1" } }) }));
vi.mock("../notes/notes.queries", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../notes/notes.queries")>();
  return actual;
});
vi.mock("./maps.queries", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./maps.queries")>();
  return {
    ...actual,
    convertMindMapNode: mapMocks.convertMindMapNode,
    createMindMap: mapMocks.createMindMap,
    getMindMapGraph: mapMocks.getMindMapGraph,
    listMindMaps: mapMocks.listMindMaps,
    replaceMindMapGraph: mapMocks.replaceMindMapGraph,
    updateMindMap: mapMocks.updateMindMap,
  };
});

type MindMap = Database["public"]["Tables"]["mind_maps"]["Row"];

function map(overrides: Partial<MindMap> = {}): MindMap {
  return {
    id: "map-1",
    workspace_id: "workspace-1",
    project_id: null,
    title: "Untitled map",
    description: "",
    default_view: "mind_map",
    created_by: "user-1",
    created_at: "2026-07-01T00:00:00.000Z",
    updated_at: "2026-07-01T00:00:00.000Z",
    archived_at: null,
    ...overrides,
  };
}

function renderMapsPage(projectId?: string | null) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  const result = render(
    <QueryClientProvider client={queryClient}>
      <MapsPage projectId={projectId} />
    </QueryClientProvider>,
  );

  return { ...result, queryClient };
}

function rerenderMapsPage(
  rerender: ReturnType<typeof render>["rerender"],
  queryClient: QueryClient,
  projectId?: string | null,
) {
  rerender(
    <QueryClientProvider client={queryClient}>
      <MapsPage projectId={projectId} />
    </QueryClientProvider>,
  );
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });

  return { promise, resolve, reject };
}

const persistedGraph: EditableMapGraph = {
  title: "Feature plan",
  description: "",
  defaultView: "mind_map",
  nodes: [
    {
      id: "6b6b2f97-8bc9-4d44-96a8-46209bd9a551",
      title: "Persisted feature",
      body: "Keep me",
      nodeType: "idea",
      status: "open",
      position: { x: 10, y: 20 },
      accent: "cyan",
      tags: ["saved"],
    },
    {
      id: "75b64dcc-8eed-476f-a7c5-ae067dfd8b22",
      title: "Persisted launch",
      body: "",
      nodeType: "milestone",
      status: "open",
      position: { x: 180, y: 20 },
      accent: "violet",
      tags: [],
    },
  ],
  edges: [
    {
      id: "9cbf3b09-8941-42aa-9f12-0f47d08edfa1",
      sourceNodeId: "6b6b2f97-8bc9-4d44-96a8-46209bd9a551",
      targetNodeId: "75b64dcc-8eed-476f-a7c5-ae067dfd8b22",
      edgeType: "association",
      label: "",
      isDirectional: false,
    },
  ],
};

describe("MapsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
    mapMocks.listMindMaps.mockResolvedValue([]);
    mapMocks.getMindMapGraph.mockResolvedValue(persistedGraph);
    mapMocks.createMindMap.mockResolvedValue(map());
    mapMocks.updateMindMap.mockResolvedValue(map());
    mapMocks.replaceMindMapGraph.mockImplementation((_client, input: { graph: EditableMapGraph }) => Promise.resolve(input.graph));
    mapMocks.convertMindMapNode.mockImplementation((_client, input: { convertedType: "task" | "note" | "milestone" }) => ({
      node: {
        id: "feature",
        workspace_id: "workspace-1",
        map_id: "map-feature",
        node_type: "idea",
        status: "converted",
        title: "Feature",
        body: "",
        position_x: 0,
        position_y: 0,
        width: null,
        height: null,
        accent: "cyan",
        start_date: null,
        due_date: null,
        tags: [],
        metadata: {},
        linked_type: null,
        linked_id: null,
        converted_type: input.convertedType,
        converted_id: `${input.convertedType}-1`,
        converted_at: "2026-07-01T01:00:00.000Z",
        created_by: "user-1",
        created_at: "2026-07-01T00:00:00.000Z",
        updated_at: "2026-07-01T01:00:00.000Z",
      },
      convertedObject: { id: `${input.convertedType}-1` },
      alreadyConverted: false,
    }));
  });

  it("creates a new blank map", async () => {
    const user = userEvent.setup();

    renderMapsPage();

    await user.click(await screen.findByRole("button", { name: "New blank map" }));

    expect(mapMocks.createMindMap).toHaveBeenCalledWith(
      {},
      {
        workspaceId: "workspace-1",
        projectId: null,
        userId: "user-1",
        title: "Untitled map",
        description: "",
        defaultView: "mind_map",
      },
    );
  });

  it("shows create errors in the map workspace", async () => {
    const user = userEvent.setup();
    mapMocks.createMindMap.mockRejectedValue(new Error("Could not create map"));

    renderMapsPage();

    await user.click(await screen.findByRole("button", { name: "New blank map" }));

    expect(await screen.findByText("Could not create map")).toBeInTheDocument();
  });

  it("disables map creation actions while a map is being created", async () => {
    const user = userEvent.setup();
    const createMap = deferred<MindMap>();
    mapMocks.createMindMap.mockReturnValue(createMap.promise);

    renderMapsPage();

    await user.click(await screen.findByRole("button", { name: "New blank map" }));

    expect(screen.getByRole("button", { name: "New blank map" })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Feature plan/ })).toBeDisabled();

    createMap.resolve(map());
  });

  it("hides template editing controls while template creation is pending", async () => {
    const user = userEvent.setup();
    const createMap = deferred<MindMap>();
    mapMocks.createMindMap.mockReturnValue(createMap.promise);

    renderMapsPage();

    await user.click(await screen.findByRole("button", { name: /Feature plan/ }));

    expect(await screen.findByRole("heading", { name: "Creating map draft..." })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add node" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add canvas node" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save map" })).not.toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Mind map" })).not.toBeInTheDocument();

    createMap.resolve(map());
  });

  it("hides selected node inspector fields while template creation is pending", async () => {
    const user = userEvent.setup();
    const createMap = deferred<MindMap>();
    mapMocks.createMindMap.mockResolvedValueOnce(map({ id: "map-feature" })).mockReturnValueOnce(createMap.promise);

    renderMapsPage();

    await user.click(await screen.findByRole("button", { name: /Feature plan/ }));
    fireEvent.click(await screen.findByText("Feature"));
    await user.click(screen.getByRole("button", { name: "Details" }));

    expect(screen.getByLabelText("Node title")).toBeInTheDocument();

    await user.click(screen.getAllByRole("button", { name: /Feature plan/ })[0]);

    expect(await screen.findByRole("heading", { name: "Creating map draft..." })).toBeInTheDocument();
    expect(screen.queryByLabelText("Node title")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Node notes")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Due date")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Convert to task" })).not.toBeInTheDocument();

    createMap.resolve(map());
  });

  it("loads a persisted graph before saving a selected map", async () => {
    const user = userEvent.setup();
    const featureMap = map({ id: "map-1", title: "Feature plan", default_view: "mind_map" });
    const graphLoad = deferred<EditableMapGraph>();
    mapMocks.listMindMaps.mockResolvedValue([featureMap]);
    mapMocks.getMindMapGraph.mockReturnValueOnce(graphLoad.promise);
    mapMocks.updateMindMap.mockResolvedValue({ ...featureMap, default_view: "flowchart" });

    renderMapsPage();

    await screen.findByRole("option", { name: "Feature plan" });
    await user.selectOptions(screen.getByLabelText("Open map"), "map-1");
    expect(await screen.findByRole("heading", { name: "Loading map graph" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save map" })).not.toBeInTheDocument();

    graphLoad.resolve(persistedGraph);
    expect(await screen.findByText("Persisted feature")).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "Flowchart" }));

    expect(screen.getByText("Unsaved changes")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Save map" }));

    await waitFor(() => expect(mapMocks.replaceMindMapGraph).toHaveBeenCalled());
    expect(mapMocks.replaceMindMapGraph).toHaveBeenCalledWith(
      {},
      {
        workspaceId: "workspace-1",
        mapId: "map-1",
        graph: {
          title: "Feature plan",
          description: "",
          defaultView: "flowchart",
          nodes: persistedGraph.nodes,
          edges: persistedGraph.edges,
        },
      },
    );
    expect(await screen.findByText("Saved")).toBeInTheDocument();
  });

  it("prefetches saved map graphs when focusing the open-map select", async () => {
    const user = userEvent.setup();
    const featureMap = map({ id: "map-1", title: "Feature plan", default_view: "mind_map" });
    mapMocks.listMindMaps.mockResolvedValue([featureMap]);

    renderMapsPage();

    await screen.findByRole("option", { name: "Feature plan" });
    await user.click(screen.getByLabelText("Open map"));

    await waitFor(() => expect(mapMocks.getMindMapGraph).toHaveBeenCalled());
    expect(mapMocks.getMindMapGraph).toHaveBeenCalledWith(
      {},
      {
        workspaceId: "workspace-1",
        mapId: "map-1",
      },
    );
  });

  it("saves template graphs with generated uuid ids", async () => {
    const user = userEvent.setup();
    const featureMap = map({ id: "map-feature", title: "Feature plan", description: "Shape a feature from idea through launch readiness." });
    mapMocks.createMindMap.mockResolvedValue(featureMap);

    renderMapsPage();

    await user.click(await screen.findByRole("button", { name: /Feature plan/ }));
    await user.click(await screen.findByRole("button", { name: "Save map" }));

    await waitFor(() => expect(mapMocks.replaceMindMapGraph).toHaveBeenCalled());
    const graph = mapMocks.replaceMindMapGraph.mock.calls.at(-1)?.[1].graph as EditableMapGraph;
    const nodeIds = new Set(graph.nodes.map((node) => node.id));
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    expect(graph.nodes).toHaveLength(8);
    expect(graph.nodes.every((node) => uuidPattern.test(node.id))).toBe(true);
    expect(graph.edges.every((edge) => uuidPattern.test(edge.id))).toBe(true);
    expect(graph.edges.every((edge) => nodeIds.has(edge.sourceNodeId) && nodeIds.has(edge.targetNodeId))).toBe(true);
    expect(graph.nodes.map((node) => node.title)).toContain("Feature");
  });

  it("prevents converting a selected template node until the map is saved", async () => {
    const user = userEvent.setup();
    const featureMap = map({ id: "map-feature", title: "Feature plan", description: "Shape a feature from idea through launch readiness." });
    mapMocks.createMindMap.mockResolvedValue(featureMap);

    renderMapsPage();

    await user.click(await screen.findByRole("button", { name: /Feature plan/ }));
    fireEvent.click(await screen.findByText("Feature"));
    await user.click(screen.getByRole("button", { name: "Details" }));

    expect(screen.getByText("Save this map before converting nodes.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Convert to note" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Convert to note" }));

    expect(mapMocks.convertMindMapNode).not.toHaveBeenCalled();
  });

  it("converts a selected template node to a note after saving", async () => {
    const user = userEvent.setup();
    const featureMap = map({ id: "map-feature", title: "Feature plan", description: "Shape a feature from idea through launch readiness." });
    mapMocks.listMindMaps.mockResolvedValueOnce([]).mockResolvedValueOnce([featureMap]);
    mapMocks.createMindMap.mockResolvedValue(featureMap);

    const { queryClient } = renderMapsPage();
    const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries");

    await user.click(await screen.findByRole("button", { name: /Feature plan/ }));
    await user.click(await screen.findByRole("button", { name: "Save map" }));
    await screen.findByText("Saved");
    fireEvent.click(await screen.findByText("Feature"));
    await user.click(screen.getByRole("button", { name: "Details" }));
    await user.click(screen.getByRole("button", { name: "Convert to note" }));

    await waitFor(() => expect(mapMocks.convertMindMapNode).toHaveBeenCalled());
    expect(mapMocks.convertMindMapNode).toHaveBeenCalledWith(
      {},
      {
        workspaceId: "workspace-1",
        id: expect.stringMatching(/^[0-9a-f-]{36}$/i),
        convertedType: "note",
        projectId: null,
      },
    );

    expect(await screen.findByText("Converted to note.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Convert to task" })).toBeDisabled();
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["mind-map-graph", "workspace-1", "map-feature"] });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["notes", "workspace-1"] });
  });

  it("invalidates workspace and project note caches after converting a project map node to a note", async () => {
    const user = userEvent.setup();
    const featureMap = map({
      id: "map-feature",
      project_id: "project-1",
      title: "Feature plan",
      description: "Shape a feature from idea through launch readiness.",
    });
    mapMocks.createMindMap.mockResolvedValue(featureMap);

    const { queryClient } = renderMapsPage("project-1");
    const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries");

    await user.click(await screen.findByRole("button", { name: /Feature plan/ }));
    await user.click(await screen.findByRole("button", { name: "Save map" }));
    await screen.findByText("Saved");
    fireEvent.click(await screen.findByText("Feature"));
    await user.click(screen.getByRole("button", { name: "Details" }));
    await user.click(screen.getByRole("button", { name: "Convert to note" }));

    await waitFor(() => expect(mapMocks.convertMindMapNode).toHaveBeenCalled());
    expect(mapMocks.convertMindMapNode).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ workspaceId: "workspace-1", convertedType: "note", projectId: "project-1" }),
    );
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["mind-map-graph", "workspace-1", "map-feature"] });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["notes", "workspace-1"] });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["notes", "workspace-1", "project", "project-1"] });
  });

  it("invalidates task destination caches after converting a project map node to a task", async () => {
    const user = userEvent.setup();
    const featureMap = map({
      id: "map-feature",
      project_id: "project-1",
      title: "Feature plan",
      description: "Shape a feature from idea through launch readiness.",
    });
    mapMocks.createMindMap.mockResolvedValue(featureMap);

    const { queryClient } = renderMapsPage("project-1");
    const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries");

    await user.click(await screen.findByRole("button", { name: /Feature plan/ }));
    await user.click(await screen.findByRole("button", { name: "Save map" }));
    await screen.findByText("Saved");
    fireEvent.click(await screen.findByText("Feature"));
    await user.click(screen.getByRole("button", { name: "Details" }));
    await user.click(screen.getByRole("button", { name: "Convert to task" }));

    await waitFor(() => expect(mapMocks.convertMindMapNode).toHaveBeenCalled());
    expect(mapMocks.convertMindMapNode).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ workspaceId: "workspace-1", convertedType: "task", projectId: "project-1" }),
    );
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["mind-map-graph", "workspace-1", "map-feature"] });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["work-items", "workspace-1", "project-1"] });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["due-calendar"] });
  });

  it("uses the server conversion type when a stale node was already converted", async () => {
    const user = userEvent.setup();
    const featureMap = map({
      id: "map-feature",
      project_id: "project-1",
      title: "Feature plan",
      description: "Shape a feature from idea through launch readiness.",
    });
    mapMocks.createMindMap.mockResolvedValue(featureMap);
    mapMocks.convertMindMapNode.mockResolvedValueOnce({
      node: {
        id: "feature",
        workspace_id: "workspace-1",
        map_id: "map-feature",
        node_type: "idea",
        status: "converted",
        title: "Feature",
        body: "",
        position_x: 0,
        position_y: 0,
        width: null,
        height: null,
        accent: "cyan",
        start_date: null,
        due_date: null,
        tags: [],
        metadata: {},
        linked_type: null,
        linked_id: null,
        converted_type: "task",
        converted_id: "task-existing",
        converted_at: "2026-07-01T01:00:00.000Z",
        created_by: "user-1",
        created_at: "2026-07-01T00:00:00.000Z",
        updated_at: "2026-07-01T01:00:00.000Z",
      },
      convertedObject: null,
      alreadyConverted: true,
    });

    const { queryClient } = renderMapsPage("project-1");
    const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries");

    await user.click(await screen.findByRole("button", { name: /Feature plan/ }));
    await user.click(await screen.findByRole("button", { name: "Save map" }));
    await screen.findByText("Saved");
    fireEvent.click(await screen.findByText("Feature"));
    await user.click(screen.getByRole("button", { name: "Details" }));
    await user.click(screen.getByRole("button", { name: "Convert to note" }));

    expect(await screen.findByText("Converted to task.")).toBeInTheDocument();
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["work-items", "workspace-1", "project-1"] });
    expect(invalidateQueries).not.toHaveBeenCalledWith({ queryKey: ["notes", "workspace-1"] });
  });

  it("invalidates milestone destination caches after converting a project map node to a milestone", async () => {
    const user = userEvent.setup();
    const featureMap = map({
      id: "map-feature",
      project_id: "project-1",
      title: "Feature plan",
      description: "Shape a feature from idea through launch readiness.",
    });
    mapMocks.createMindMap.mockResolvedValue(featureMap);

    const { queryClient } = renderMapsPage("project-1");
    const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries");

    await user.click(await screen.findByRole("button", { name: /Feature plan/ }));
    await user.click(await screen.findByRole("button", { name: "Save map" }));
    await screen.findByText("Saved");
    fireEvent.click(await screen.findByText("Feature"));
    await user.click(screen.getByRole("button", { name: "Details" }));
    await user.click(screen.getByRole("button", { name: "Convert to milestone" }));

    await waitFor(() => expect(mapMocks.convertMindMapNode).toHaveBeenCalled());
    expect(mapMocks.convertMindMapNode).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ workspaceId: "workspace-1", convertedType: "milestone", projectId: "project-1" }),
    );
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["mind-map-graph", "workspace-1", "map-feature"] });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["milestones", "workspace-1", "project-1"] });
  });

  it("disables project-only conversions for global map nodes", async () => {
    const user = userEvent.setup();
    const featureMap = map({ id: "map-feature", title: "Feature plan", description: "Shape a feature from idea through launch readiness." });
    mapMocks.createMindMap.mockResolvedValue(featureMap);

    renderMapsPage();

    await user.click(await screen.findByRole("button", { name: /Feature plan/ }));
    await user.click(await screen.findByRole("button", { name: "Save map" }));
    await screen.findByText("Saved");
    fireEvent.click(await screen.findByText("Feature"));
    await user.click(screen.getByRole("button", { name: "Details" }));

    const convertToTask = screen.getByRole("button", { name: "Convert to task" });
    expect(convertToTask).toBeDisabled();
    expect(screen.getByRole("button", { name: "Convert to milestone" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Convert to note" })).not.toBeDisabled();
    expect(screen.getByText("Choose a project map before converting nodes to tasks.")).toBeInTheDocument();

    await user.click(convertToTask);

    expect(mapMocks.convertMindMapNode).not.toHaveBeenCalled();
  });

  it("clears local graph state when the project scope changes", async () => {
    const user = userEvent.setup();
    const featureMap = map({
      id: "map-feature",
      project_id: "project-1",
      title: "Feature plan",
      description: "Shape a feature from idea through launch readiness.",
    });
    mapMocks.listMindMaps.mockResolvedValue([]);
    mapMocks.createMindMap.mockResolvedValue(featureMap);

    const { queryClient, rerender } = renderMapsPage("project-1");

    await user.click(await screen.findByRole("button", { name: /Feature plan/ }));

    expect(await screen.findByText("Requirements")).toBeInTheDocument();

    rerenderMapsPage(rerender, queryClient, "project-2");

    expect(await screen.findByRole("heading", { name: "Choose a visual plan" })).toBeInTheDocument();
    expect(screen.queryByText("Requirements")).not.toBeInTheDocument();
    expect(screen.queryByText("Unsaved changes")).not.toBeInTheDocument();
    expect(screen.getByText("See the big picture")).toBeInTheDocument();
    expect(screen.getByText("Connect what matters")).toBeInTheDocument();
    expect(screen.getByText("Move ideas forward")).toBeInTheDocument();
  });

  it("opens the inspector drawer on demand and closes it", async () => {
    const user = userEvent.setup();
    mapMocks.listMindMaps.mockResolvedValue([map({ title: "Feature plan" })]);

    renderMapsPage();

    await screen.findByRole("option", { name: "Feature plan" });
    await user.selectOptions(screen.getByLabelText("Open map"), "map-1");
    fireEvent.click(await screen.findByText("Persisted feature"));

    expect(screen.queryByRole("heading", { name: "Inspector" })).toBeNull();

    await user.click(screen.getByRole("button", { name: "Details" }));
    expect(screen.getByRole("heading", { name: "Inspector" })).toBeTruthy();
    expect(screen.getByLabelText("Node title")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Close details" }));
    expect(screen.queryByRole("heading", { name: "Inspector" })).toBeNull();
  });
});
