import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { EditableMapGraph } from "./map-types";
import { MapCanvas } from "./map-canvas";

const { capturedBackgroundProps, capturedMiniMapProps, capturedReactFlowProps } = vi.hoisted(() => ({
  capturedBackgroundProps: {} as Record<string, unknown>,
  capturedMiniMapProps: {} as Record<string, unknown>,
  capturedReactFlowProps: {} as Record<string, unknown>,
}));

vi.mock("@xyflow/react", () => ({
  addEdge: (connection: { id: string; source: string; target: string }, edges: Array<{ id: string }>) => [
    ...edges,
    {
      id: connection.id,
      source: connection.source,
      target: connection.target,
    },
  ],
  applyEdgeChanges: (_changes: unknown, edges: unknown) => edges,
  applyNodeChanges: (
    changes: Array<{ id: string; position?: { x: number; y: number }; type: string }>,
    nodes: Array<{ id: string }>,
  ) =>
    nodes
      .filter((node) => !changes.some((item) => item.id === node.id && item.type === "remove"))
      .map((node) => {
      const change = changes.find((item) => item.id === node.id && item.type === "position");
      return change?.position ? { ...node, position: change.position } : node;
    }),
  Background: (props: Record<string, unknown>) => {
    Object.assign(capturedBackgroundProps, props);
    return <div data-testid="map-background" />;
  },
  BackgroundVariant: { Dots: "dots" },
  Controls: () => <div data-testid="map-controls" />,
  Handle: ({ type }: { type: string }) => <span data-testid={`handle-${type}`} />,
  MiniMap: (props: Record<string, unknown>) => {
    Object.assign(capturedMiniMapProps, props);
    return <div data-testid="map-minimap" />;
  },
  Position: { Left: "left", Right: "right" },
  ReactFlowProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useReactFlow: () => ({ screenToFlowPosition: (position: { x: number; y: number }) => position }),
  ReactFlow: (props: {
    children: React.ReactNode;
    className?: string;
    edgeTypes?: Record<string, unknown>;
    edges?: Array<{
      id: string;
      animated?: boolean;
      className?: string;
      source: string;
      target: string;
      type?: string;
    }>;
    fitViewOptions?: { padding: number; minZoom: number; maxZoom: number };
    nodes: Array<{ id: string; className?: string; data: { label: string }; position: { x: number; y: number } }>;
    onConnect?: (connection: { source: string; target: string }) => void;
    onNodeClick?: (event: unknown, node: { id: string }) => void;
    onNodesChange?: (
      changes: Array<{ id: string; position?: { x: number; y: number }; selected?: boolean; type: string }>,
    ) => void;
    onPaneClick?: () => void;
    proOptions?: { hideAttribution: boolean };
  }) => {
    Object.assign(capturedReactFlowProps, props);
    const {
      children,
      edges = [],
      nodes,
      onConnect,
      onNodeClick,
      onNodesChange,
      onPaneClick,
    } = props;

    return (
      <div className={props.className} data-testid="mock-react-flow">
      {nodes.map((node) => (
        <button className={node.className} key={node.id} type="button" onClick={() => onNodeClick?.({}, { id: node.id })}>
          {node.data.label} ({node.position.x}, {node.position.y})
        </button>
      ))}
      {edges.map((edge) => (
        <span className={edge.className} data-testid={`mock-edge-${edge.id}`} key={edge.id}>
          {edge.source} to {edge.target}
        </span>
      ))}
      <button type="button" onClick={() => onPaneClick?.()}>
        Mock pane
      </button>
      <button type="button" onClick={() => onNodesChange?.([{ id: "node-1", type: "position", position: { x: 42, y: 84 } }])}>
        Mock move node
      </button>
      <button type="button" onClick={() => onNodesChange?.([{ id: "node-1", type: "select", selected: true }])}>
        Mock select node change
      </button>
      <button type="button" onClick={() => onNodesChange?.([{ id: "node-1", type: "remove" }])}>
        Mock remove node
      </button>
      <button type="button" onClick={() => onConnect?.({ source: "node-1", target: "node-2" })}>
        Mock connect
      </button>
      <button type="button" onClick={() => onConnect?.({ source: "node-1", target: "node-1" })}>
        Mock self connect
      </button>
      {children}
    </div>
    );
  },
}));

const graph: EditableMapGraph = {
  title: "Ideas",
  description: "",
  defaultView: "mind_map",
  nodes: [
    {
      id: "node-1",
      title: "Feature idea",
      body: "",
      nodeType: "idea",
      status: "open",
      position: { x: 0, y: 0 },
      accent: "cyan",
      tags: [],
    },
    {
      id: "node-2",
      title: "Second idea",
      body: "",
      nodeType: "idea",
      status: "open",
      position: { x: 20, y: 20 },
      accent: "cyan",
      tags: [],
    },
  ],
  edges: [],
};

