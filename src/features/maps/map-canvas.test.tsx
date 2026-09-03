import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef, type ComponentProps } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EditableMapGraph } from "./map-types";
import { MapCanvas, type MapCanvasHandle } from "./map-canvas";

const { captured, fitViewMock } = vi.hoisted(() => ({
  captured: {} as Record<string, unknown>,
  fitViewMock: vi.fn(),
}));

vi.mock("@xyflow/react", () => ({
  addEdge: (connection: { id: string; source: string; target: string }, edges: Array<{ id: string }>) => [
    ...edges,
    { id: connection.id, source: connection.source, target: connection.target },
  ],
  applyEdgeChanges: (_changes: unknown, edges: unknown) => edges,
  Background: () => <div data-testid="map-background" />,
  BackgroundVariant: { Dots: "dots" },
  Controls: () => <div data-testid="map-controls" />,
  Handle: ({ type }: { type: string }) => <span data-testid={`handle-${type}`} />,
  MarkerType: { ArrowClosed: "arrowclosed" },
  MiniMap: () => <div data-testid="map-minimap" />,
  Position: { Left: "left", Right: "right" },
  ReactFlowProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useReactFlow: () => ({
    fitView: fitViewMock,
    screenToFlowPosition: (position: { x: number; y: number }) => ({ x: position.x + 1000, y: position.y + 1000 }),
  }),
  ReactFlow: (props: {
    children: React.ReactNode;
    className?: string;
    edges?: Array<{ id: string; className?: string; source: string; target: string; selected?: boolean; markerEnd?: unknown }>;
    nodes: Array<{ id: string; className?: string; data: { label: string; isRenaming: boolean }; position: { x: number; y: number } }>;
    onConnect?: (connection: { source: string; target: string }) => void;
    onEdgeClick?: (event: unknown, edge: { id: string }) => void;
    onNodeClick?: (event: unknown, node: { id: string }) => void;
    onNodeDoubleClick?: (event: unknown, node: { id: string }) => void;
    onNodesChange?: (changes: Array<{ id: string; position?: { x: number; y: number }; dragging?: boolean; type: string }>) => void;
    onPaneClick?: () => void;
    deleteKeyCode?: unknown;
  }) => {
    Object.assign(captured, props);
    return (
      <div data-testid="mock-react-flow">
        {props.nodes.map((node) => (
          <button
            className={node.className}
            data-renaming={node.data.isRenaming}
            key={node.id}
            onClick={() => props.onNodeClick?.({}, { id: node.id })}
            onDoubleClick={() => props.onNodeDoubleClick?.({}, { id: node.id })}
            type="button"
          >
            {node.data.label} ({node.position.x}, {node.position.y})
          </button>
        ))}
        {props.edges?.map((edge) => (
          <div className="react-flow__edge" key={edge.id}>
            <button
              className={edge.className}
              data-marker={edge.markerEnd ? "arrow" : "none"}
              data-selected={edge.selected}
              data-testid={`mock-edge-${edge.id}`}
              onClick={() => props.onEdgeClick?.({}, { id: edge.id })}
              type="button"
            >
              {edge.source} to {edge.target}
            </button>
          </div>
        ))}
        <button onClick={() => props.onPaneClick?.()} type="button">
          Mock pane
        </button>
        <button
          onClick={() => {
            props.onNodesChange?.([{ id: "node-1", type: "position", position: { x: 10, y: 10 }, dragging: true }]);
            props.onNodesChange?.([{ id: "node-1", type: "position", position: { x: 42, y: 84 }, dragging: false }]);
          }}
          type="button"
        >
          Mock drag node
        </button>
        <button onClick={() => props.onConnect?.({ source: "node-1", target: "node-2" })} type="button">
          Mock connect
        </button>
        <button onClick={() => props.onConnect?.({ source: "node-1", target: "node-1" })} type="button">
          Mock self connect
        </button>
        {props.children}
      </div>
    );
  },
}));

