# UI/UX Overhaul — Phase 4 (Constellation Mind Maps) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make mind maps look like constellations (glowing star nodes, starlight edges, themed canvas) and edit like real mind maps (double-click create, inline rename, Tab/Enter to grow, inspector as an on-demand drawer).

**Architecture:** A custom React Flow node type (`StarNode`) plus pure graph-op helpers keep the interaction logic unit-testable outside React Flow. `MapCanvas` wraps itself in `ReactFlowProvider` to use `screenToFlowPosition` for double-click placement. The existing wholesale `vi.mock("@xyflow/react")` in tests is extended, not replaced. The Inspector moves from a permanent third column to a `surface-raised` drawer opened by a Details button.

**Tech Stack:** React 19, @xyflow/react v12, TypeScript strict, Tailwind v4 + `src/styles.css`, vitest + testing-library.

**Spec:** `docs/superpowers/specs/2026-07-07-ui-ux-overhaul-design.md` (Section 3, "Mind maps → Constellations").

## Global Constraints

- Work in `C:\src\Personal\ToDo\.worktrees\project-command-center` on `codex/project-command-center`; run all commands there.
- `npm test` green after every task (`--maxWorkers=2` if the machine is loaded; worker-fork timeouts are environmental, re-run before treating as failures).
- No new dependencies. Keep test-asserted classes: `orbit-map-node`, `orbit-map-node-selected`, `orbit-map-node-converted`, `orbit-map-edge`, `orbit-map-edge-sequence`, `orbit-constellation-canvas`, `orbit-constellation-flow`.
- Save/convert/query logic untouched. Node title changes flow through the existing `onChange(graph)` path.
- Color rule: cyan = interactive/selected; violet = ambient/converted accents. No infinite decorative animation; the selected-node halo is the map's one Beacon.
- Commit after every task.

---

### Task 1: Pure graph ops — accents + connected-node creation

**Files:**
- Create: `src/features/maps/map-graph-ops.ts`
- Create: `src/features/maps/map-graph-ops.test.ts`

**Interfaces:**
- Consumes: `EditableMapGraph`, `EditableMapNode`, `MindMapNodeType` from `./map-types`.
- Produces:
  - `nodeAccentColor(nodeType: MindMapNodeType): "cyan" | "blue" | "violet"`
  - `createNodeAt(graph, position: {x,y}, id: string): EditableMapGraph` — appends a blank "New idea" node at position.
  - `createConnectedNode(graph, sourceNodeId: string, nodeId: string, edgeId: string): EditableMapGraph` — child offset (+180, +40) from source, association edge source→child.
  - `createSiblingNode(graph, selectedNodeId: string, nodeId: string, edgeId: string): EditableMapGraph` — connects from the selected node's parent (first edge whose target is selected); if no parent, behaves like `createConnectedNode`.

- [ ] **Step 1: Write the failing tests**

