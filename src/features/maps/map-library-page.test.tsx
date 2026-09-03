import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MindMap } from "./maps.queries";
import { MapLibraryPage } from "./map-library-page";

const mapMocks = vi.hoisted(() => ({
  archiveMindMap: vi.fn(),
  createMindMap: vi.fn(),
  duplicateMindMap: vi.fn(),
  listMindMapPreviews: vi.fn(),
  listMindMaps: vi.fn(),
  replaceMindMapGraph: vi.fn(),
  updateMindMap: vi.fn(),
}));

vi.mock("../../lib/supabase/client", () => ({ supabase: {} }));
vi.mock("../workspaces/workspace-context", () => ({ useWorkspaceId: () => "workspace-1" }));
vi.mock("../auth/use-auth", () => ({ useAuth: () => ({ isLoading: false, user: { id: "user-1" } }) }));
vi.mock("./maps.queries", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./maps.queries")>();
  return { ...actual, ...mapMocks };
});

function map(overrides: Partial<MindMap> = {}): MindMap {
  return {
    id: "map-1",
    workspace_id: "workspace-1",
    project_id: null,
    title: "Feature plan",
    description: "",
    default_view: "mind_map",
    created_by: "user-1",
    created_at: "2026-09-01T00:00:00.000Z",
    updated_at: "2026-09-01T00:00:00.000Z",
    archived_at: null,
    ...overrides,
  };
}

function renderLibrary(projectId: string | null = null) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const onOpenMap = vi.fn();
  render(
    <QueryClientProvider client={queryClient}>
      <MapLibraryPage onOpenMap={onOpenMap} projectId={projectId} />
    </QueryClientProvider>,
  );
  return { onOpenMap, queryClient };
}