const graph: EditableMapGraph = {
  title: "Ideas",
  description: "",
  defaultView: "mind_map",
  nodes: [
    { id: "node-1", title: "Feature idea", body: "", nodeType: "idea", status: "open", position: { x: 0, y: 0 }, accent: "cyan", tags: [] },
    { id: "node-2", title: "Second idea", body: "", nodeType: "idea", status: "open", position: { x: 20, y: 20 }, accent: "cyan", tags: [] },
    { id: "node-3", title: "Third idea", body: "", nodeType: "idea", status: "open", position: { x: 40, y: 40 }, accent: "cyan", tags: [] },
  ],
  edges: [
    { id: "e-1-2", sourceNodeId: "node-1", targetNodeId: "node-2", edgeType: "association", label: "", isDirectional: false },
    { id: "e-2-3", sourceNodeId: "node-2", targetNodeId: "node-3", edgeType: "sequence", label: "", isDirectional: true },
  ],
};

function renderCanvas(overrides: Partial<ComponentProps<typeof MapCanvas>> = {}) {
  const props = Object.assign(
    {
      graph,
      selection: null,
      renamingNodeId: null,
      onChange: vi.fn(),
      onSelect: vi.fn(),
      onRenamingChange: vi.fn(),
    },
    overrides,
  );
  const ref = createRef<MapCanvasHandle>();
  const view = render(<MapCanvas ref={ref} {...props} />);
  return { ...view, props, ref };
}