Create `src/features/maps/map-graph-ops.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createConnectedNode, createNodeAt, createSiblingNode, nodeAccentColor } from "./map-graph-ops";
import type { EditableMapGraph } from "./map-types";

function graph(): EditableMapGraph {
  return {
    title: "Ideas",
    description: "",
    defaultView: "mind_map",
    nodes: [
      { id: "root", title: "Root", body: "", nodeType: "idea", status: "open", position: { x: 0, y: 0 }, accent: "cyan", tags: [] },
      { id: "child-a", title: "Child A", body: "", nodeType: "idea", status: "open", position: { x: 180, y: 40 }, accent: "cyan", tags: [] },
    ],
    edges: [
      { id: "e-root-a", sourceNodeId: "root", targetNodeId: "child-a", edgeType: "association", label: "", isDirectional: false },
    ],
  };
}

describe("nodeAccentColor", () => {
  it("maps node types onto the three accents", () => {
    expect(nodeAccentColor("idea")).toBe("cyan");
    expect(nodeAccentColor("task_candidate")).toBe("cyan");
    expect(nodeAccentColor("note")).toBe("blue");
    expect(nodeAccentColor("reference")).toBe("blue");
    expect(nodeAccentColor("option")).toBe("blue");
    expect(nodeAccentColor("milestone")).toBe("violet");
    expect(nodeAccentColor("decision")).toBe("violet");
    expect(nodeAccentColor("risk")).toBe("violet");
  });
});

describe("createNodeAt", () => {
  it("appends a blank idea node at the position", () => {
    const next = createNodeAt(graph(), { x: 300, y: 200 }, "new-id");
    const added = next.nodes.at(-1);

    expect(next.nodes).toHaveLength(3);
    expect(added).toMatchObject({
      id: "new-id",
      title: "New idea",
      nodeType: "idea",
      status: "open",
      position: { x: 300, y: 200 },
    });
    expect(next.edges).toHaveLength(1);
  });
});

describe("createConnectedNode", () => {
  it("adds a child offset from the source with an association edge", () => {
    const next = createConnectedNode(graph(), "child-a", "new-id", "new-edge");

    expect(next.nodes.at(-1)).toMatchObject({ id: "new-id", position: { x: 360, y: 80 } });
    expect(next.edges.at(-1)).toEqual({
      id: "new-edge",
      sourceNodeId: "child-a",
      targetNodeId: "new-id",
      edgeType: "association",
      label: "",
      isDirectional: false,
    });
  });

  it("returns the graph unchanged when the source is missing", () => {
    const start = graph();
    expect(createConnectedNode(start, "ghost", "new-id", "new-edge")).toBe(start);
  });
});

describe("createSiblingNode", () => {
  it("connects the new node from the selected node's parent", () => {
    const next = createSiblingNode(graph(), "child-a", "new-id", "new-edge");

    expect(next.edges.at(-1)).toMatchObject({ sourceNodeId: "root", targetNodeId: "new-id" });
    expect(next.nodes.at(-1)).toMatchObject({ position: { x: 180, y: 160 } });
  });

  it("falls back to a child when the selected node has no parent", () => {
    const next = createSiblingNode(graph(), "root", "new-id", "new-edge");

    expect(next.edges.at(-1)).toMatchObject({ sourceNodeId: "root", targetNodeId: "new-id" });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/features/maps/map-graph-ops.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `src/features/maps/map-graph-ops.ts`:

```ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/features/maps/map-graph-ops.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/maps/map-graph-ops.ts src/features/maps/map-graph-ops.test.ts
git commit -m "Add pure graph ops for constellation node creation"
```

---

### Task 2: StarNode — glowing node with inline rename

**Files:**
- Create: `src/features/maps/map-star-node.tsx`
- Create: `src/features/maps/map-star-node.test.tsx`

**Interfaces:**
- Consumes: `Handle`, `Position` from `@xyflow/react` (test file mocks them).
- Produces:

```ts
export type StarNodeData = {
  label: string;
  accent: "cyan" | "blue" | "violet";
  isConverted: boolean;
  isRenaming: boolean;
  onRenameCommit: (title: string) => void;
  onRenameCancel: () => void;
};
export function StarNode({ data, selected }: { data: StarNodeData; selected?: boolean }): JSX.Element;
```

- [ ] **Step 1: Write the failing tests**

Create `src/features/maps/map-star-node.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { StarNode, type StarNodeData } from "./map-star-node";

vi.mock("@xyflow/react", () => ({
  Handle: ({ type }: { type: string }) => <span data-testid={`handle-${type}`} />,
  Position: { Left: "left", Right: "right" },
}));

function data(overrides: Partial<StarNodeData> = {}): StarNodeData {
  return {
    label: "Feature idea",
    accent: "cyan",
    isConverted: false,
    isRenaming: false,
    onRenameCommit: () => undefined,
    onRenameCancel: () => undefined,
    ...overrides,
  };
}

