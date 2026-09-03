import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { notesKeys } from "../notes/notes.queries";
import { MAP_HINTS_KEY, MapEditorPage } from "./map-editor-page";
import type { EditableMapGraph, EditableMapNode } from "./map-types";
import { mindMapKeys } from "./maps.queries";

const mapMocks = vi.hoisted(() => ({
  convertMindMapNode: vi.fn(),
  getMindMapGraph: vi.fn(),
  replaceMindMapGraph: vi.fn(),
}));
const canvasMocks = vi.hoisted(() => ({ fitView: vi.fn() }));

vi.mock("../../lib/supabase/client", () => ({ supabase: {} }));
vi.mock("../workspaces/workspace-context", () => ({ useWorkspaceId: () => "workspace-1" }));
vi.mock("../auth/use-auth", () => ({ useAuth: () => ({ isLoading: false, user: { id: "user-1" } }) }));
vi.mock("./maps.queries", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./maps.queries")>();
  return { ...actual, ...mapMocks };
});
vi.mock("./map-canvas", async () => {
  const React = await import("react");
  const MapCanvas = React.forwardRef(function MockCanvas(
    props: {
      graph: EditableMapGraph;
      renamingNodeId: string | null;
      className?: string;
      onChange: (graph: EditableMapGraph) => void;
      onSelect: (selection: { kind: "node"; id: string } | null) => void;
    },
    ref: React.ForwardedRef<{ fitView: () => void; viewportCenter: () => { x: number; y: number } }>,
  ) {
    React.useImperativeHandle(ref, () => ({ fitView: canvasMocks.fitView, viewportCenter: () => ({ x: 500, y: 300 }) }));
    return (
      <div data-classname={props.className ?? ""} data-renaming={props.renamingNodeId ?? ""} data-testid="mock-canvas">
        {props.graph.nodes.map((node) => (
          <button key={node.id} onClick={() => props.onSelect({ kind: "node", id: node.id })} type="button">
            {node.title} ({node.position.x}, {node.position.y})
          </button>
        ))}
        <span data-testid="edge-count">{props.graph.edges.length}</span>
        <button onClick={() => props.onChange({ ...props.graph, title: "Edited" })} type="button">
          Mock edit
        </button>
      </div>
    );
  });
  return { MapCanvas };
});

function node(id: string, extra: Partial<EditableMapNode> = {}): EditableMapNode {
  return { id, title: id, body: "", nodeType: "idea", status: "open", position: { x: 0, y: 0 }, accent: "cyan", tags: [], ...extra };
}

function graphWith(nodeCount: number): EditableMapGraph {
  const nodes = Array.from({ length: nodeCount }, (_, index) => node(`n${index + 1}`, { position: { x: index * 300, y: 0 } }));
  return {
    title: "Feature plan",
    description: "",
    defaultView: "mind_map",
    nodes,
    edges: nodeCount > 1 ? [{ id: "n1-n2", sourceNodeId: "n1", targetNodeId: "n2", edgeType: "association", label: "", isDirectional: false }] : [],
  };
}

function renderEditor(projectId: string | null = null) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const onBack = vi.fn();
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <MapEditorPage mapId="map-1" onBack={onBack} projectId={projectId} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { onBack, queryClient };
}