describe("MapLibraryPage", () => {
  // A mutable backing store so `listMindMaps` reflects what `archiveMindMap`
  // actually did (archived_at filtering), the way the real Supabase-backed
  // query does — rather than a fixed resolved value that would make a
  // post-archive refetch put the archived row right back.
  let rows: MindMap[] = [];

  beforeEach(() => {
    vi.clearAllMocks();
    rows = [map(), map({ id: "map-2", title: "Roadmap" })];
    mapMocks.listMindMaps.mockImplementation(async () => rows.filter((row) => row.archived_at === null));
    mapMocks.listMindMapPreviews.mockResolvedValue({
      "map-1": { nodes: [{ id: "a", position: { x: 0, y: 0 }, nodeType: "idea" }, { id: "b", position: { x: 1, y: 1 }, nodeType: "idea" }], edges: [] },
      "map-2": { nodes: [], edges: [] },
    });
    mapMocks.createMindMap.mockResolvedValue(map({ id: "map-new", title: "Feature plan" }));
    mapMocks.replaceMindMapGraph.mockImplementation(async (_client: unknown, input: { graph: unknown }) => input.graph);
    mapMocks.updateMindMap.mockResolvedValue(map({ title: "Renamed" }));
    mapMocks.archiveMindMap.mockImplementation(async (_client: unknown, input: { id: string; workspaceId: string }) => {
      const index = rows.findIndex((row) => row.id === input.id);
      const archived = index === -1 ? map({ id: input.id, archived_at: "now" }) : { ...rows[index], archived_at: "now" };
      if (index !== -1) rows[index] = archived;
      return archived;
    });
    mapMocks.duplicateMindMap.mockResolvedValue(map({ id: "map-copy", title: "Feature plan copy" }));
  });

  it("renders a card per map with node counts and opens a map", async () => {
    const user = userEvent.setup();
    const { onOpenMap } = renderLibrary();

    expect(await screen.findByRole("button", { name: "Feature plan" })).toBeTruthy();
    expect(await screen.findByText(/2 nodes/)).toBeTruthy();
    expect(screen.getByText(/0 nodes/)).toBeTruthy();
    expect(mapMocks.listMindMapPreviews).toHaveBeenCalledWith({}, { workspaceId: "workspace-1", mapIds: ["map-1", "map-2"] });

    await user.click(screen.getByRole("button", { name: "Roadmap" }));
    expect(onOpenMap).toHaveBeenCalledWith("map-2");
  });

  it("shows the empty state with the feature strip when there are no maps", async () => {
    mapMocks.listMindMaps.mockResolvedValue([]);
    renderLibrary();

    expect(await screen.findByText("No maps yet")).toBeTruthy();
    expect(screen.getByLabelText("What maps are for")).toBeTruthy();
    expect(mapMocks.listMindMapPreviews).not.toHaveBeenCalled();
  });

  it("creates a map from a template, persists its nodes, and opens it", async () => {
    const user = userEvent.setup();
    const { onOpenMap } = renderLibrary("project-1");
    await screen.findByRole("button", { name: "Feature plan" });

    await user.click(screen.getByRole("button", { name: "New map" }));
    await user.click(screen.getByRole("radio", { name: /Feature plan/ }));
    await user.click(screen.getByRole("button", { name: "Create map" }));

    await waitFor(() => expect(onOpenMap).toHaveBeenCalledWith("map-new"));
    expect(mapMocks.createMindMap).toHaveBeenCalledWith({}, expect.objectContaining({ projectId: "project-1", title: "Feature plan", userId: "user-1" }));
    const replaceInput = mapMocks.replaceMindMapGraph.mock.calls[0][1] as { mapId: string; graph: { nodes: unknown[]; title: string } };
    expect(replaceInput.mapId).toBe("map-new");
    expect(replaceInput.graph.nodes).toHaveLength(8);
    expect(replaceInput.graph.title).toBe("Feature plan");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("creates a blank map without a graph write", async () => {
    const user = userEvent.setup();
    mapMocks.createMindMap.mockResolvedValue(map({ id: "map-blank", title: "Untitled map" }));
    const { onOpenMap } = renderLibrary();
    await screen.findByRole("button", { name: "Feature plan" });

    await user.click(screen.getByRole("button", { name: "New map" }));
    await user.click(screen.getByRole("button", { name: "Create map" }));

    await waitFor(() => expect(onOpenMap).toHaveBeenCalledWith("map-blank"));
    expect(mapMocks.replaceMindMapGraph).not.toHaveBeenCalled();
  });

  it("archives the new row and shows the error when the template graph fails to save", async () => {
    const user = userEvent.setup();
    mapMocks.replaceMindMapGraph.mockRejectedValue(new Error("graph failed"));
    const { onOpenMap } = renderLibrary();
    await screen.findByRole("button", { name: "Feature plan" });

    await user.click(screen.getByRole("button", { name: "New map" }));
    await user.click(screen.getByRole("radio", { name: /Feature plan/ }));
    await user.click(screen.getByRole("button", { name: "Create map" }));

    expect(await screen.findByText("graph failed")).toBeTruthy();
    expect(mapMocks.archiveMindMap).toHaveBeenCalledWith({}, { id: "map-new", workspaceId: "workspace-1" });
    expect(onOpenMap).not.toHaveBeenCalled();
  });

  it("renames a map from its menu", async () => {
    const user = userEvent.setup();
    renderLibrary();
    await screen.findByRole("button", { name: "Feature plan" });

    await user.click(screen.getByRole("button", { name: "Map actions for Feature plan" }));
    await user.click(screen.getByRole("menuitem", { name: "Rename" }));
    const input = screen.getByRole("textbox", { name: "Map title" });
    await user.clear(input);
    await user.type(input, "Renamed{Enter}");

    await waitFor(() =>
      expect(mapMocks.updateMindMap).toHaveBeenCalledWith({}, { id: "map-1", workspaceId: "workspace-1", title: "Renamed" }),
    );
  });

  it("archives a map and removes its card", async () => {
    const user = userEvent.setup();
    renderLibrary();
    await screen.findByRole("button", { name: "Feature plan" });

    await user.click(screen.getByRole("button", { name: "Map actions for Feature plan" }));
    await user.click(screen.getByRole("menuitem", { name: "Archive" }));

    await waitFor(() => expect(screen.queryByRole("button", { name: "Feature plan" })).toBeNull());
    expect(mapMocks.archiveMindMap).toHaveBeenCalledWith({}, { id: "map-1", workspaceId: "workspace-1" });
  });

  it("clears a stale action error once a later mutation succeeds", async () => {
    const user = userEvent.setup();
    mapMocks.updateMindMap.mockRejectedValueOnce(new Error("rename failed"));
    renderLibrary();
    await screen.findByRole("button", { name: "Feature plan" });

    await user.click(screen.getByRole("button", { name: "Map actions for Feature plan" }));
    await user.click(screen.getByRole("menuitem", { name: "Rename" }));
    const input = screen.getByRole("textbox", { name: "Map title" });
    await user.clear(input);
    await user.type(input, "Renamed{Enter}");

    expect(await screen.findByText("rename failed")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Map actions for Roadmap" }));
    await user.click(screen.getByRole("menuitem", { name: "Archive" }));

    await waitFor(() => expect(screen.queryByRole("button", { name: "Roadmap" })).toBeNull());
    expect(screen.queryByText("rename failed")).toBeNull();
  });

  it("duplicates a map and opens the copy", async () => {
    const user = userEvent.setup();
    const { onOpenMap } = renderLibrary();
    await screen.findByRole("button", { name: "Feature plan" });

    await user.click(screen.getByRole("button", { name: "Map actions for Feature plan" }));
    await user.click(screen.getByRole("menuitem", { name: "Duplicate" }));

    await waitFor(() => expect(onOpenMap).toHaveBeenCalledWith("map-copy"));
    expect(mapMocks.duplicateMindMap).toHaveBeenCalledWith(
      {},
      { workspaceId: "workspace-1", projectId: null, userId: "user-1", sourceMapId: "map-1", title: "Feature plan copy" },
    );
  });
});