describe("MapCanvas", () => {
  beforeEach(() => {
    Object.keys(capturedBackgroundProps).forEach((key) => delete capturedBackgroundProps[key]);
    Object.keys(capturedMiniMapProps).forEach((key) => delete capturedMiniMapProps[key]);
    Object.keys(capturedReactFlowProps).forEach((key) => delete capturedReactFlowProps[key]);
    vi.spyOn(crypto, "randomUUID").mockReturnValue("00000000-0000-4000-8000-000000000005");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("wraps the map in a constellation canvas shell", () => {
    render(<MapCanvas graph={graph} selectedNodeId={null} view="mind_map" onChange={() => undefined} onSelectNode={() => undefined} />);

    expect(screen.getByLabelText("Visual planning canvas")).toHaveClass("orbit-constellation-canvas");
    expect(screen.getByLabelText("Visual planning canvas")).toHaveClass("h-[max(32rem,calc(100vh-15rem))]");
    expect(screen.getByTestId("mock-react-flow")).toHaveClass("orbit-constellation-flow");
    expect(capturedBackgroundProps).toEqual(
      expect.objectContaining({ color: "rgba(148, 163, 184, 0.18)", gap: 32, size: 1, variant: "dots" }),
    );
    expect(capturedMiniMapProps).toEqual(
      expect.objectContaining({ bgColor: "var(--orbit-surface-quiet)", nodeColor: "#67e8f9", pannable: true }),
    );
  });

  it("registers starlight edges and hides XYFlow attribution", () => {
    render(<MapCanvas graph={graph} selectedNodeId={null} view="mind_map" onChange={() => undefined} onSelectNode={() => undefined} />);

    expect(capturedReactFlowProps.edgeTypes).toHaveProperty("starlight");
    expect(capturedReactFlowProps.proOptions).toEqual({ hideAttribution: true });
    expect(capturedReactFlowProps.fitViewOptions).toEqual({ padding: 0.32, minZoom: 0.55, maxZoom: 1.15 });
  });

  it("marks the selected map node with orbital styling", () => {
    render(<MapCanvas graph={graph} selectedNodeId="node-1" view="mind_map" onChange={() => undefined} onSelectNode={() => undefined} />);

    expect(screen.getByRole("button", { name: "Feature idea (0, 0)" })).toHaveClass("orbit-map-node", "orbit-map-node-selected");
  });

  it("does not apply beacon styling to an unselected converted node", () => {
    const convertedGraph: EditableMapGraph = {
      ...graph,
      nodes: [{ ...graph.nodes[0], status: "converted" }, graph.nodes[1]],
    };

    render(<MapCanvas graph={convertedGraph} selectedNodeId={null} view="mind_map" onChange={() => undefined} onSelectNode={() => undefined} />);

    expect(screen.getByRole("button", { name: "Feature idea (0, 0)" })).toHaveClass("orbit-map-node");
    expect(screen.getByRole("button", { name: "Feature idea (0, 0)" })).not.toHaveClass("orbit-map-node-selected");
    expect(screen.getByRole("button", { name: "Feature idea (0, 0)" })).not.toHaveClass("orbit-map-node-converted");
  });

  it("marks map edges with constellation styling by edge type", () => {
    const graphWithEdges: EditableMapGraph = {
      ...graph,
      edges: [
        {
          id: "edge-1",
          sourceNodeId: "node-1",
          targetNodeId: "node-2",
          edgeType: "association",
          label: "",
          isDirectional: false,
        },
        {
          id: "edge-2",
          sourceNodeId: "node-2",
          targetNodeId: "node-1",
          edgeType: "sequence",
          label: "",
          isDirectional: true,
        },
      ],
    };

    render(<MapCanvas graph={graphWithEdges} selectedNodeId={null} view="mind_map" onChange={() => undefined} onSelectNode={() => undefined} />);

    expect(screen.getByTestId("mock-edge-edge-1")).toHaveClass("orbit-map-edge");
    expect(screen.getByTestId("mock-edge-edge-2")).toHaveClass("orbit-map-edge-sequence");
    expect(capturedReactFlowProps.edges).toEqual([
      expect.objectContaining({ id: "edge-1", type: "starlight", animated: false }),
      expect.objectContaining({ id: "edge-2", type: "starlight", animated: false }),
    ]);
  });

  it("selects a node and clears selection from the pane", async () => {
    const user = userEvent.setup();
    const onSelectNode = vi.fn();

    render(<MapCanvas graph={graph} selectedNodeId={null} view="mind_map" onChange={() => undefined} onSelectNode={onSelectNode} />);

    await user.click(screen.getByRole("button", { name: "Feature idea (0, 0)" }));
    await user.click(screen.getByRole("button", { name: "Mock pane" }));

    expect(onSelectNode).toHaveBeenNthCalledWith(1, "node-1");
    expect(onSelectNode).toHaveBeenNthCalledWith(2, null);
  });

  it("adds a node in rename mode on canvas double-click", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<MapCanvas graph={graph} selectedNodeId={null} view="mind_map" onChange={onChange} onSelectNode={() => undefined} />);

    await user.dblClick(screen.getByLabelText("Visual planning canvas"));

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        nodes: [
          ...graph.nodes,
          expect.objectContaining({ title: "New idea", nodeType: "idea", status: "open" }),
        ],
      }),
    );
  });

  it("creates a connected child with Tab from the selected node", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onSelectNode = vi.fn();

    render(<MapCanvas graph={graph} selectedNodeId="node-1" view="mind_map" onChange={onChange} onSelectNode={onSelectNode} />);

    screen.getByLabelText("Visual planning canvas").focus();
    await user.keyboard("{Tab}");

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        edges: [expect.objectContaining({ sourceNodeId: "node-1" })],
      }),
    );
    expect(onSelectNode).toHaveBeenCalledWith("00000000-0000-4000-8000-000000000005");
  });

  it("ignores Tab when no node is selected", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<MapCanvas graph={graph} selectedNodeId={null} view="mind_map" onChange={onChange} onSelectNode={() => undefined} />);

    screen.getByLabelText("Visual planning canvas").focus();
    await user.keyboard("{Tab}");

    expect(onChange).not.toHaveBeenCalled();
  });

  it("persists node position changes from React Flow", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<MapCanvas graph={graph} selectedNodeId={null} view="mind_map" onChange={onChange} onSelectNode={() => undefined} />);

    await user.click(screen.getByRole("button", { name: "Mock move node" }));

    expect(onChange).toHaveBeenCalledWith({
      ...graph,
      nodes: [
        { ...graph.nodes[0], position: { x: 42, y: 84 } },
        graph.nodes[1],
      ],
    });
  });

  it("does not persist structured view node position changes", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<MapCanvas graph={graph} selectedNodeId={null} view="flowchart" onChange={onChange} onSelectNode={() => undefined} />);

    await user.click(screen.getByRole("button", { name: "Mock move node" }));

    expect(onChange).not.toHaveBeenCalled();
  });

  it("does not persist selection-only node changes", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<MapCanvas graph={graph} selectedNodeId={null} view="mind_map" onChange={onChange} onSelectNode={() => undefined} />);

    await user.click(screen.getByRole("button", { name: "Mock select node change" }));

    expect(onChange).not.toHaveBeenCalled();
  });

  it("persists remove node changes from React Flow", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<MapCanvas graph={graph} selectedNodeId={null} view="flowchart" onChange={onChange} onSelectNode={() => undefined} />);

    await user.click(screen.getByRole("button", { name: "Mock remove node" }));

    expect(onChange).toHaveBeenCalledWith({
      ...graph,
      nodes: [graph.nodes[1]],
      edges: [],
    });
  });

  it("renders mind map nodes at persisted graph positions", () => {
    const movedGraph: EditableMapGraph = {
      ...graph,
      nodes: [
        { ...graph.nodes[0], position: { x: 42, y: 84 } },
        graph.nodes[1],
      ],
    };

    render(<MapCanvas graph={movedGraph} selectedNodeId={null} view="mind_map" onChange={() => undefined} onSelectNode={() => undefined} />);

    expect(screen.getByRole("button", { name: "Feature idea (42, 84)" })).toBeInTheDocument();
  });

  it("creates association edges from React Flow connections", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<MapCanvas graph={graph} selectedNodeId={null} view="mind_map" onChange={onChange} onSelectNode={() => undefined} />);

    await user.click(screen.getByRole("button", { name: "Mock connect" }));

    expect(onChange).toHaveBeenCalledWith({
      ...graph,
      edges: [
        {
          id: "00000000-0000-4000-8000-000000000005",
          sourceNodeId: "node-1",
          targetNodeId: "node-2",
          edgeType: "association",
          label: "",
          isDirectional: false,
        },
      ],
    });
  });

  it("ignores self-connections", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<MapCanvas graph={graph} selectedNodeId={null} view="mind_map" onChange={onChange} onSelectNode={() => undefined} />);

    await user.click(screen.getByRole("button", { name: "Mock self connect" }));

    expect(onChange).not.toHaveBeenCalled();
  });
});