describe("MapEditorPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.removeItem(MAP_HINTS_KEY);
    mapMocks.getMindMapGraph.mockResolvedValue(graphWith(2));
    mapMocks.replaceMindMapGraph.mockImplementation(async (_client: unknown, input: { graph: EditableMapGraph }) => input.graph);
    mapMocks.convertMindMapNode.mockResolvedValue({
      node: { converted_id: "note-1", converted_type: "note", converted_at: "2026-09-01T00:00:00.000Z" },
      convertedObject: { id: "note-1" },
      alreadyConverted: false,
    });
  });

  it("loads the map, shows its title, and goes back", async () => {
    const user = userEvent.setup();
    const { onBack } = renderEditor();

    expect(await screen.findByRole("textbox", { name: "Map title" })).toHaveValue("Feature plan");
    expect(mapMocks.getMindMapGraph).toHaveBeenCalledWith({}, { workspaceId: "workspace-1", mapId: "map-1" });

    await user.click(screen.getByRole("button", { name: "Maps" }));
    expect(onBack).toHaveBeenCalled();
  });

  it("adds a node at the viewport centre and starts renaming it", async () => {
    const user = userEvent.setup();
    renderEditor();
    await screen.findByRole("textbox", { name: "Map title" });

    await user.click(screen.getByRole("button", { name: "Add node" }));

    expect(screen.getByRole("button", { name: /New idea \(500, 300\)/ })).toBeTruthy();
    expect(screen.getByTestId("mock-canvas").dataset.renaming).not.toBe("");
  });

  it("adds a connected child when a node is selected", async () => {
    const user = userEvent.setup();
    renderEditor();
    await screen.findByRole("textbox", { name: "Map title" });

    await user.click(screen.getByRole("button", { name: /^n1 / }));
    await user.click(screen.getByRole("button", { name: "Add node" }));

    expect(screen.getAllByRole("button", { name: /\(\d+, \d+\)$/ })).toHaveLength(3);
    expect(screen.getByTestId("edge-count").textContent).toBe("2");
  });

  it("arranges the map, fits the view, and undoes", async () => {
    const user = userEvent.setup();
    renderEditor();
    await screen.findByRole("textbox", { name: "Map title" });

    await user.click(screen.getByRole("button", { name: "Arrange" }));
    await user.click(screen.getByRole("menuitem", { name: "Top down" }));

    expect(screen.getByRole("button", { name: /^n2 \(0, 150\)/ })).toBeTruthy();
    await waitFor(() => expect(canvasMocks.fitView).toHaveBeenCalled());

    await user.click(screen.getByRole("button", { name: "Undo" }));
    expect(screen.getByRole("button", { name: /^n2 \(300, 0\)/ })).toBeTruthy();
  });

  it("autosaves after an edit and flushes on Ctrl+S", async () => {
    const user = userEvent.setup();
    const { queryClient } = renderEditor();
    await screen.findByRole("textbox", { name: "Map title" });
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    await user.click(screen.getByRole("button", { name: "Mock edit" }));
    await waitFor(() => expect(mapMocks.replaceMindMapGraph).toHaveBeenCalledTimes(1));
    expect((mapMocks.replaceMindMapGraph.mock.calls[0][1] as { graph: EditableMapGraph }).graph.title).toBe("Edited");
    expect(await screen.findByText("Saved")).toBeTruthy();
    await waitFor(() =>
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: mindMapKeys.previews("workspace-1", null) }),
    );

    await user.click(screen.getByRole("button", { name: "Mock edit" }));
    await user.keyboard("{Control>}s{/Control}");
    await waitFor(() => expect(mapMocks.replaceMindMapGraph).toHaveBeenCalledTimes(2));
  });

  it("shows the hint strip for small maps until dismissed", async () => {
    const user = userEvent.setup();
    renderEditor();
    await screen.findByRole("textbox", { name: "Map title" });

    expect(screen.getByTestId("map-hint-strip")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Dismiss hints" }));
    expect(screen.queryByTestId("map-hint-strip")).toBeNull();
    expect(window.localStorage.getItem(MAP_HINTS_KEY)).toBe("1");
  });

  it("hides the hint strip and the empty message once the map has three nodes", async () => {
    mapMocks.getMindMapGraph.mockResolvedValue(graphWith(3));
    renderEditor();
    await screen.findByRole("textbox", { name: "Map title" });

    expect(screen.queryByTestId("map-hint-strip")).toBeNull();
    expect(screen.queryByText("Double-click anywhere to place your first idea")).toBeNull();
  });

  it("shows the empty canvas message for a blank map", async () => {
    mapMocks.getMindMapGraph.mockResolvedValue(graphWith(0));
    renderEditor();
    await screen.findByRole("textbox", { name: "Map title" });

    expect(screen.getByText("Double-click anywhere to place your first idea")).toBeTruthy();
  });

  it("opens the inspector on selection, flushes before converting, and marks the node converted", async () => {
    const user = userEvent.setup();
    renderEditor();
    await screen.findByRole("textbox", { name: "Map title" });

    await user.click(screen.getByRole("button", { name: "Mock edit" }));
    await user.click(screen.getByRole("button", { name: /^n1 / }));
    expect(screen.getByRole("complementary", { name: "Map details" })).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Note" }));

    await waitFor(() => expect(mapMocks.convertMindMapNode).toHaveBeenCalled());
    expect(mapMocks.replaceMindMapGraph.mock.invocationCallOrder[0]).toBeLessThan(mapMocks.convertMindMapNode.mock.invocationCallOrder[0]);
    expect(mapMocks.convertMindMapNode).toHaveBeenCalledWith({}, { id: "n1", workspaceId: "workspace-1", projectId: null, convertedType: "note" });
    expect(await screen.findByText(/Converted to note/)).toBeTruthy();
  });

  it("toggles the map details from the toolbar", async () => {
    const user = userEvent.setup();
    renderEditor();
    await screen.findByRole("textbox", { name: "Map title" });

    await user.click(screen.getByRole("button", { name: "Details" }));
    expect(screen.getByText("Select a node or connection to edit it.")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Details" }));
    expect(screen.queryByRole("complementary", { name: "Map details" })).toBeNull();
  });

  it("commits a header title edit and reverts on Escape", async () => {
    const user = userEvent.setup();
    renderEditor();
    const title = await screen.findByRole("textbox", { name: "Map title" });

    await user.clear(title);
    await user.type(title, "Launch{Enter}");
    await waitFor(() => expect(mapMocks.replaceMindMapGraph).toHaveBeenCalled());
    expect((mapMocks.replaceMindMapGraph.mock.calls[0][1] as { graph: EditableMapGraph }).graph.title).toBe("Launch");

    await user.type(title, "!!!{Escape}");
    expect(title).toHaveValue("Launch");
  });

  it("flushes the title draft on Ctrl+S even without pressing Enter first", async () => {
    const user = userEvent.setup();
    renderEditor();
    const title = await screen.findByRole("textbox", { name: "Map title" });

    await user.clear(title);
    await user.type(title, "Renamed");
    await user.keyboard("{Control>}s{/Control}");

    await waitFor(() => expect(mapMocks.replaceMindMapGraph).toHaveBeenCalled());
    expect((mapMocks.replaceMindMapGraph.mock.calls[0][1] as { graph: EditableMapGraph }).graph.title).toBe("Renamed");
  });

  it("clears a stale conversion error once a different node is selected", async () => {
    const user = userEvent.setup();
    mapMocks.convertMindMapNode.mockRejectedValueOnce(new Error("boom"));
    renderEditor();
    await screen.findByRole("textbox", { name: "Map title" });

    await user.click(screen.getByRole("button", { name: /^n1 / }));
    await user.click(screen.getByRole("button", { name: "Note" }));
    expect(await screen.findByText("boom")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: /^n2 / }));
    expect(screen.queryByText("boom")).toBeNull();
  });

  describe("with a project", () => {
    it("sizes the canvas for the project layout", async () => {
      renderEditor("project-1");
      await screen.findByRole("textbox", { name: "Map title" });

      expect(screen.getByTestId("mock-canvas").dataset.classname).toContain("calc(100vh-14rem)");
    });

    it("converts to a task, invalidating work items and the due calendar", async () => {
      const user = userEvent.setup();
      mapMocks.convertMindMapNode.mockImplementation(
        async (_client: unknown, input: { convertedType: string }) => ({
          node: { converted_id: "task-1", converted_type: input.convertedType, converted_at: "2026-09-01T00:00:00.000Z" },
          convertedObject: { id: "task-1" },
          alreadyConverted: false,
        }),
      );
      const { queryClient } = renderEditor("project-1");
      await screen.findByRole("textbox", { name: "Map title" });
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

      await user.click(screen.getByRole("button", { name: /^n1 / }));
      await user.click(screen.getByRole("button", { name: "Task" }));

      await waitFor(() =>
        expect(mapMocks.convertMindMapNode).toHaveBeenCalledWith(
          {},
          { id: "n1", workspaceId: "workspace-1", projectId: "project-1", convertedType: "task" },
        ),
      );
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["work-items", "workspace-1", "project-1"] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["due-calendar"] });
    });

    it("converts to a note, invalidating the workspace and project notes lists", async () => {
      const user = userEvent.setup();
      mapMocks.convertMindMapNode.mockImplementation(
        async (_client: unknown, input: { convertedType: string }) => ({
          node: { converted_id: "note-1", converted_type: input.convertedType, converted_at: "2026-09-01T00:00:00.000Z" },
          convertedObject: { id: "note-1" },
          alreadyConverted: false,
        }),
      );
      const { queryClient } = renderEditor("project-1");
      await screen.findByRole("textbox", { name: "Map title" });
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

      await user.click(screen.getByRole("button", { name: /^n1 / }));
      await user.click(screen.getByRole("button", { name: "Note" }));

      await waitFor(() => expect(mapMocks.convertMindMapNode).toHaveBeenCalled());
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: notesKeys.workspace("workspace-1") });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: notesKeys.project("workspace-1", "project-1") });
    });
  });
});