describe("StarNode", () => {
  it("renders the star, title, and connection handles", () => {
    render(<StarNode data={data()} />);

    expect(screen.getByText("Feature idea")).toBeTruthy();
    expect(screen.getByTestId("star-dot")).toHaveClass("star-dot-cyan");
    expect(screen.getByTestId("handle-target")).toBeTruthy();
    expect(screen.getByTestId("handle-source")).toBeTruthy();
  });

  it("shows a halo when selected and a planet badge when converted", () => {
    render(<StarNode data={data({ isConverted: true, accent: "violet" })} selected />);

    expect(screen.getByTestId("star-node-root")).toHaveClass("star-node-selected");
    expect(screen.getByTestId("star-converted-badge")).toBeTruthy();
    expect(screen.getByTestId("star-dot")).toHaveClass("star-dot-violet");
  });

  it("renames inline with Enter and cancels with Escape", async () => {
    const user = userEvent.setup();
    const onRenameCommit = vi.fn();
    const onRenameCancel = vi.fn();

    render(<StarNode data={data({ isRenaming: true, onRenameCommit, onRenameCancel })} />);

    const input = screen.getByRole("textbox", { name: "Node title" });
    expect(input).toHaveValue("Feature idea");

    await user.clear(input);
    await user.type(input, "Better idea{Enter}");
    expect(onRenameCommit).toHaveBeenCalledWith("Better idea");

    await user.keyboard("{Escape}");
    expect(onRenameCancel).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/features/maps/map-star-node.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `src/features/maps/map-star-node.tsx`:

```tsx
import { Handle, Position } from "@xyflow/react";
import { clsx } from "clsx";
import { memo, useEffect, useRef, useState } from "react";

export type StarNodeData = {
  label: string;
  accent: "cyan" | "blue" | "violet";
  isConverted: boolean;
  isRenaming: boolean;
  onRenameCommit: (title: string) => void;
  onRenameCancel: () => void;
};

export const StarNode = memo(function StarNode({
  data,
  selected = false,
}: {
  data: StarNodeData;
  selected?: boolean;
}) {
  const [draft, setDraft] = useState(data.label);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (data.isRenaming) {
      setDraft(data.label);
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [data.isRenaming, data.label]);

  return (
    <div
      className={clsx("star-node flex items-center gap-2.5 rounded-lg px-3 py-2", selected && "star-node-selected")}
      data-testid="star-node-root"
    >
      <Handle position={Position.Left} type="target" />
      <span aria-hidden="true" className={clsx("star-dot", `star-dot-${data.accent}`)} data-testid="star-dot" />
      {data.isRenaming ? (
        <input
          aria-label="Node title"
          className="w-36 border-b border-cyan-300/50 bg-transparent text-sm font-semibold text-white outline-none"
          onBlur={() => data.onRenameCommit(draft.trim() || data.label)}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              event.stopPropagation();
              data.onRenameCommit(draft.trim() || data.label);
            }
            if (event.key === "Escape") {
              event.stopPropagation();
              data.onRenameCancel();
            }
          }}
          ref={inputRef}
          value={draft}
        />
      ) : (
        <span className="max-w-44 truncate text-sm font-semibold text-white">{data.label}</span>
      )}
      {data.isConverted ? (
        <span aria-hidden="true" className="star-planet-badge" data-testid="star-converted-badge" />
      ) : null}
      <Handle position={Position.Right} type="source" />
    </div>
  );
});
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/features/maps/map-star-node.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/maps/map-star-node.tsx src/features/maps/map-star-node.test.tsx
git commit -m "Add star node with inline rename"
```

---

### Task 3: Constellation CSS — star dots, halos, starlight edges, themed chrome

**Files:**
- Modify: `src/styles.css` (near the existing `.orbit-map-*` rules)

**Interfaces:**
- Produces classes consumed by Tasks 2/4: `star-node`, `star-node-selected`, `star-dot`, `star-dot-cyan`, `star-dot-blue`, `star-dot-violet`, `star-planet-badge`, plus React Flow chrome overrides scoped under `.orbit-constellation-canvas`.

- [ ] **Step 1: Add the CSS**

In `src/styles.css`, directly after the `.orbit-map-edge-sequence .react-flow__edge-path { ... }` rule, add:

```css
.star-node {
  border: 1px solid rgba(148, 163, 184, 0.18);
  background: rgba(8, 15, 34, 0.88);
  box-shadow: 0 10px 26px rgba(2, 8, 23, 0.35);
}

.star-node-selected {
  border-color: rgba(34, 211, 238, 0.5);
  box-shadow:
    0 0 0 1px rgba(34, 211, 238, 0.24),
    0 0 30px rgba(34, 211, 238, 0.18);
}

.star-dot {
  height: 0.55rem;
  width: 0.55rem;
  flex-shrink: 0;
  border-radius: 999px;
}

.star-dot-cyan {
  background: #67e8f9;
  box-shadow: 0 0 10px rgba(103, 232, 249, 0.85);
}

.star-dot-blue {
  background: #60a5fa;
  box-shadow: 0 0 10px rgba(96, 165, 250, 0.85);
}

.star-dot-violet {
  background: #a78bfa;
  box-shadow: 0 0 10px rgba(167, 139, 250, 0.85);
}

.star-planet-badge {
  position: relative;
  height: 0.7rem;
  width: 0.7rem;
  flex-shrink: 0;
  border-radius: 999px;
  background: radial-gradient(circle at 35% 30%, #c4b5fd, #7c3aed 70%);
}

.star-planet-badge::after {
  content: "";
  position: absolute;
  left: 50%;
  top: 50%;
  height: 0.32rem;
  width: 1.05rem;
  border: 1px solid rgba(196, 181, 253, 0.7);
  border-radius: 999px;
  transform: translate(-50%, -50%) rotate(-24deg);
}

.orbit-constellation-canvas .react-flow__node {
  background: transparent;
  border: none;
  padding: 0;
}

.orbit-constellation-canvas .react-flow__handle {
  height: 6px;
  width: 6px;
  border: none;
  background: rgba(103, 232, 249, 0.6);
}

.orbit-constellation-flow .react-flow__edge-path {
  stroke: rgba(103, 232, 249, 0.45);
  stroke-width: 1.25;
  filter: drop-shadow(0 0 3px rgba(103, 232, 249, 0.35));
}

.orbit-constellation-canvas .react-flow__minimap {
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 0.5rem;
  background: rgba(2, 8, 23, 0.85);
}

.orbit-constellation-canvas .react-flow__controls {
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 0.5rem;
  overflow: hidden;
  box-shadow: none;
}

.orbit-constellation-canvas .react-flow__controls-button {
  border-bottom: 1px solid rgba(148, 163, 184, 0.14);
  background: rgba(8, 15, 34, 0.92);
  color: #cbd5e1;
  fill: #cbd5e1;
}

.orbit-constellation-canvas .react-flow__controls-button:hover {
  background: rgba(30, 41, 59, 0.9);
}
```

Then find the existing rule:

```css
.orbit-constellation-flow .react-flow__edge-path {
  stroke: rgba(103, 232, 249, 0.58);
}
```

and DELETE it (superseded by the richer rule above). Also slow the sequence dash: inside the `@media (prefers-reduced-motion: no-preference)` block add:

```css
  .orbit-map-edge-sequence .react-flow__edge-path {
    animation-duration: 1600ms;
  }
```

- [ ] **Step 2: Verify**

Run: `npm run build`
Expected: exit 0.

Run: `npx vitest run src/features/maps`
Expected: PASS (CSS-only change).

- [ ] **Step 3: Commit**

```bash
git add src/styles.css
git commit -m "Add constellation styling for map nodes, edges, and chrome"
```

---

### Task 4: MapCanvas integration — star nodes, double-click create, Tab/Enter growth

**Files:**
- Modify: `src/features/maps/map-canvas.tsx`
- Modify: `src/features/maps/map-canvas.test.tsx`

**Interfaces:**
- Consumes: `StarNode`/`StarNodeData` (Task 2), `createNodeAt`/`createConnectedNode`/`createSiblingNode`/`nodeAccentColor` (Task 1), `ReactFlowProvider` + `useReactFlow` from `@xyflow/react`.
- Produces: same `MapCanvas` props. New behaviors: double-click empty canvas creates a node in rename mode; double-click node renames; Tab creates a connected child of the selection; Enter creates a sibling; "Add canvas node" button removed (toolbar "Add node" remains).

- [ ] **Step 1: Extend the @xyflow/react mock and update tests**

In `src/features/maps/map-canvas.test.tsx`:

**(a)** Add to the `vi.mock("@xyflow/react", ...)` factory object:

```tsx
  BackgroundVariant: { Dots: "dots" },
  Handle: ({ type }: { type: string }) => <span data-testid={`handle-${type}`} />,
  Position: { Left: "left", Right: "right" },
  ReactFlowProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useReactFlow: () => ({ screenToFlowPosition: (position: { x: number; y: number }) => position }),
```

**(b)** In the mock `ReactFlow` render, the node buttons currently print `node.data.label` — nodes now use custom data; keep `data.label` (unchanged field name), so no edit needed there.

**(c)** Replace the test `"adds a new idea node from the canvas control"` with:

```tsx
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
```

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `npx vitest run src/features/maps/map-canvas.test.tsx`
Expected: FAIL on the three new tests ("Add canvas node" gone from expectations; dblclick/Tab not implemented).

- [ ] **Step 3: Rewrite MapCanvas internals**

In `src/features/maps/map-canvas.tsx`:

**(a)** Update imports:

```tsx
import {
  addEdge,
  applyEdgeChanges,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
} from "@xyflow/react";
```

and add:

```tsx
import { createConnectedNode, createNodeAt, createSiblingNode, nodeAccentColor } from "./map-graph-ops";
import { StarNode, type StarNodeData } from "./map-star-node";
```

**(b)** Replace `toFlowNode` with a version that emits the custom type (keep the class names — tests assert them):

```tsx
const nodeTypes = { star: StarNode };

function toFlowNode(
  node: EditableMapNode,
  selectedNodeId: string | null,
  renamingNodeId: string | null,
  onRenameCommit: (nodeId: string, title: string) => void,
  onRenameCancel: () => void,
): Node<StarNodeData> {
  return {
    id: node.id,
    type: "star",
    position: node.position,
    data: {
      label: node.title,
      accent: nodeAccentColor(node.nodeType),
      isConverted: node.status === "converted",
      isRenaming: node.id === renamingNodeId,
      onRenameCommit: (title: string) => onRenameCommit(node.id, title),
      onRenameCancel,
    },
    selected: node.id === selectedNodeId,
    className: clsx(
      "orbit-map-node",
      node.id === selectedNodeId && "orbit-map-node-selected",
      node.status === "converted" && "orbit-map-node-converted",
    ),
  };
}
```

(The inline `style` object is deleted — StarNode owns its look.)

**(c)** Rename the exported component: the current `MapCanvas` body becomes `MapCanvasInner` (same props), and the export wraps it:

```tsx
export const MapCanvas = memo(function MapCanvas(props: MapCanvasProps) {
  return (
    <ReactFlowProvider>
      <MapCanvasInner {...props} />
    </ReactFlowProvider>
  );
});
```

**(d)** Inside `MapCanvasInner`, add state and handlers (delete the old `addNode` callback and the "Add canvas node" button):

```tsx
  const [renamingNodeId, setRenamingNodeId] = useState<string | null>(null);
  const { screenToFlowPosition } = useReactFlow();

  const handleRenameCommit = useCallback((nodeId: string, title: string) => {
    setRenamingNodeId(null);
    onChange({
      ...graph,
      nodes: graph.nodes.map((node) => (node.id === nodeId ? { ...node, title } : node)),
    });
  }, [graph, onChange]);

  const handleRenameCancel = useCallback(() => setRenamingNodeId(null), []);

  const handleCanvasDoubleClick = useCallback((event: ReactMouseEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest(".react-flow__node")) return;

    const id = crypto.randomUUID();
    const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
    onChange(createNodeAt(graph, position, id));
    onSelectNode(id);
    setRenamingNodeId(id);
  }, [graph, onChange, onSelectNode, screenToFlowPosition]);

  const handleNodeDoubleClick = useCallback((_: unknown, node: Node) => {
    setRenamingNodeId(node.id);
  }, []);

  const handleCanvasKeyDown = useCallback((event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (!selectedNodeId) return;
    const target = event.target as HTMLElement;
    if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;
    if (event.key !== "Tab" && event.key !== "Enter") return;

    event.preventDefault();
    const nodeId = crypto.randomUUID();
    const edgeId = crypto.randomUUID();
    const nextGraph =
      event.key === "Tab"
        ? createConnectedNode(graph, selectedNodeId, nodeId, edgeId)
        : createSiblingNode(graph, selectedNodeId, nodeId, edgeId);

    if (nextGraph === graph) return;
    onChange(nextGraph);
    onSelectNode(nodeId);
    setRenamingNodeId(nodeId);
  }, [graph, onChange, onSelectNode, selectedNodeId]);
```

Import the React types: `import { memo, useCallback, useMemo, useState, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent } from "react";`

**(e)** Update the `nodes` memo to thread the new args:

```tsx
  const nodes = useMemo(
    () => canvasNodes.map((node) => toFlowNode(node, selectedNodeId, renamingNodeId, handleRenameCommit, handleRenameCancel)),
    [canvasNodes, selectedNodeId, renamingNodeId, handleRenameCommit, handleRenameCancel],
  );
```

**(f)** Replace the returned JSX shell (button row removed, handlers attached, chrome themed):

```tsx
  return (
    <section className="grid min-h-[520px] gap-3">
      <div
        aria-label="Visual planning canvas"
        className="orbit-constellation-canvas min-h-[480px] overflow-hidden rounded-lg border border-white/10 bg-slate-950/60"
        onDoubleClick={handleCanvasDoubleClick}
        onKeyDown={handleCanvasKeyDown}
        role="application"
        tabIndex={0}
      >
        <ReactFlow
          className="orbit-constellation-flow"
          edges={edges}
          fitView
          nodes={nodes}
          nodeTypes={nodeTypes}
          onConnect={handleConnect}
          onEdgesChange={handleEdgesChange}
          onNodeClick={handleNodeClick}
          onNodeDoubleClick={handleNodeDoubleClick}
          onNodesChange={handleNodesChange}
          onPaneClick={handlePaneClick}
          zoomOnDoubleClick={false}
        >
          <Background color="rgba(148, 163, 184, 0.35)" gap={30} size={1} variant={BackgroundVariant.Dots} />
          <MiniMap maskColor="rgba(2, 8, 23, 0.72)" nodeColor="#22d3ee" pannable />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
    </section>
  );
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/features/maps/map-canvas.test.tsx src/features/maps/maps-page.test.tsx`
Expected: PASS. If `maps-page.test.tsx` interacted with "Add canvas node", switch that interaction to the toolbar's "Add node" button.

- [ ] **Step 5: Commit**

```bash
git add src/features/maps/map-canvas.tsx src/features/maps/map-canvas.test.tsx
git commit -m "Wire star nodes with double-click create and keyboard growth"
```

---

### Task 5: Inspector as on-demand drawer

**Files:**
- Modify: `src/features/maps/maps-page.tsx:394-478`
- Modify: `src/features/maps/map-toolbar.tsx`
- Test: `src/features/maps/maps-page.test.tsx` (new interaction test)

**Interfaces:**
- Consumes: existing `MapInspector` (unchanged), `MapToolbar` gains `onOpenDetails?: () => void` and `hasSelection: boolean` props.
- Produces: inspector renders inside a right-side fixed drawer (`surface-raised`) only when opened via the toolbar "Details" button; closes via a "Close details" button.

- [ ] **Step 1: Write the failing test**

Append to `src/features/maps/maps-page.test.tsx` (reusing its existing render helper and mocks — adapt the graph/map fixtures already defined in that file; the essential interaction is):

```tsx
  it("opens the inspector drawer on demand", async () => {
    const user = userEvent.setup();
    renderMapsPage();

    // open an existing map and select a node using the file's established fixtures
    await user.click(await screen.findByRole("button", { name: /Idea backlog/ }));
    await user.click(await screen.findByRole("button", { name: /Feature idea/ }));

    expect(screen.queryByRole("heading", { name: "Inspector" })).toBeNull();

    await user.click(screen.getByRole("button", { name: "Details" }));
    expect(screen.getByRole("heading", { name: "Inspector" })).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Close details" }));
    expect(screen.queryByRole("heading", { name: "Inspector" })).toBeNull();
  });
```

(Adjust the two "open map / select node" clicks to the fixture names actually present in the file; the drawer assertions are the contract.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/maps/maps-page.test.tsx`
Expected: FAIL — no "Details" button.

- [ ] **Step 3: Implement**

**(a)** `src/features/maps/map-toolbar.tsx` — add the two props and a Details button before the save button:

```tsx
type MapToolbarProps = {
  activeView: MindMapView;
  hasSelection: boolean;
  isDirty: boolean;
  isSaving: boolean;
  onAddNode: () => void;
  onOpenDetails: () => void;
  onSave: () => void;
  onViewChange: (view: MindMapView) => void;
};
```

```tsx
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-slate-100 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!hasSelection}
          onClick={onOpenDetails}
        >
          <PanelRight className="h-4 w-4" aria-hidden="true" />
          Details
        </button>
```

Import `PanelRight` from `lucide-react`; destructure the new props in the function signature.

**(b)** `src/features/maps/maps-page.tsx`:

- Add state: `const [isInspectorOpen, setIsInspectorOpen] = useState(false);`
- Close it on map switch: add `setIsInspectorOpen(false);` inside the existing `useEffect` that resets on `mapScope` change AND inside `handleSelectMap`.
- Pass to the toolbar: `hasSelection={Boolean(selectedNode)}` and `onOpenDetails={() => setIsInspectorOpen(true)}`.
- Change the outer grid from `lg:grid-cols-[280px_minmax(0,1fr)_300px]` to `lg:grid-cols-[280px_minmax(0,1fr)]`.
- Replace the third-column block:

```tsx
        <div className="grid gap-3">
          <MapInspector ... />
          {convertNodeMutation.isError ? ( ... ) : null}
        </div>
```

with a drawer rendered at the end of the page section:

```tsx
        {isInspectorOpen && selectedNode ? (
          <div className="surface-raised fixed inset-y-0 right-0 z-40 w-full max-w-sm overflow-y-auto p-4 shadow-2xl">
            <div className="flex justify-end pb-2">
              <button
                className="orbit-button-secondary px-2 py-1 text-xs"
                onClick={() => setIsInspectorOpen(false)}
                type="button"
              >
                Close details
              </button>
            </div>
            <MapInspector
              node={selectedNode}
              conversionDisabledReason={conversionDisabledReason}
              conversionDisabledReasons={conversionDisabledReasons}
              isConverting={isConvertingNode}
              onConvert={handleConvert}
              onNodeChange={handleNodeChange}
            />
            {convertNodeMutation.isError ? (
              <p className="mt-3 rounded-md border border-rose-400/30 bg-rose-400/10 px-3 py-2 text-sm text-rose-100">
                {convertNodeMutation.error.message}
              </p>
            ) : null}
          </div>
        ) : null}
```

- Also auto-close when selection clears: add `useEffect(() => { if (!selectedNode) setIsInspectorOpen(false); }, [selectedNode]);`
- Restyle `MapInspector`'s `<aside>` wrappers from `rounded-lg border border-white/10 bg-slate-950/60 p-4` to `rounded-lg p-4` (both occurrences — the drawer provides the surface). The "select a node" empty variant is unreachable inside the drawer but keep it for safety.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/features/maps`
Expected: PASS across all map test files.

- [ ] **Step 5: Commit**

```bash
git add src/features/maps/maps-page.tsx src/features/maps/map-toolbar.tsx src/features/maps/map-inspector.tsx src/features/maps/maps-page.test.tsx
git commit -m "Move map inspector into an on-demand drawer"
```

---

### Task 6: Verification pass

- [ ] **Step 1:** `npm test` (use `--maxWorkers=2` if loaded) — all green.
- [ ] **Step 2:** `npm run build` — exit 0.
- [ ] **Step 3:** Fake-session Playwright screenshot of `/maps` (desktop 1280×800): confirm themed canvas chrome and, if a map fixture can't load without network, at least the page shell + library panel on the new surfaces. Real node visuals are covered by unit tests.
- [ ] **Step 4:** Commit any polish as `Polish constellation maps after visual verification`.

## Self-Review (completed)

- **Spec coverage:** star nodes w/ accent by type ✔ (T1–T4), halo on select ✔ (T2/T3), planet badge on converted ✔ (T2/T3), starlight edges + slowed sequence dash ✔ (T3), themed Background/MiniMap/Controls ✔ (T3/T4), double-click create w/ inline rename ✔ (T4), double-click rename ✔ (T4), Tab/Enter connected nodes ✔ (T1/T4), inspector as explicit-action drawer ✔ (T5).
- **Type consistency:** `StarNodeData` matches between T2 and T4; graph-op signatures match T1↔T4; toolbar props match T5 usage.
- **Placeholders:** Task 5 Step 1 asks the implementer to adapt two fixture-dependent clicks to names in the existing test file — the contract assertions are fully specified.