describe("MapCanvas", () => {
  beforeEach(() => {
    fitViewMock.mockClear();
    for (const key of Object.keys(captured)) delete captured[key];
  });

  it("renders nodes, edges, arrowheads on directional edges, and marks the selection", () => {
    renderCanvas({ selection: { kind: "edge", id: "e-2-3" } });

    expect(screen.getByRole("button", { name: /Feature idea/ })).toBeTruthy();
    expect(screen.getByTestId("mock-edge-e-1-2").dataset.marker).toBe("none");
    expect(screen.getByTestId("mock-edge-e-2-3").dataset.marker).toBe("arrow");
    expect(screen.getByTestId("mock-edge-e-2-3").dataset.selected).toBe("true");
    expect(screen.getByTestId("mock-edge-e-2-3")).toHaveClass("orbit-map-edge-selected");
    expect(captured.deleteKeyCode).toBeNull();
  });

  it("selects nodes, edges and clears on the pane", async () => {
    const user = userEvent.setup();
    const { props } = renderCanvas();

    await user.click(screen.getByRole("button", { name: /Feature idea/ }));
    expect(props.onSelect).toHaveBeenLastCalledWith({ kind: "node", id: "node-1" });
    await user.click(screen.getByTestId("mock-edge-e-1-2"));
    expect(props.onSelect).toHaveBeenLastCalledWith({ kind: "edge", id: "e-1-2" });
    await user.click(screen.getByRole("button", { name: "Mock pane" }));
    expect(props.onSelect).toHaveBeenLastCalledWith(null);
  });

  it("records a drag as one undoable change", async () => {
    const user = userEvent.setup();
    const { props } = renderCanvas();

    await user.click(screen.getByRole("button", { name: "Mock drag node" }));

    expect(props.onChange).toHaveBeenCalledTimes(2);
    expect(props.onChange.mock.calls[0][1]).toEqual({ undoable: false });
    expect(props.onChange.mock.calls[1][1]).toEqual({ undoable: true });
    expect(props.onChange.mock.calls[1][0].nodes[0].position).toEqual({ x: 42, y: 84 });
  });

  it("connects nodes and ignores self connections", async () => {
    const user = userEvent.setup();
    const { props } = renderCanvas();

    await user.click(screen.getByRole("button", { name: "Mock self connect" }));
    expect(props.onChange).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Mock connect" }));
    expect(props.onChange.mock.calls[0][0].edges).toHaveLength(3);
  });

  it("creates a node on double-click, selects it and starts renaming", async () => {
    const user = userEvent.setup();
    const { props } = renderCanvas();

    await user.dblClick(screen.getByRole("button", { name: "Mock pane" }));

    const next = props.onChange.mock.calls[0][0] as EditableMapGraph;
    expect(next.nodes).toHaveLength(4);
    expect(next.nodes[3].position).toEqual({ x: 1000, y: 1000 });
    expect(props.onSelect).toHaveBeenCalledWith({ kind: "node", id: next.nodes[3].id });
    expect(props.onRenamingChange).toHaveBeenCalledWith(next.nodes[3].id);
  });

  it("does not create a node when double-clicking an edge", async () => {
    const user = userEvent.setup();
    const { props } = renderCanvas();

    await user.dblClick(screen.getByTestId("mock-edge-e-1-2"));

    expect(props.onChange).not.toHaveBeenCalled();
  });

  it("renames on node double-click and F2", async () => {
    const user = userEvent.setup();
    const { props } = renderCanvas({ selection: { kind: "node", id: "node-2" } });

    await user.dblClick(screen.getByRole("button", { name: /Second idea/ }));
    expect(props.onRenamingChange).toHaveBeenLastCalledWith("node-2");

    screen.getByRole("application").focus();
    await user.keyboard("{F2}");
    expect(props.onRenamingChange).toHaveBeenLastCalledWith("node-2");
  });

  it("adds a child on Tab and a sibling on Enter", async () => {
    const user = userEvent.setup();
    const { props } = renderCanvas({ selection: { kind: "node", id: "node-2" } });
    screen.getByRole("application").focus();

    await user.keyboard("{Tab}");
    const child = props.onChange.mock.calls[0][0] as EditableMapGraph;
    expect(child.nodes).toHaveLength(4);
    expect(child.edges.at(-1)?.sourceNodeId).toBe("node-2");

    await user.keyboard("{Enter}");
    const sibling = props.onChange.mock.calls[1][0] as EditableMapGraph;
    expect(sibling.edges.at(-1)?.sourceNodeId).toBe("node-1");
  });

  it("deletes the selected node or edge and clears the selection", async () => {
    const user = userEvent.setup();
    const { props, rerender, ref } = renderCanvas({ selection: { kind: "node", id: "node-2" } });
    screen.getByRole("application").focus();

    await user.keyboard("{Delete}");
    const withoutNode = props.onChange.mock.calls[0][0] as EditableMapGraph;
    expect(withoutNode.nodes.map((node) => node.id)).toEqual(["node-1", "node-3"]);
    expect(withoutNode.edges).toEqual([]);
    expect(props.onSelect).toHaveBeenLastCalledWith(null);

    rerender(<MapCanvas ref={ref} {...props} selection={{ kind: "edge", id: "e-1-2" }} />);
    screen.getByRole("application").focus();
    await user.keyboard("{Backspace}");
    const withoutEdge = props.onChange.mock.calls[1][0] as EditableMapGraph;
    expect(withoutEdge.edges.map((edge) => edge.id)).toEqual(["e-2-3"]);
  });

  it("clears selection and rename on Escape", async () => {
    const user = userEvent.setup();
    const { props } = renderCanvas({ selection: { kind: "node", id: "node-1" }, renamingNodeId: "node-1" });
    screen.getByRole("application").focus();

    await user.keyboard("{Escape}");

    expect(props.onSelect).toHaveBeenLastCalledWith(null);
    expect(props.onRenamingChange).toHaveBeenLastCalledWith(null);
  });

  it("exposes fitView and the viewport centre through the ref", () => {
    const { ref } = renderCanvas();
    vi.spyOn(screen.getByRole("application"), "getBoundingClientRect").mockReturnValue({
      left: 100, top: 50, width: 800, height: 400, right: 900, bottom: 450, x: 100, y: 50, toJSON: () => ({}),
    });

    ref.current?.fitView();
    expect(fitViewMock).toHaveBeenCalled();
    expect(ref.current?.viewportCenter()).toEqual({ x: 1500, y: 1250 });
  });
});
