# Maps Flow Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single-page Maps screen with a library grid and a full-width autosaving editor, so opening, editing, arranging, detailing and converting map nodes flows without a Save button, a pinned template column, or an overlay inspector.

**Architecture:** `src/features/maps/` is split into a library page (grid of `MapCard`s plus a `NewMapDialog`), an editor page (header, `MapCanvas`, docked `MapInspector`, `MapToolbar`), and a `useMapEditor` hook that owns graph state, undo/redo and debounced autosave through the existing `replace_mind_map_graph` RPC. Pure graph helpers (`map-graph-ops.ts`, `map-layouts.ts`) carry node placement and the Arrange layouts. Routing adds `maps/:mapId`; inside a project the same components are driven by a `?map=` search param.

**Tech Stack:** React 19, TypeScript, React Router 7, TanStack Query 5, `@xyflow/react` 12, Tailwind + `src/styles.css`, Vitest 4 + Testing Library, Supabase JS (mocked in tests).

**Spec:** `docs/superpowers/specs/2026-09-01-maps-flow-redesign-design.md`

## Global Constraints

- Work in the worktree `.worktrees/project-command-center` on branch `maps-flow-redesign`; run every command from there (`C:\src\Personal\ToDo\.worktrees\project-command-center`).
- No migrations, no new tables. `default_view` is always sent as `"mind_map"`.
- Autosave debounce **800ms**; retry delays **2s, 6s, 18s**; undo cap **50**; typing coalesce window **500ms**.
- Layout constants: layered depth gap **260px**, sibling gap **90px** (left-to-right); top-down uses sibling gap **240px** and depth gap **150px** so 200px-wide labels never overlap (this corrects the spec's single "260/90" line); radial ring gap **220px**; by-date row spacing **260px** with the undated row **180px** below; new-node overlap box **200×40**.
- Copy: hint strip reads `Double-click to add · Tab child · Enter sibling · Drag a handle to connect`; empty canvas reads `Double-click anywhere to place your first idea`; save states read `Saved`, `Saving…`, `Couldn't save`.
- `localStorage` key for hint dismissal: `orbit-flo:maps-hints-dismissed`.
- Design language: cards on `surface-primary`, dialog/drawer on `surface-raised`, editor header on `surface-whisper`; cyan only for the active element; no new motion.
- Tests: colocated `*.test.ts(x)`, Vitest + Testing Library, Supabase mocked via `vi.mock("../../lib/supabase/client", () => ({ supabase: {} }))`. Run with `npm test -- <paths>`.
- `npm run build` runs `tsc -b`, and `tsconfig.json` includes test files, so tests must type-check. Where a test reads `.mock` on a handler built from `vi.fn()` and spread with overrides, keep the handler typed as a mock (build the props object without a type annotation, cast to the component props when rendering, or use `vi.mocked(fn)`). Small typing fixes to the test code shown here are expected; do not weaken assertions to satisfy the compiler.
- The Undo/Redo toolbar buttons are a small addition beyond the spec's toolbar list (the spec only lists the keyboard shortcuts); they make undo discoverable and cost nothing.
- Between Task 7 and Task 12 the file `src/dev/orbit-flo-visual-review.tsx` will not type-check (it uses the old toolbar/panel). Vitest does not type-check, so the maps suite stays green; `npm run build` is required to pass at the end of Task 12.
- Commit after every task with the trailer `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.

---

## File map

| File | Responsibility |
|---|---|
| `src/features/maps/maps.queries.ts` | Supabase access: list, previews, create, update (partial), archive, duplicate, graph load/replace, convert |
| `src/features/maps/map-graph-ops.ts` | Pure graph edits: node/edge create, update, delete, fresh ids |
| `src/features/maps/map-layouts.ts` | Pure layouts: Arrange modes, `placeNewNode` |
| `src/features/maps/map-types.ts` | Editable graph types, enum lists, label helpers |
| `src/features/maps/use-map-editor.ts` | Graph state, selection, undo/redo, debounced autosave, flush |
| `src/features/maps/map-template-thumbnail.tsx` | SVG thumbnail, `sm`/`md` sizes |
| `src/features/maps/map-card.tsx` | Library card: thumbnail, meta, menu, inline rename |
| `src/features/maps/new-map-dialog.tsx` | Blank/template picker with title |
| `src/features/maps/map-library-page.tsx` | Library grid, create/rename/duplicate/archive mutations |
| `src/features/maps/map-canvas.tsx` | React Flow canvas: nodes, edges, selection, keyboard, imperative handle |
| `src/features/maps/map-toolbar.tsx` | Add node, Arrange menu, Fit, Undo/Redo, Details, save status |
| `src/features/maps/map-inspector.tsx` | Node / edge / map editing and conversion |
| `src/features/maps/map-editor-page.tsx` | Editor composition, convert flow, hints, keyboard shortcuts |
| `src/features/maps/maps-routes.tsx` | Route wrappers for `/maps` and `/maps/:mapId` |
| `src/features/maps/project-maps-tab.tsx` | `?map=` wrapper used by the project workspace |
| `src/app/routes.tsx`, `src/app/route-loaders.ts` | Route registration and lazy loaders |
| `src/features/projects/project-workspace-page.tsx` | Maps tab → `ProjectMapsTab`; `?map=` opens the tab |
| `src/dev/orbit-flo-visual-fixtures.ts`, `src/dev/orbit-flo-visual-review.tsx` | Capture fixtures for the two maps screens |
| `src/styles.css` | Card, menu, hint strip, inspector dock, edge selection styles |

Deleted: `maps-page.tsx`, `maps-page.test.tsx`, `map-library-panel.tsx`, `map-library-panel.test.tsx`.

---

### Task 1: Query module — previews, partial update, archive, duplicate

**Files:**
- Modify: `src/features/maps/maps.queries.ts`
- Modify: `src/features/maps/map-graph-ops.ts` (add `withFreshIds`)
- Test: `src/features/maps/maps.queries.test.ts`, `src/features/maps/map-graph-ops.test.ts`

**Interfaces:**
- Produces:
  - `type MindMapPreview = { nodes: Array<{ id: string; position: { x: number; y: number }; nodeType: MindMapNodeType }>; edges: Array<{ id: string; sourceNodeId: string; targetNodeId: string }> }`
  - `mindMapKeys.previews(workspaceId: string, projectId?: string | null)`
  - `listMindMapPreviews(client, { workspaceId, mapIds: string[] }): Promise<Record<string, MindMapPreview>>`
  - `updateMindMap(client, { id, workspaceId, title?, description?, defaultView?, archivedAt? })`
  - `archiveMindMap(client, { id, workspaceId })`
  - `duplicateMindMap(client, { workspaceId, projectId, userId, sourceMapId, title }): Promise<MindMap>`
  - `withFreshIds(graph: EditableMapGraph): EditableMapGraph` in `map-graph-ops.ts`

- [ ] **Step 1: Write the failing graph-ops test for `withFreshIds`**

Append to `src/features/maps/map-graph-ops.test.ts`:

```ts
import { withFreshIds } from "./map-graph-ops";

describe("withFreshIds", () => {
  it("gives every node and edge a new id and rewires edges", () => {
    const graph: EditableMapGraph = {
      title: "Plan",
      description: "",
      defaultView: "mind_map",
      nodes: [
        { id: "a", title: "A", body: "", nodeType: "idea", status: "open", position: { x: 0, y: 0 }, accent: "cyan", tags: [] },
        { id: "b", title: "B", body: "", nodeType: "idea", status: "open", position: { x: 1, y: 1 }, accent: "cyan", tags: [] },
      ],
      edges: [{ id: "a-b", sourceNodeId: "a", targetNodeId: "b", edgeType: "association", label: "", isDirectional: false }],
    };

    const fresh = withFreshIds(graph);

    expect(fresh.nodes.map((node) => node.id)).not.toContain("a");
    expect(fresh.edges[0].id).not.toBe("a-b");
    expect(fresh.edges[0].sourceNodeId).toBe(fresh.nodes[0].id);
    expect(fresh.edges[0].targetNodeId).toBe(fresh.nodes[1].id);
    expect(graph.nodes[0].id).toBe("a");
  });
});
```

(If the file does not already import `describe`/`it`/`expect` from `vitest` and `EditableMapGraph` from `./map-types`, add those imports at the top.)

- [ ] **Step 2: Run it to see it fail**

Run: `npm test -- src/features/maps/map-graph-ops.test.ts`
Expected: FAIL — `withFreshIds` is not exported.

- [ ] **Step 3: Add `withFreshIds` to `map-graph-ops.ts`**

Append to `src/features/maps/map-graph-ops.ts`:

```ts
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
```

- [ ] **Step 4: Write the failing query tests**

In `src/features/maps/maps.queries.test.ts`, extend `queryBuilder` so it also supports `in` and `update`, and add a `nodeRow` helper plus three tests:

```ts
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
```

Add these tests inside the existing `describe("maps queries", ...)`:

```ts
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
```

- [ ] **Step 5: Run the query tests to see them fail**

Run: `npm test -- src/features/maps/maps.queries.test.ts`
Expected: FAIL — `archiveMindMap`, `duplicateMindMap`, `listMindMapPreviews` are not exported.

- [ ] **Step 6: Implement the query additions**

In `src/features/maps/maps.queries.ts`:

1. Extend the type import and add the preview type + key:

```ts
import type { Database, Json, MindMapNodeType, MindMapView } from "../../lib/supabase/database.types";
import { withFreshIds } from "./map-graph-ops";

export type MindMap = Database["public"]["Tables"]["mind_maps"]["Row"];

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
```

(Remove the old local `type MindMap = ...` line since it is now exported. `MindMapNodeType` must exist in `database.types.ts`; it is already imported by `map-types.ts`.)

2. Add after `listMindMaps`:

```ts
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
```

3. Replace `updateMindMap` and add `archiveMindMap` + `duplicateMindMap`:

```ts
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
  await replaceMindMapGraph(client, { workspaceId: input.workspaceId, mapId: map.id, graph });
  return map;
}
```

- [ ] **Step 7: Run both test files**

Run: `npm test -- src/features/maps/maps.queries.test.ts src/features/maps/map-graph-ops.test.ts`
Expected: PASS (all existing tests plus the new ones).

- [ ] **Step 8: Commit**

```bash
git add src/features/maps/maps.queries.ts src/features/maps/maps.queries.test.ts src/features/maps/map-graph-ops.ts src/features/maps/map-graph-ops.test.ts
git commit -m "feat(maps): previews, partial update, archive and duplicate queries"
```

---

### Task 2: Graph ops for edit/delete, Arrange layouts, and `placeNewNode`

**Files:**
- Modify: `src/features/maps/map-graph-ops.ts`
- Rewrite: `src/features/maps/map-layouts.ts` (keep `applyViewLayout` exported and untouched until Task 5 deletes it)
- Modify: `src/features/maps/map-types.ts` (label helpers)
- Test: `src/features/maps/map-graph-ops.test.ts`, `src/features/maps/map-layouts.test.ts` (rewrite), `src/features/maps/map-types.test.ts` (new)

**Interfaces:**
- Produces in `map-graph-ops.ts`:
  - `updateNode(graph, nodeId, patch: Partial<Omit<EditableMapNode, "id">>): EditableMapGraph`
  - `deleteNode(graph, nodeId): EditableMapGraph` (removes edges touching the node)
  - `updateEdge(graph, edgeId, patch: Partial<Omit<EditableMapEdge, "id">>): EditableMapGraph`
  - `deleteEdge(graph, edgeId): EditableMapGraph`
- Produces in `map-layouts.ts`:
  - `type ArrangeMode = "radial" | "left_to_right" | "top_down" | "by_date"`, `arrangeModes`, `arrangeModeLabel(mode)`
  - `arrangeGraph(graph, mode): EditableMapGraph`
  - `placeNewNode(nodes: EditableMapNode[], center: { x: number; y: number }): { x: number; y: number }`
- Produces in `map-types.ts`: `mapNodeTypeLabel(type)`, `mapNodeStatusLabel(status)`, `mapEdgeTypeLabel(type)`

- [ ] **Step 1: Write failing graph-ops tests**

Append to `src/features/maps/map-graph-ops.test.ts` (reuse the `graph` fixture from the `withFreshIds` test by hoisting it to a shared `function twoNodeGraph(): EditableMapGraph` helper):

```ts
import { deleteEdge, deleteNode, updateEdge, updateNode } from "./map-graph-ops";

describe("node and edge edits", () => {
  it("updates a node without touching the others", () => {
    const next = updateNode(twoNodeGraph(), "a", { title: "Renamed", nodeType: "risk" });
    expect(next.nodes[0]).toMatchObject({ id: "a", title: "Renamed", nodeType: "risk" });
    expect(next.nodes[1].title).toBe("B");
  });

  it("deletes a node and every edge touching it", () => {
    const next = deleteNode(twoNodeGraph(), "a");
    expect(next.nodes.map((node) => node.id)).toEqual(["b"]);
    expect(next.edges).toEqual([]);
  });

  it("updates an edge", () => {
    const next = updateEdge(twoNodeGraph(), "a-b", { edgeType: "dependency", label: "needs", isDirectional: true });
    expect(next.edges[0]).toMatchObject({ id: "a-b", edgeType: "dependency", label: "needs", isDirectional: true });
  });

  it("deletes an edge and keeps the nodes", () => {
    const next = deleteEdge(twoNodeGraph(), "a-b");
    expect(next.edges).toEqual([]);
    expect(next.nodes).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Implement the graph-ops helpers**

Append to `src/features/maps/map-graph-ops.ts` (add `EditableMapEdge` to the type import):

```ts
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
```

Run: `npm test -- src/features/maps/map-graph-ops.test.ts` → PASS.

- [ ] **Step 3: Write the label helper test and implementation**

Create `src/features/maps/map-types.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { mapEdgeTypeLabel, mapEdgeTypes, mapNodeStatusLabel, mapNodeStatuses, mapNodeTypeLabel, mapNodeTypes } from "./map-types";

describe("map labels", () => {
  it("labels every node type, status and edge type", () => {
    expect(mapNodeTypeLabel("task_candidate")).toBe("Task candidate");
    expect(mapNodeStatusLabel("converted")).toBe("Converted");
    expect(mapEdgeTypeLabel("outcome")).toBe("Outcome");
    mapNodeTypes.forEach((type) => expect(mapNodeTypeLabel(type)).toBeTruthy());
    mapNodeStatuses.forEach((status) => expect(mapNodeStatusLabel(status)).toBeTruthy());
    mapEdgeTypes.forEach((type) => expect(mapEdgeTypeLabel(type)).toBeTruthy());
  });
});
```

Append to `src/features/maps/map-types.ts`:

```ts
export function mapNodeTypeLabel(type: MindMapNodeType) {
  const labels: Record<MindMapNodeType, string> = {
    idea: "Idea",
    task_candidate: "Task candidate",
    note: "Note",
    milestone: "Milestone",
    decision: "Decision",
    option: "Option",
    risk: "Risk",
    reference: "Reference",
  };
  return labels[type];
}

export function mapNodeStatusLabel(status: MindMapNodeStatus) {
  const labels: Record<MindMapNodeStatus, string> = {
    open: "Open",
    selected: "Selected",
    rejected: "Rejected",
    converted: "Converted",
    archived: "Archived",
  };
  return labels[status];
}

export function mapEdgeTypeLabel(type: MindMapEdgeType) {
  const labels: Record<MindMapEdgeType, string> = {
    association: "Association",
    dependency: "Dependency",
    sequence: "Sequence",
    choice: "Choice",
    outcome: "Outcome",
  };
  return labels[type];
}
```

Run: `npm test -- src/features/maps/map-types.test.ts` → PASS.

- [ ] **Step 4: Write the failing layout tests**

Replace `src/features/maps/map-layouts.test.ts` with:

```ts
import { describe, expect, it } from "vitest";
import { arrangeGraph, arrangeModes, placeNewNode } from "./map-layouts";
import { mapTemplates } from "./map-templates";
import type { EditableMapGraph, EditableMapNode } from "./map-types";

function node(id: string, extra: Partial<EditableMapNode> = {}): EditableMapNode {
  return { id, title: id, body: "", nodeType: "idea", status: "open", position: { x: 0, y: 0 }, accent: "cyan", tags: [], ...extra };
}

function edge(source: string, target: string) {
  return { id: `${source}-${target}`, sourceNodeId: source, targetNodeId: target, edgeType: "association" as const, label: "", isDirectional: false };
}

function graphOf(nodes: EditableMapNode[], edges: ReturnType<typeof edge>[]): EditableMapGraph {
  return { title: "t", description: "", defaultView: "mind_map", nodes, edges };
}

function positionOf(graph: EditableMapGraph, id: string) {
  return graph.nodes.find((item) => item.id === id)!.position;
}

function boxesOverlap(a: { x: number; y: number }, b: { x: number; y: number }, width = 200, height = 40) {
  return Math.abs(a.x - b.x) < width && Math.abs(a.y - b.y) < height;
}

const tree = graphOf([node("root"), node("a"), node("b"), node("a1"), node("a2")], [
  edge("root", "a"),
  edge("root", "b"),
  edge("a", "a1"),
  edge("a", "a2"),
]);

describe("arrangeGraph", () => {
  it("is deterministic", () => {
    expect(arrangeGraph(tree, "left_to_right")).toEqual(arrangeGraph(tree, "left_to_right"));
  });

  it("returns the same graph when there are no nodes", () => {
    const empty = graphOf([], []);
    expect(arrangeGraph(empty, "radial")).toBe(empty);
  });

  it("lays a tree out left to right by depth with subtrees stacked", () => {
    const next = arrangeGraph(tree, "left_to_right");
    expect(positionOf(next, "root").x).toBe(0);
    expect(positionOf(next, "a").x).toBe(260);
    expect(positionOf(next, "a1").x).toBe(520);
    expect(positionOf(next, "a1").y).toBe(0);
    expect(positionOf(next, "a2").y).toBe(90);
    expect(positionOf(next, "a").y).toBe(45);
    expect(positionOf(next, "b").y).toBe(180);
  });

  it("lays a tree out top down", () => {
    const next = arrangeGraph(tree, "top_down");
    expect(positionOf(next, "root").y).toBe(0);
    expect(positionOf(next, "a").y).toBe(150);
    expect(positionOf(next, "a1").x).toBe(0);
    expect(positionOf(next, "a2").x).toBe(240);
    expect(positionOf(next, "b").x).toBe(480);
  });

  it("puts the root at the centre in radial and children on the first ring", () => {
    const next = arrangeGraph(tree, "radial");
    expect(positionOf(next, "root")).toEqual({ x: 0, y: 0 });
    const distance = (id: string) => Math.hypot(positionOf(next, id).x, positionOf(next, id).y);
    expect(distance("a")).toBeCloseTo(220, 0);
    expect(distance("b")).toBeCloseTo(220, 0);
    expect(distance("a1")).toBeCloseTo(440, 0);
  });

  it("handles cycles and disconnected nodes without looping", () => {
    const cyclic = graphOf([node("x"), node("y"), node("lonely")], [edge("x", "y"), edge("y", "x")]);
    for (const mode of arrangeModes) {
      const next = arrangeGraph(cyclic, mode);
      const positions = next.nodes.map((item) => `${item.position.x},${item.position.y}`);
      expect(new Set(positions).size).toBe(3);
    }
  });

  it("sorts dated nodes on the top row and keeps undated nodes below", () => {
    const dated = graphOf(
      [
        node("later", { dueDate: "2026-10-01", position: { x: 900, y: 0 } }),
        node("sooner", { startDate: "2026-09-01" }),
        node("undated-b", { position: { x: 50, y: 0 } }),
        node("undated-a", { position: { x: 10, y: 0 } }),
      ],
      [],
    );
    const next = arrangeGraph(dated, "by_date");
    expect(positionOf(next, "sooner")).toEqual({ x: 0, y: 0 });
    expect(positionOf(next, "later")).toEqual({ x: 260, y: 0 });
    expect(positionOf(next, "undated-a")).toEqual({ x: 0, y: 180 });
    expect(positionOf(next, "undated-b")).toEqual({ x: 260, y: 180 });
  });

  it.each(mapTemplates.map((template) => [template.id, template]))("does not overlap nodes for template %s", (_id, template) => {
    const graph = graphOf(template.nodes.map((item) => ({ ...item })), template.edges);
    for (const mode of ["left_to_right", "top_down", "by_date"] as const) {
      const next = arrangeGraph(graph, mode);
      next.nodes.forEach((a, i) =>
        next.nodes.slice(i + 1).forEach((b) => {
          expect(boxesOverlap(a.position, b.position)).toBe(false);
        }),
      );
    }
    const radial = arrangeGraph(graph, "radial");
    radial.nodes.forEach((a, i) =>
      radial.nodes.slice(i + 1).forEach((b) => {
        expect(Math.hypot(a.position.x - b.position.x, a.position.y - b.position.y)).toBeGreaterThanOrEqual(120);
      }),
    );
  });
});

describe("placeNewNode", () => {
  it("returns the centre when nothing is there", () => {
    expect(placeNewNode([], { x: 100.4, y: 50.6 })).toEqual({ x: 100, y: 51 });
  });

  it("moves off an occupied box", () => {
    const occupied = [node("a", { position: { x: 100, y: 50 } })];
    const placed = placeNewNode(occupied, { x: 100, y: 50 });
    expect(boxesOverlap(placed, { x: 100, y: 50 })).toBe(false);
  });
});
```

`mapTemplates` must export objects with `id`, `nodes`, `edges` — it already does (see `map-library-panel.tsx` usage).

- [ ] **Step 5: Run to see failures**

Run: `npm test -- src/features/maps/map-layouts.test.ts`
Expected: FAIL — `arrangeGraph`, `arrangeModes`, `placeNewNode` not exported.

- [ ] **Step 6: Implement the layouts**

Replace `src/features/maps/map-layouts.ts` with the following, **keeping the existing `applyViewLayout` function appended unchanged at the bottom** (Task 5 removes it):

```ts
import type { EditableMapGraph, EditableMapNode } from "./map-types";

export const arrangeModes = ["radial", "left_to_right", "top_down", "by_date"] as const;
export type ArrangeMode = (typeof arrangeModes)[number];

export function arrangeModeLabel(mode: ArrangeMode) {
  const labels: Record<ArrangeMode, string> = {
    radial: "Radial",
    left_to_right: "Left to right",
    top_down: "Top down",
    by_date: "By date",
  };
  return labels[mode];
}

const LTR_DEPTH_GAP = 260;
const LTR_SIBLING_GAP = 90;
const TD_DEPTH_GAP = 150;
const TD_SIBLING_GAP = 240;
const RING_GAP = 220;
const RING_ARC_PER_NODE = 230;
const DATE_COLUMN_GAP = 260;
const UNDATED_ROW_Y = 180;
const NODE_BOX = { width: 200, height: 40 };

type Point = { x: number; y: number };
type Forest = { roots: string[]; children: Map<string, string[]> };

function buildForest(graph: EditableMapGraph): Forest {
  const ids = graph.nodes.map((node) => node.id);
  const outgoing = new Map<string, string[]>(ids.map((id) => [id, []]));
  const incoming = new Map<string, number>(ids.map((id) => [id, 0]));
  const degree = new Map<string, number>(ids.map((id) => [id, 0]));

  for (const edge of graph.edges) {
    if (!outgoing.has(edge.sourceNodeId) || !incoming.has(edge.targetNodeId)) continue;
    outgoing.get(edge.sourceNodeId)?.push(edge.targetNodeId);
    incoming.set(edge.targetNodeId, (incoming.get(edge.targetNodeId) ?? 0) + 1);
    degree.set(edge.sourceNodeId, (degree.get(edge.sourceNodeId) ?? 0) + 1);
    degree.set(edge.targetNodeId, (degree.get(edge.targetNodeId) ?? 0) + 1);
  }

  const visited = new Set<string>();
  const children = new Map<string, string[]>();
  const roots: string[] = [];

  function visit(rootId: string) {
    roots.push(rootId);
    visited.add(rootId);
    const queue = [rootId];
    while (queue.length > 0) {
      const id = queue.shift() as string;
      const kids: string[] = [];
      for (const target of outgoing.get(id) ?? []) {
        if (visited.has(target)) continue;
        visited.add(target);
        kids.push(target);
        queue.push(target);
      }
      children.set(id, kids);
    }
  }

  const naturalRoots = ids.filter((id) => incoming.get(id) === 0);
  const seeds =
    naturalRoots.length > 0
      ? naturalRoots
      : [...ids].sort((left, right) => (degree.get(right) ?? 0) - (degree.get(left) ?? 0)).slice(0, 1);
  for (const id of seeds) if (!visited.has(id)) visit(id);
  for (const id of ids) if (!visited.has(id)) visit(id);

  return { roots, children };
}

function leafCount(id: string, children: Map<string, string[]>, memo: Map<string, number>): number {
  const known = memo.get(id);
  if (known !== undefined) return known;
  const kids = children.get(id) ?? [];
  const count = kids.length === 0 ? 1 : kids.reduce((sum, kid) => sum + leafCount(kid, children, memo), 0);
  memo.set(id, count);
  return count;
}

function layeredPositions(forest: Forest): Map<string, { depth: number; lane: number }> {
  const memo = new Map<string, number>();
  const out = new Map<string, { depth: number; lane: number }>();

  function place(id: string, depth: number, laneStart: number) {
    const width = leafCount(id, forest.children, memo);
    out.set(id, { depth, lane: laneStart + (width - 1) / 2 });
    let cursor = laneStart;
    for (const kid of forest.children.get(id) ?? []) {
      place(kid, depth + 1, cursor);
      cursor += leafCount(kid, forest.children, memo);
    }
  }

  let laneOffset = 0;
  for (const root of forest.roots) {
    place(root, 0, laneOffset);
    laneOffset += leafCount(root, forest.children, memo);
  }
  return out;
}

function radialTree(forest: Forest, rootId: string): { positions: Map<string, Point>; radius: number } {
  const memo = new Map<string, number>();
  const positions = new Map<string, Point>();
  const perDepth = new Map<number, number>();

  const countDepths = (id: string, depth: number) => {
    perDepth.set(depth, (perDepth.get(depth) ?? 0) + 1);
    for (const kid of forest.children.get(id) ?? []) countDepths(kid, depth + 1);
  };
  countDepths(rootId, 0);

  const radiusAt = (depth: number) =>
    depth === 0 ? 0 : Math.max(RING_GAP * depth, ((perDepth.get(depth) ?? 1) * RING_ARC_PER_NODE) / (2 * Math.PI));

  const place = (id: string, depth: number, start: number, end: number) => {
    const mid = (start + end) / 2;
    const radius = radiusAt(depth);
    positions.set(id, { x: Math.round(Math.cos(mid) * radius), y: Math.round(Math.sin(mid) * radius) });
    const kids = forest.children.get(id) ?? [];
    const total = kids.reduce((sum, kid) => sum + leafCount(kid, forest.children, memo), 0);
    let cursor = start;
    for (const kid of kids) {
      const span = ((end - start) * leafCount(kid, forest.children, memo)) / total;
      place(kid, depth + 1, cursor, cursor + span);
      cursor += span;
    }
  };
  place(rootId, 0, -Math.PI / 2, (3 * Math.PI) / 2);

  const maxDepth = Math.max(...perDepth.keys());
  return { positions, radius: radiusAt(maxDepth) };
}

function radialPositions(forest: Forest): Map<string, Point> {
  const out = new Map<string, Point>();
  let offsetX = 0;
  forest.roots.forEach((root, index) => {
    const { positions, radius } = radialTree(forest, root);
    if (index > 0) offsetX += radius + RING_GAP;
    positions.forEach((point, id) => out.set(id, { x: point.x + offsetX, y: point.y }));
    offsetX += radius + RING_GAP;
  });
  return out;
}

function byDatePositions(nodes: EditableMapNode[]): Map<string, Point> {
  const out = new Map<string, Point>();
  const dateOf = (node: EditableMapNode) => node.startDate ?? node.dueDate ?? null;
  const dated = nodes.filter((node) => dateOf(node)).sort((a, b) => (dateOf(a) as string).localeCompare(dateOf(b) as string));
  const undated = nodes.filter((node) => !dateOf(node)).sort((a, b) => a.position.x - b.position.x);
  dated.forEach((node, index) => out.set(node.id, { x: index * DATE_COLUMN_GAP, y: 0 }));
  undated.forEach((node, index) => out.set(node.id, { x: index * DATE_COLUMN_GAP, y: UNDATED_ROW_Y }));
  return out;
}

export function arrangeGraph(graph: EditableMapGraph, mode: ArrangeMode): EditableMapGraph {
  if (graph.nodes.length === 0) return graph;

  let positions: Map<string, Point>;
  if (mode === "by_date") {
    positions = byDatePositions(graph.nodes);
  } else if (mode === "radial") {
    positions = radialPositions(buildForest(graph));
  } else {
    const layered = layeredPositions(buildForest(graph));
    positions = new Map();
    layered.forEach(({ depth, lane }, id) => {
      positions.set(
        id,
        mode === "left_to_right"
          ? { x: depth * LTR_DEPTH_GAP, y: lane * LTR_SIBLING_GAP }
          : { x: lane * TD_SIBLING_GAP, y: depth * TD_DEPTH_GAP },
      );
    });
  }

  return {
    ...graph,
    nodes: graph.nodes.map((node) => {
      const position = positions.get(node.id);
      return position ? { ...node, position } : node;
    }),
  };
}

export function placeNewNode(nodes: EditableMapNode[], center: Point): Point {
  const overlaps = (point: Point) =>
    nodes.some(
      (node) => Math.abs(node.position.x - point.x) < NODE_BOX.width && Math.abs(node.position.y - point.y) < NODE_BOX.height,
    );

  let candidate = { x: Math.round(center.x), y: Math.round(center.y) };
  let step = 0;
  while (overlaps(candidate) && step < 200) {
    step += 1;
    const angle = step * 0.9;
    const radius = 40 * Math.sqrt(step);
    candidate = {
      x: Math.round(center.x + Math.cos(angle) * radius * 2.5),
      y: Math.round(center.y + Math.sin(angle) * radius),
    };
  }
  return candidate;
}
```

- [ ] **Step 7: Run the layout tests**

Run: `npm test -- src/features/maps/map-layouts.test.ts`
Expected: PASS. If the template overlap test fails for a specific template in `top_down`, raise `TD_SIBLING_GAP` rather than loosening the test.

- [ ] **Step 8: Commit**

```bash
git add src/features/maps/map-graph-ops.ts src/features/maps/map-graph-ops.test.ts src/features/maps/map-layouts.ts src/features/maps/map-layouts.test.ts src/features/maps/map-types.ts src/features/maps/map-types.test.ts
git commit -m "feat(maps): edit/delete graph ops, Arrange layouts, node placement"
```

---
### Task 3: `useMapEditor` — graph state, undo/redo, debounced autosave, flush

**Files:**
- Create: `src/features/maps/use-map-editor.ts`
- Test: `src/features/maps/use-map-editor.test.ts`

**Interfaces:**
- Produces:

```ts
export type MapSaveStatus = "saved" | "dirty" | "saving" | "error";
export type MapSelection = { kind: "node" | "edge"; id: string } | null;
export type SetGraphOptions = { undoable?: boolean; coalesceKey?: string };
export const RETRY_DELAYS_MS: number[];          // [2000, 6000, 18000]
export function mergeServerGraph(local: EditableMapGraph, server: EditableMapGraph): EditableMapGraph;
export function useMapEditor(input: {
  initialGraph: EditableMapGraph | null;
  save: (graph: EditableMapGraph) => Promise<EditableMapGraph>;
  onSaved?: (graph: EditableMapGraph) => void;
  initialSelection?: MapSelection;
}): {
  graph: EditableMapGraph | null;
  setGraph: (next: EditableMapGraph, options?: SetGraphOptions) => void;
  selection: MapSelection;
  setSelection: (selection: MapSelection) => void;
  status: MapSaveStatus;
  error: string | null;
  flush: () => Promise<void>;
  retry: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  mergeServerNode: (nodeId: string, patch: Partial<EditableMapNode>) => void;
};
```

- The hook initialises once from the first non-null `initialGraph`. The page renders the editor with `key={mapId}` so switching maps remounts it (Task 10/11).
- `setGraph` with `undoable: false` updates the graph without recording history and without moving the undo baseline; the next `undoable: true` call records the baseline from before the non-undoable run (this is how a drag becomes one entry).
- `mergeServerNode` patches a node in place **without** marking the map dirty (used after conversion).

- [ ] **Step 1: Write the failing hook tests**

Create `src/features/maps/use-map-editor.test.ts`:

```ts
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { EditableMapGraph } from "./map-types";
import { mergeServerGraph, useMapEditor } from "./use-map-editor";

function graphWith(title: string, x = 0): EditableMapGraph {
  return {
    title,
    description: "",
    defaultView: "mind_map",
    nodes: [{ id: "n1", title: "Node", body: "", nodeType: "idea", status: "open", position: { x, y: 0 }, accent: "cyan", tags: [] }],
    edges: [],
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const initial = graphWith("Initial");

function setup(save = vi.fn(async (graph: EditableMapGraph) => graph)) {
  const onSaved = vi.fn();
  const hook = renderHook(() => useMapEditor({ initialGraph: initial, save, onSaved }));
  return { ...hook, save, onSaved };
}

describe("useMapEditor", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("saves once, with the latest graph, after rapid edits", async () => {
    const { result, save } = setup();

    act(() => result.current.setGraph(graphWith("One")));
    act(() => result.current.setGraph(graphWith("Two")));
    act(() => result.current.setGraph(graphWith("Three")));
    expect(result.current.status).toBe("dirty");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(800);
    });

    expect(save).toHaveBeenCalledTimes(1);
    expect(save.mock.calls[0][0].title).toBe("Three");
    expect(result.current.status).toBe("saved");
  });

  it("sends exactly one follow-up save when edits arrive during an in-flight save", async () => {
    const first = deferred<EditableMapGraph>();
    const save = vi.fn().mockReturnValueOnce(first.promise).mockImplementation(async (graph: EditableMapGraph) => graph);
    const { result } = setup(save);

    act(() => result.current.setGraph(graphWith("One")));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(800);
    });
    expect(save).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe("saving");

    act(() => result.current.setGraph(graphWith("Two")));
    act(() => result.current.setGraph(graphWith("Three")));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(800);
    });
    expect(save).toHaveBeenCalledTimes(1);

    await act(async () => {
      first.resolve(graphWith("One"));
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(save).toHaveBeenCalledTimes(2);
    expect(save.mock.calls[1][0].title).toBe("Three");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current.status).toBe("saved");
  });

  it("flush saves immediately and resolves once the save settles", async () => {
    const { result, save, onSaved } = setup();

    act(() => result.current.setGraph(graphWith("Flushed")));
    await act(async () => {
      await result.current.flush();
    });

    expect(save).toHaveBeenCalledTimes(1);
    expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ title: "Flushed" }));
    expect(result.current.status).toBe("saved");
  });

  it("keeps local edits, reports the error, and retries on the schedule", async () => {
    const save = vi.fn().mockRejectedValue(new Error("offline"));
    const { result } = setup(save);

    act(() => result.current.setGraph(graphWith("Edited")));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(800);
    });

    expect(result.current.status).toBe("error");
    expect(result.current.error).toBe("offline");
    expect(result.current.graph?.title).toBe("Edited");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(save).toHaveBeenCalledTimes(2);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(6000);
    });
    expect(save).toHaveBeenCalledTimes(3);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(18000);
    });
    expect(save).toHaveBeenCalledTimes(4);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60000);
    });
    expect(save).toHaveBeenCalledTimes(4);

    save.mockImplementation(async (graph: EditableMapGraph) => graph);
    act(() => result.current.retry());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current.status).toBe("saved");
  });

  it("flush rejects when the save fails so callers can stop", async () => {
    const save = vi.fn().mockRejectedValue(new Error("offline"));
    const { result } = setup(save);

    act(() => result.current.setGraph(graphWith("Edited")));
    await expect(
      act(async () => {
        await result.current.flush();
      }),
    ).rejects.toThrow("offline");
  });

  it("undoes and redoes", () => {
    const { result } = setup();

    act(() => result.current.setGraph(graphWith("One")));
    act(() => result.current.setGraph(graphWith("Two")));
    expect(result.current.canUndo).toBe(true);

    act(() => result.current.undo());
    expect(result.current.graph?.title).toBe("One");
    act(() => result.current.undo());
    expect(result.current.graph?.title).toBe("Initial");
    expect(result.current.canUndo).toBe(false);

    act(() => result.current.redo());
    expect(result.current.graph?.title).toBe("One");
    expect(result.current.canRedo).toBe(true);
  });

  it("caps the undo stack at 50 entries", () => {
    const { result } = setup();

    for (let index = 1; index <= 60; index += 1) {
      act(() => result.current.setGraph(graphWith(`Edit ${index}`)));
    }
    for (let index = 0; index < 50; index += 1) {
      act(() => result.current.undo());
    }

    expect(result.current.graph?.title).toBe("Edit 10");
    expect(result.current.canUndo).toBe(false);
  });

  it("records a drag as one undo entry when frames are not undoable", () => {
    const { result } = setup();

    act(() => result.current.setGraph(graphWith("Initial", 10), { undoable: false }));
    act(() => result.current.setGraph(graphWith("Initial", 20), { undoable: false }));
    act(() => result.current.setGraph(graphWith("Initial", 30), { undoable: true }));

    act(() => result.current.undo());
    expect(result.current.graph?.nodes[0].position.x).toBe(0);
    expect(result.current.canUndo).toBe(false);
  });

  it("coalesces edits with the same key inside 500ms", () => {
    const { result } = setup();

    act(() => result.current.setGraph(graphWith("T"), { coalesceKey: "title" }));
    act(() => vi.advanceTimersByTime(200));
    act(() => result.current.setGraph(graphWith("Ty"), { coalesceKey: "title" }));
    act(() => vi.advanceTimersByTime(600));
    act(() => result.current.setGraph(graphWith("Typ"), { coalesceKey: "title" }));

    act(() => result.current.undo());
    expect(result.current.graph?.title).toBe("Ty");
    act(() => result.current.undo());
    expect(result.current.graph?.title).toBe("Initial");
  });

  it("merges server-owned fields without moving nodes", async () => {
    const save = vi.fn(async (graph: EditableMapGraph) => ({
      ...graph,
      nodes: graph.nodes.map((node) => ({ ...node, position: { x: 999, y: 999 }, convertedType: "note" as const, convertedId: "note-1", convertedAt: "2026-09-01T00:00:00.000Z" })),
    }));
    const { result } = setup(save);

    act(() => result.current.setGraph(graphWith("Edited", 5)));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(800);
    });

    expect(result.current.graph?.nodes[0].position.x).toBe(5);
    expect(result.current.graph?.nodes[0].convertedId).toBe("note-1");
  });

  it("mergeServerNode patches a node without dirtying the map", () => {
    const { result } = setup();

    act(() => result.current.mergeServerNode("n1", { status: "converted", convertedType: "task", convertedId: "task-1" }));

    expect(result.current.graph?.nodes[0].convertedId).toBe("task-1");
    expect(result.current.status).toBe("saved");
  });

  it("registers a beforeunload guard only while unsaved", () => {
    const addSpy = vi.spyOn(window, "addEventListener");
    const removeSpy = vi.spyOn(window, "removeEventListener");
    const { result } = setup();

    expect(addSpy.mock.calls.some(([type]) => type === "beforeunload")).toBe(false);
    act(() => result.current.setGraph(graphWith("Dirty")));
    expect(addSpy.mock.calls.some(([type]) => type === "beforeunload")).toBe(true);

    return act(async () => {
      await vi.advanceTimersByTimeAsync(800);
    }).then(() => {
      expect(removeSpy.mock.calls.some(([type]) => type === "beforeunload")).toBe(true);
    });
  });
});

describe("mergeServerGraph", () => {
  it("copies converted fields by node id and leaves unknown nodes alone", () => {
    const local = graphWith("Local", 1);
    const server = { ...local, nodes: [{ ...local.nodes[0], position: { x: 50, y: 50 }, convertedType: "task" as const, convertedId: "t1", convertedAt: "now" }] };

    const merged = mergeServerGraph(local, server);

    expect(merged.nodes[0].position).toEqual({ x: 1, y: 0 });
    expect(merged.nodes[0]).toMatchObject({ convertedType: "task", convertedId: "t1", convertedAt: "now" });
  });
});
```

- [ ] **Step 2: Run to see it fail**

Run: `npm test -- src/features/maps/use-map-editor.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the hook**

Create `src/features/maps/use-map-editor.ts`:

```ts
import { useCallback, useEffect, useRef, useState } from "react";
import type { EditableMapGraph, EditableMapNode } from "./map-types";

export type MapSaveStatus = "saved" | "dirty" | "saving" | "error";
export type MapSelection = { kind: "node" | "edge"; id: string } | null;
export type SetGraphOptions = { undoable?: boolean; coalesceKey?: string };

const SAVE_DEBOUNCE_MS = 800;
const COALESCE_WINDOW_MS = 500;
const UNDO_LIMIT = 50;
export const RETRY_DELAYS_MS = [2000, 6000, 18000];

type UseMapEditorInput = {
  initialGraph: EditableMapGraph | null;
  save: (graph: EditableMapGraph) => Promise<EditableMapGraph>;
  onSaved?: (graph: EditableMapGraph) => void;
  initialSelection?: MapSelection;
};

/** Only the fields the server owns come back into local state; positions and text stay local. */
export function mergeServerGraph(local: EditableMapGraph, server: EditableMapGraph): EditableMapGraph {
  const serverNodes = new Map(server.nodes.map((node) => [node.id, node]));
  return {
    ...local,
    nodes: local.nodes.map((node) => {
      const remote = serverNodes.get(node.id);
      if (!remote) return node;
      return {
        ...node,
        convertedType: remote.convertedType ?? null,
        convertedId: remote.convertedId ?? null,
        convertedAt: remote.convertedAt ?? null,
      };
    }),
  };
}

function errorMessage(cause: unknown) {
  return cause instanceof Error && cause.message ? cause.message : "Could not save the map.";
}

export function useMapEditor({ initialGraph, save, onSaved, initialSelection = null }: UseMapEditorInput) {
  const [graph, setGraphState] = useState<EditableMapGraph | null>(initialGraph);
  const [selection, setSelection] = useState<MapSelection>(initialSelection);
  const [status, setStatus] = useState<MapSaveStatus>("saved");
  const [error, setError] = useState<string | null>(null);
  const [, setHistoryVersion] = useState(0);

  const graphRef = useRef<EditableMapGraph | null>(initialGraph);
  const committedRef = useRef<EditableMapGraph | null>(initialGraph);
  const undoRef = useRef<EditableMapGraph[]>([]);
  const redoRef = useRef<EditableMapGraph[]>([]);
  const lastPushRef = useRef<{ key: string | null; at: number }>({ key: null, at: 0 });
  const loadedRef = useRef(initialGraph !== null);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlightRef = useRef<Promise<void> | null>(null);
  const pendingRef = useRef(false);
  const dirtyRef = useRef(false);
  const attemptRef = useRef(0);
  const errorRef = useRef<string | null>(null);
  const saveRef = useRef(save);
  saveRef.current = save;
  const onSavedRef = useRef(onSaved);
  onSavedRef.current = onSaved;

  useEffect(() => {
    if (loadedRef.current || !initialGraph) return;
    loadedRef.current = true;
    graphRef.current = initialGraph;
    committedRef.current = initialGraph;
    setGraphState(initialGraph);
  }, [initialGraph]);

  const bumpHistory = useCallback(() => setHistoryVersion((version) => version + 1), []);

  const runSave = useCallback((): Promise<void> => {
    if (inFlightRef.current) {
      pendingRef.current = true;
      return inFlightRef.current;
    }
    const snapshot = graphRef.current;
    if (!snapshot) return Promise.resolve();

    dirtyRef.current = false;
    setStatus("saving");

    const promise = saveRef
      .current(snapshot)
      .then((serverGraph) => {
        attemptRef.current = 0;
        errorRef.current = null;
        const merged = mergeServerGraph(graphRef.current ?? snapshot, serverGraph);
        graphRef.current = merged;
        committedRef.current = committedRef.current ? mergeServerGraph(committedRef.current, serverGraph) : merged;
        setGraphState(merged);
        setError(null);
        onSavedRef.current?.(merged);
      })
      .catch((cause: unknown) => {
        dirtyRef.current = true;
        errorRef.current = errorMessage(cause);
        setError(errorRef.current);
        setStatus("error");
        const delay = RETRY_DELAYS_MS[attemptRef.current];
        attemptRef.current += 1;
        if (delay !== undefined) {
          retryTimerRef.current = setTimeout(() => {
            retryTimerRef.current = null;
            void runSave();
          }, delay);
        }
      })
      .finally(() => {
        inFlightRef.current = null;
        if (pendingRef.current) {
          pendingRef.current = false;
          void runSave();
        } else if (!dirtyRef.current) {
          setStatus("saved");
        }
      });

    inFlightRef.current = promise;
    return promise;
  }, []);

  const scheduleSave = useCallback(() => {
    dirtyRef.current = true;
    attemptRef.current = 0;
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
    setStatus((current) => (current === "saving" ? current : "dirty"));
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      void runSave();
    }, SAVE_DEBOUNCE_MS);
  }, [runSave]);

  const setGraph = useCallback(
    (next: EditableMapGraph, options: SetGraphOptions = {}) => {
      const { undoable = true, coalesceKey } = options;
      const previous = committedRef.current;
      graphRef.current = next;
      setGraphState(next);

      if (undoable && previous) {
        const now = Date.now();
        const coalesce =
          coalesceKey !== undefined &&
          lastPushRef.current.key === coalesceKey &&
          now - lastPushRef.current.at < COALESCE_WINDOW_MS;
        if (!coalesce) {
          undoRef.current.push(previous);
          if (undoRef.current.length > UNDO_LIMIT) undoRef.current.shift();
          redoRef.current = [];
          bumpHistory();
        }
        lastPushRef.current = { key: coalesceKey ?? null, at: now };
        committedRef.current = next;
      }

      scheduleSave();
    },
    [bumpHistory, scheduleSave],
  );

  const restore = useCallback(
    (target: EditableMapGraph) => {
      graphRef.current = target;
      committedRef.current = target;
      lastPushRef.current = { key: null, at: 0 };
      setGraphState(target);
      bumpHistory();
      scheduleSave();
    },
    [bumpHistory, scheduleSave],
  );

  const undo = useCallback(() => {
    const previous = undoRef.current.pop();
    if (!previous) return;
    if (committedRef.current) redoRef.current.push(committedRef.current);
    restore(previous);
  }, [restore]);

  const redo = useCallback(() => {
    const next = redoRef.current.pop();
    if (!next) return;
    if (committedRef.current) undoRef.current.push(committedRef.current);
    restore(next);
  }, [restore]);

  const flush = useCallback(async () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
    if (dirtyRef.current || pendingRef.current) await runSave();
    while (inFlightRef.current) await inFlightRef.current;
    if (dirtyRef.current) throw new Error(errorRef.current ?? "Could not save the map.");
  }, [runSave]);

  const retry = useCallback(() => {
    attemptRef.current = 0;
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
    void runSave();
  }, [runSave]);

  const mergeServerNode = useCallback((nodeId: string, patch: Partial<EditableMapNode>) => {
    const apply = (target: EditableMapGraph | null) =>
      target ? { ...target, nodes: target.nodes.map((node) => (node.id === nodeId ? { ...node, ...patch } : node)) } : target;
    graphRef.current = apply(graphRef.current);
    committedRef.current = apply(committedRef.current);
    setGraphState(graphRef.current);
  }, []);

  useEffect(() => {
    if (status === "saved") return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [status]);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      if (dirtyRef.current && !inFlightRef.current && graphRef.current) {
        void saveRef.current(graphRef.current).catch(() => undefined);
      }
    },
    [],
  );

  return {
    graph,
    setGraph,
    selection,
    setSelection,
    status,
    error,
    flush,
    retry,
    undo,
    redo,
    canUndo: undoRef.current.length > 0,
    canRedo: redoRef.current.length > 0,
    mergeServerNode,
  };
}
```

- [ ] **Step 4: Run the hook tests**

Run: `npm test -- src/features/maps/use-map-editor.test.ts`
Expected: PASS. If the "follow-up save" test sees `status` still `"saving"` after the resolve, add one more `await vi.advanceTimersByTimeAsync(0)` — the follow-up save resolves on the next microtask tick.

- [ ] **Step 5: Commit**

```bash
git add src/features/maps/use-map-editor.ts src/features/maps/use-map-editor.test.ts
git commit -m "feat(maps): useMapEditor with undo/redo and debounced autosave"
```

---

### Task 4: Thumbnail sizes and the library `MapCard`

**Files:**
- Modify: `src/features/maps/map-template-thumbnail.tsx`
- Create: `src/features/maps/map-card.tsx`
- Modify: `src/styles.css` (card + menu styles, next to `.map-template-card`)
- Test: `src/features/maps/map-template-thumbnail.test.tsx` (add one case), `src/features/maps/map-card.test.tsx`

**Interfaces:**
- Consumes: `MindMap`, `MindMapPreview` from `maps.queries.ts` (Task 1).
- Produces:
  - `TemplateThumbnail({ nodes, edges, size?: "sm" | "md" })` — `md` renders a 160×90 viewBox that fills its container width.
  - `formatRelativeTime(iso: string, now?: number): string`
  - `MapCard(props: { map: MindMap; preview?: MindMapPreview; isRenaming: boolean; onOpen(); onStartRename(); onRename(title: string); onCancelRename(); onDuplicate(); onArchive(); })`

- [ ] **Step 1: Thumbnail size test**

Append to `src/features/maps/map-template-thumbnail.test.tsx`:

```ts
  it("renders the medium size with a 160x90 viewBox that fills its container", () => {
    const { container } = render(<TemplateThumbnail edges={[]} nodes={[]} size="md" />);
    const svg = container.querySelector("svg") as SVGSVGElement;
    expect(svg.getAttribute("viewBox")).toBe("0 0 160 90");
    expect(svg).toHaveClass("w-full");
  });
```

- [ ] **Step 2: Implement the size prop**

In `src/features/maps/map-template-thumbnail.tsx` replace the `WIDTH`/`HEIGHT` constants and the component with:

```tsx
const sizes = {
  sm: { width: 96, height: 52, className: "h-[3.25rem] w-24 shrink-0" },
  md: { width: 160, height: 90, className: "aspect-[16/9] h-auto w-full" },
} as const;
const PAD = 8;

export function TemplateThumbnail({
  edges,
  nodes,
  size = "sm",
}: {
  edges: ThumbnailEdge[];
  nodes: ThumbnailNode[];
  size?: keyof typeof sizes;
}) {
  const { width: WIDTH, height: HEIGHT, className } = sizes[size];
  const xs = nodes.map((node) => node.position.x);
  const ys = nodes.map((node) => node.position.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  const scaled = new Map(
    nodes.map((node) => [
      node.id,
      {
        x: maxX === minX ? WIDTH / 2 : PAD + ((node.position.x - minX) / (maxX - minX)) * (WIDTH - PAD * 2),
        y: maxY === minY ? HEIGHT / 2 : PAD + ((node.position.y - minY) / (maxY - minY)) * (HEIGHT - PAD * 2),
      },
    ]),
  );

  return (
    <svg
      aria-hidden="true"
      className={`${className} rounded-md border border-slate-400/10 bg-slate-950/60`}
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      xmlns="http://www.w3.org/2000/svg"
    >
```

(the rest of the JSX body — edges then nodes — is unchanged.)

Run: `npm test -- src/features/maps/map-template-thumbnail.test.tsx` → PASS.

- [ ] **Step 3: Write the failing card tests**

Create `src/features/maps/map-card.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { MindMap, MindMapPreview } from "./maps.queries";
import { formatRelativeTime, MapCard } from "./map-card";

const map: MindMap = {
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
};

const preview: MindMapPreview = {
  nodes: [
    { id: "a", position: { x: 0, y: 0 }, nodeType: "idea" },
    { id: "b", position: { x: 10, y: 10 }, nodeType: "risk" },
  ],
  edges: [{ id: "a-b", sourceNodeId: "a", targetNodeId: "b" }],
};

function renderCard(overrides: Partial<React.ComponentProps<typeof MapCard>> = {}) {
  const props = {
    map,
    preview,
    isRenaming: false,
    onOpen: vi.fn(),
    onStartRename: vi.fn(),
    onRename: vi.fn(),
    onCancelRename: vi.fn(),
    onDuplicate: vi.fn(),
    onArchive: vi.fn(),
    ...overrides,
  };
  render(<MapCard {...props} />);
  return props;
}

describe("MapCard", () => {
  it("shows the title, node count and a thumbnail", () => {
    renderCard();
    expect(screen.getByRole("button", { name: "Feature plan" })).toBeTruthy();
    expect(screen.getByText(/2 nodes/)).toBeTruthy();
    expect(document.querySelectorAll("[data-thumbnail-node]")).toHaveLength(2);
  });

  it("opens the map from the title and the thumbnail", async () => {
    const user = userEvent.setup();
    const props = renderCard();
    await user.click(screen.getByRole("button", { name: "Feature plan" }));
    await user.click(screen.getByRole("button", { name: "Open Feature plan" }));
    expect(props.onOpen).toHaveBeenCalledTimes(2);
  });

  it("offers rename, duplicate and archive from the menu", async () => {
    const user = userEvent.setup();
    const props = renderCard();
    await user.click(screen.getByRole("button", { name: "Map actions for Feature plan" }));
    expect(screen.getByRole("menu")).toBeTruthy();
    await user.click(screen.getByRole("menuitem", { name: "Archive" }));
    expect(props.onArchive).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("menu")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Map actions for Feature plan" }));
    await user.click(screen.getByRole("menuitem", { name: "Duplicate" }));
    expect(props.onDuplicate).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: "Map actions for Feature plan" }));
    await user.click(screen.getByRole("menuitem", { name: "Rename" }));
    expect(props.onStartRename).toHaveBeenCalledTimes(1);
  });

  it("commits a rename on Enter and reverts on Escape", async () => {
    const user = userEvent.setup();
    const props = renderCard({ isRenaming: true });
    const input = screen.getByRole("textbox", { name: "Map title" });
    await user.clear(input);
    await user.type(input, "Launch plan{Enter}");
    expect(props.onRename).toHaveBeenCalledWith("Launch plan");

    await user.type(input, "{Escape}");
    expect(props.onCancelRename).toHaveBeenCalled();
  });

  it("cancels an unchanged or blank rename", async () => {
    const user = userEvent.setup();
    const props = renderCard({ isRenaming: true });
    await user.type(screen.getByRole("textbox", { name: "Map title" }), "{Enter}");
    expect(props.onRename).not.toHaveBeenCalled();
    expect(props.onCancelRename).toHaveBeenCalled();
  });
});

describe("formatRelativeTime", () => {
  const now = Date.parse("2026-09-01T12:00:00.000Z");
  it("formats minutes, hours and days", () => {
    expect(formatRelativeTime("2026-09-01T11:59:40.000Z", now)).toBe("just now");
    expect(formatRelativeTime("2026-09-01T11:30:00.000Z", now)).toBe("30m ago");
    expect(formatRelativeTime("2026-09-01T09:00:00.000Z", now)).toBe("3h ago");
    expect(formatRelativeTime("2026-08-29T12:00:00.000Z", now)).toBe("3d ago");
  });
});
```

- [ ] **Step 4: Implement `MapCard`**

Create `src/features/maps/map-card.tsx`:

```tsx
import { MoreHorizontal } from "lucide-react";
import { memo, useEffect, useRef, useState } from "react";
import type { MindMap, MindMapPreview } from "./maps.queries";
import { TemplateThumbnail } from "./map-template-thumbnail";

export function formatRelativeTime(iso: string, now = Date.now()): string {
  const minutes = Math.round((now - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

type MapCardProps = {
  map: MindMap;
  preview?: MindMapPreview;
  isRenaming: boolean;
  onOpen: () => void;
  onStartRename: () => void;
  onRename: (title: string) => void;
  onCancelRename: () => void;
  onDuplicate: () => void;
  onArchive: () => void;
};

export const MapCard = memo(function MapCard({
  map,
  preview,
  isRenaming,
  onOpen,
  onStartRename,
  onRename,
  onCancelRename,
  onDuplicate,
  onArchive,
}: MapCardProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [draft, setDraft] = useState(map.title);
  const menuRef = useRef<HTMLDivElement>(null);
  const settledRef = useRef(false);

  useEffect(() => {
    if (isRenaming) {
      setDraft(map.title);
      settledRef.current = false;
    }
  }, [isRenaming, map.title]);

  useEffect(() => {
    if (!isMenuOpen) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setIsMenuOpen(false);
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [isMenuOpen]);

  function commitRename() {
    if (settledRef.current) return;
    settledRef.current = true;
    const trimmed = draft.trim();
    if (!trimmed || trimmed === map.title) onCancelRename();
    else onRename(trimmed);
  }

  function cancelRename() {
    if (settledRef.current) return;
    settledRef.current = true;
    onCancelRename();
  }

  const nodeCount = preview?.nodes.length;
  const countLabel = nodeCount === undefined ? "…" : `${nodeCount} ${nodeCount === 1 ? "node" : "nodes"}`;

  return (
    <article className="map-card surface-primary relative grid gap-3 rounded-xl p-3" data-testid={`map-card-${map.id}`}>
      <button aria-label={`Open ${map.title}`} className="map-card-open rounded-md" onClick={onOpen} type="button">
        {preview ? (
          <TemplateThumbnail edges={preview.edges} nodes={preview.nodes} size="md" />
        ) : (
          <span aria-hidden="true" className="map-card-thumbnail-placeholder block aspect-[16/9] w-full rounded-md" />
        )}
      </button>

      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          {isRenaming ? (
            <input
              aria-label="Map title"
              autoFocus
              className="orbit-input w-full px-2 py-1 text-sm"
              onBlur={commitRename}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  commitRename();
                }
                if (event.key === "Escape") {
                  event.preventDefault();
                  cancelRename();
                }
              }}
              value={draft}
            />
          ) : (
            <button
              className="block max-w-full truncate text-left text-sm font-semibold text-white transition hover:text-cyan-100"
              onClick={onOpen}
              type="button"
            >
              {map.title}
            </button>
          )}
          <p className="mt-0.5 text-xs text-slate-400">
            {countLabel} · Updated {formatRelativeTime(map.updated_at)}
          </p>
        </div>

        <div className="relative shrink-0" onKeyDown={(event) => event.key === "Escape" && setIsMenuOpen(false)} ref={menuRef}>
          <button
            aria-expanded={isMenuOpen}
            aria-haspopup="menu"
            aria-label={`Map actions for ${map.title}`}
            className="grid h-7 w-7 place-items-center rounded-md text-slate-500 transition hover:bg-white/5 hover:text-slate-200"
            onClick={() => setIsMenuOpen((current) => !current)}
            type="button"
          >
            <MoreHorizontal aria-hidden="true" className="h-4 w-4" />
          </button>
          {isMenuOpen ? (
            <div className="surface-raised absolute right-0 top-8 z-20 grid w-36 gap-0.5 rounded-lg border border-slate-400/15 p-1" role="menu">
              {[
                ["Rename", onStartRename],
                ["Duplicate", onDuplicate],
                ["Archive", onArchive],
              ].map(([label, action]) => (
                <button
                  className="map-card-menu-item"
                  key={label as string}
                  onClick={() => {
                    setIsMenuOpen(false);
                    (action as () => void)();
                  }}
                  role="menuitem"
                  type="button"
                >
                  {label as string}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </article>
  );
});
```

- [ ] **Step 5: Add the styles**

In `src/styles.css`, directly after the `.map-template-card:disabled { … }` block (inside the same `@layer components`), add:

```css
  .map-card {
    transition:
      border-color 160ms ease,
      transform 160ms ease;
  }

  .map-card:hover {
    border-color: rgba(103, 232, 249, 0.22);
  }

  .map-card-open:focus-visible {
    outline: 2px solid #67e8f9;
    outline-offset: 2px;
  }

  .map-card-thumbnail-placeholder {
    background:
      radial-gradient(circle at 50% 50%, rgba(103, 232, 249, 0.08), transparent 60%),
      rgba(2, 8, 23, 0.6);
    border: 1px solid rgba(148, 163, 184, 0.1);
  }

  .map-card-menu-item {
    border-radius: 0.375rem;
    padding: 0.375rem 0.5rem;
    text-align: left;
    font-size: 0.75rem;
    font-weight: 500;
    color: #e2e8f0;
  }

  .map-card-menu-item:hover,
  .map-card-menu-item:focus-visible {
    background: rgba(255, 255, 255, 0.05);
    outline: none;
  }
```

- [ ] **Step 6: Run the tests**

Run: `npm test -- src/features/maps/map-card.test.tsx src/features/maps/map-template-thumbnail.test.tsx`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/features/maps/map-template-thumbnail.tsx src/features/maps/map-template-thumbnail.test.tsx src/features/maps/map-card.tsx src/features/maps/map-card.test.tsx src/styles.css
git commit -m "feat(maps): library MapCard with live thumbnail, menu and inline rename"
```

---

### Task 5: Canvas — selection model, edge editing, keyboard, imperative handle

**Files:**
- Rewrite: `src/features/maps/map-canvas.tsx`
- Modify: `src/features/maps/map-layouts.ts` (delete `applyViewLayout`)
- Modify: `src/styles.css` (selected edge)
- Rewrite: `src/features/maps/map-canvas.test.tsx`

**Interfaces:**
- Consumes: `MapSelection`, `SetGraphOptions` (Task 3); `createNodeAt`, `createConnectedNode`, `createSiblingNode`, `deleteNode`, `deleteEdge`, `nodeAccentColor`, `nodeShape` (Tasks 2 and existing).
- Produces:

```ts
export type MapCanvasHandle = { fitView: () => void; viewportCenter: () => { x: number; y: number } };
export type MapCanvasProps = {
  graph: EditableMapGraph;
  selection: MapSelection;
  renamingNodeId: string | null;
  className?: string;
  onChange: (graph: EditableMapGraph, options?: SetGraphOptions) => void;
  onSelect: (selection: MapSelection) => void;
  onRenamingChange: (nodeId: string | null) => void;
};
export const MapCanvas: ForwardRefExoticComponent<MapCanvasProps & RefAttributes<MapCanvasHandle>>;
```

- Behaviour: node click selects node; edge click selects edge; pane click clears; double-click on empty pane creates a node at that point, selects it and starts rename; node double-click or **F2** renames; **Tab** child, **Enter** sibling; **Delete/Backspace** removes the selected node (with its edges) or edge; **Escape** clears selection and rename. Drag frames call `onChange(next, { undoable: false })`; the final position change (`dragging === false`) calls `onChange(next, { undoable: true })`. Directional edges get `markerEnd: { type: MarkerType.ArrowClosed, color: "#67e8f9" }`. React Flow's own delete key is disabled (`deleteKeyCode={null}`).

- [ ] **Step 1: Rewrite the canvas test**

Replace `src/features/maps/map-canvas.test.tsx` with:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
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
          <button
            className={edge.className}
            data-marker={edge.markerEnd ? "arrow" : "none"}
            data-selected={edge.selected}
            data-testid={`mock-edge-${edge.id}`}
            key={edge.id}
            onClick={() => props.onEdgeClick?.({}, { id: edge.id })}
            type="button"
          >
            {edge.source} to {edge.target}
          </button>
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

function renderCanvas(overrides: Partial<React.ComponentProps<typeof MapCanvas>> = {}) {
  const props = {
    graph,
    selection: null,
    renamingNodeId: null,
    onChange: vi.fn(),
    onSelect: vi.fn(),
    onRenamingChange: vi.fn(),
    ...overrides,
  };
  const ref = createRef<MapCanvasHandle>();
  const view = render(<MapCanvas ref={ref} {...props} />);
  return { ...view, props, ref };
}

describe("MapCanvas", () => {
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
```

The double-click position assertion relies on the mocked `screenToFlowPosition`, which adds 1000 to each axis; user-event dispatches the double-click at (0, 0).

- [ ] **Step 2: Run to see failures**

Run: `npm test -- src/features/maps/map-canvas.test.tsx`
Expected: FAIL (props mismatch, `MapCanvasHandle` not exported).

- [ ] **Step 3: Rewrite `map-canvas.tsx`**

```tsx
import {
  addEdge,
  applyEdgeChanges,
  Background,
  BackgroundVariant,
  Controls,
  MarkerType,
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
import "@xyflow/react/dist/style.css";
import { clsx } from "clsx";
import {
  forwardRef,
  memo,
  useCallback,
  useImperativeHandle,
  useMemo,
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";
import {
  createConnectedNode,
  createNodeAt,
  createSiblingNode,
  deleteEdge,
  deleteNode,
  nodeAccentColor,
  nodeShape,
} from "./map-graph-ops";
import { StarNode, type StarNodeData } from "./map-star-node";
import { StarlightEdge } from "./map-starlight-edge";
import type { EditableMapEdge, EditableMapGraph, EditableMapNode } from "./map-types";
import type { MapSelection, SetGraphOptions } from "./use-map-editor";

export type MapCanvasHandle = {
  fitView: () => void;
  viewportCenter: () => { x: number; y: number };
};

export type MapCanvasProps = {
  graph: EditableMapGraph;
  selection: MapSelection;
  renamingNodeId: string | null;
  className?: string;
  onChange: (graph: EditableMapGraph, options?: SetGraphOptions) => void;
  onSelect: (selection: MapSelection) => void;
  onRenamingChange: (nodeId: string | null) => void;
};

const nodeTypes = { star: StarNode };
const edgeTypes = { starlight: StarlightEdge };
const fitViewOptions = { padding: 0.32, minZoom: 0.55, maxZoom: 1.15 };
const proOptions = { hideAttribution: true };
const arrowMarker = { type: MarkerType.ArrowClosed, color: "#67e8f9", width: 18, height: 18 };
const editableTags = new Set(["INPUT", "TEXTAREA", "SELECT"]);

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
      shape: nodeShape(node.nodeType),
      isConverted: node.status === "converted",
      isRenaming: node.id === renamingNodeId,
      onRenameCommit: (title: string) => onRenameCommit(node.id, title),
      onRenameCancel,
    },
    selected: node.id === selectedNodeId,
    className: clsx("orbit-map-node", node.id === selectedNodeId && "orbit-map-node-selected"),
  };
}

function toFlowEdge(edge: EditableMapEdge, selectedEdgeId: string | null): Edge {
  return {
    id: edge.id,
    source: edge.sourceNodeId,
    target: edge.targetNodeId,
    label: edge.label || undefined,
    animated: false,
    type: "starlight",
    selected: edge.id === selectedEdgeId,
    markerEnd: edge.isDirectional ? arrowMarker : undefined,
    className: clsx(
      edge.edgeType === "sequence" ? "orbit-map-edge-sequence" : "orbit-map-edge",
      edge.id === selectedEdgeId && "orbit-map-edge-selected",
    ),
  };
}

function createEdgeId(source: string, target: string, existingIds: Set<string>, preferredId?: string | null) {
  const baseId = preferredId || `${source}-${target}`;
  if (!existingIds.has(baseId)) return baseId;
  let index = 2;
  let nextId = `${baseId}-${index}`;
  while (existingIds.has(nextId)) {
    index += 1;
    nextId = `${baseId}-${index}`;
  }
  return nextId;
}

function createRandomEdgeId(existingIds: Set<string>) {
  let edgeId = crypto.randomUUID();
  while (existingIds.has(edgeId)) edgeId = crypto.randomUUID();
  return edgeId;
}

function toGraphEdges(flowEdges: Edge[], graphEdges: EditableMapEdge[]) {
  const usedIds = new Set<string>();
  const graphEdgesById = new Map(graphEdges.map((edge) => [edge.id, edge]));

  return flowEdges.reduce<EditableMapEdge[]>((nextEdges, flowEdge) => {
    if (!flowEdge.source || !flowEdge.target) return nextEdges;
    const existingEdge = graphEdgesById.get(flowEdge.id);
    const id = createEdgeId(flowEdge.source, flowEdge.target, usedIds, flowEdge.id);
    usedIds.add(id);
    nextEdges.push({
      id,
      sourceNodeId: flowEdge.source,
      targetNodeId: flowEdge.target,
      edgeType: existingEdge?.edgeType ?? "association",
      label: existingEdge?.label ?? "",
      isDirectional: existingEdge?.isDirectional ?? false,
    });
    return nextEdges;
  }, []);
}

const MapCanvasInner = forwardRef<MapCanvasHandle, MapCanvasProps>(function MapCanvasInner(
  { graph, selection, renamingNodeId, className, onChange, onSelect, onRenamingChange },
  ref,
) {
  const { screenToFlowPosition, fitView } = useReactFlow();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const selectedNodeId = selection?.kind === "node" ? selection.id : null;
  const selectedEdgeId = selection?.kind === "edge" ? selection.id : null;

  useImperativeHandle(
    ref,
    () => ({
      fitView: () => {
        void fitView(fitViewOptions);
      },
      viewportCenter: () => {
        const rect = wrapperRef.current?.getBoundingClientRect();
        if (!rect) return { x: 0, y: 0 };
        return screenToFlowPosition({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
      },
    }),
    [fitView, screenToFlowPosition],
  );

  const handleRenameCommit = useCallback(
    (nodeId: string, title: string) => {
      onRenamingChange(null);
      onChange({ ...graph, nodes: graph.nodes.map((node) => (node.id === nodeId ? { ...node, title } : node)) }, {
        coalesceKey: `node:${nodeId}:title`,
      });
    },
    [graph, onChange, onRenamingChange],
  );
  const handleRenameCancel = useCallback(() => onRenamingChange(null), [onRenamingChange]);

  const nodes = useMemo(
    () => graph.nodes.map((node) => toFlowNode(node, selectedNodeId, renamingNodeId, handleRenameCommit, handleRenameCancel)),
    [graph.nodes, selectedNodeId, renamingNodeId, handleRenameCommit, handleRenameCancel],
  );
  const edges = useMemo(() => graph.edges.map((edge) => toFlowEdge(edge, selectedEdgeId)), [graph.edges, selectedEdgeId]);

  const handleCanvasDoubleClick = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      if ((event.target as HTMLElement).closest(".react-flow__node")) return;
      const id = crypto.randomUUID();
      const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      onChange(createNodeAt(graph, position, id));
      onSelect({ kind: "node", id });
      onRenamingChange(id);
    },
    [graph, onChange, onRenamingChange, onSelect, screenToFlowPosition],
  );

  const handleNodeDoubleClick = useCallback((_: unknown, node: Node) => onRenamingChange(node.id), [onRenamingChange]);

  const handleCanvasKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      const target = event.target as HTMLElement;
      if (editableTags.has(target.tagName) || target.isContentEditable) return;

      if (event.key === "Escape") {
        onSelect(null);
        onRenamingChange(null);
        return;
      }

      if ((event.key === "Delete" || event.key === "Backspace") && selection) {
        event.preventDefault();
        onChange(selection.kind === "node" ? deleteNode(graph, selection.id) : deleteEdge(graph, selection.id));
        onSelect(null);
        return;
      }

      if (!selectedNodeId) return;

      if (event.key === "F2") {
        event.preventDefault();
        onRenamingChange(selectedNodeId);
        return;
      }

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
      onSelect({ kind: "node", id: nodeId });
      onRenamingChange(nodeId);
    },
    [graph, onChange, onRenamingChange, onSelect, selectedNodeId, selection],
  );

  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      const movedPositions = new Map<string, { x: number; y: number }>();
      const removedNodeIds = new Set<string>();
      let dragging = false;

      changes.forEach((change) => {
        if (change.type === "position" && change.position) {
          movedPositions.set(change.id, change.position);
          if (change.dragging) dragging = true;
        }
        if (change.type === "remove") removedNodeIds.add(change.id);
      });

      if (movedPositions.size === 0 && removedNodeIds.size === 0) return;

      onChange(
        {
          ...graph,
          nodes: graph.nodes
            .filter((node) => !removedNodeIds.has(node.id))
            .map((node) => {
              const position = movedPositions.get(node.id);
              return position ? { ...node, position } : node;
            }),
          edges: graph.edges.filter((edge) => !removedNodeIds.has(edge.sourceNodeId) && !removedNodeIds.has(edge.targetNodeId)),
        },
        { undoable: !dragging },
      );
    },
    [graph, onChange],
  );

  const handleEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      const relevant = changes.filter((change) => change.type === "remove" || change.type === "replace");
      if (relevant.length === 0) return;
      onChange({ ...graph, edges: toGraphEdges(applyEdgeChanges(changes, edges), graph.edges) });
    },
    [edges, graph, onChange],
  );

  const handleConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target || connection.source === connection.target) return;
      const edgeId = createRandomEdgeId(new Set(graph.edges.map((edge) => edge.id)));
      onChange({ ...graph, edges: toGraphEdges(addEdge({ ...connection, id: edgeId }, edges), graph.edges) });
    },
    [edges, graph, onChange],
  );

  const handleNodeClick = useCallback((_: unknown, node: Node) => onSelect({ kind: "node", id: node.id }), [onSelect]);
  const handleEdgeClick = useCallback((_: unknown, edge: Edge) => onSelect({ kind: "edge", id: edge.id }), [onSelect]);
  const handlePaneClick = useCallback(() => onSelect(null), [onSelect]);

  return (
    <div
      aria-label="Visual planning canvas"
      className={clsx("orbit-constellation-canvas overflow-hidden rounded-lg border border-white/10", className ?? "h-[max(28rem,calc(100vh-9.5rem))]")}
      data-testid="map-canvas"
      onDoubleClick={handleCanvasDoubleClick}
      onKeyDown={handleCanvasKeyDown}
      ref={wrapperRef}
      role="application"
      tabIndex={0}
    >
      <ReactFlow
        className="orbit-constellation-flow"
        deleteKeyCode={null}
        edgeTypes={edgeTypes}
        edges={edges}
        fitView
        fitViewOptions={fitViewOptions}
        nodes={nodes}
        nodeTypes={nodeTypes}
        onConnect={handleConnect}
        onEdgeClick={handleEdgeClick}
        onEdgesChange={handleEdgesChange}
        onNodeClick={handleNodeClick}
        onNodeDoubleClick={handleNodeDoubleClick}
        onNodesChange={handleNodesChange}
        onPaneClick={handlePaneClick}
        proOptions={proOptions}
        zoomOnDoubleClick={false}
      >
        <Background color="rgba(148, 163, 184, 0.18)" gap={32} size={1} variant={BackgroundVariant.Dots} />
        <MiniMap bgColor="var(--orbit-surface-quiet)" maskColor="rgba(2, 8, 23, 0.72)" nodeColor="#67e8f9" pannable />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
});

export const MapCanvas = memo(
  forwardRef<MapCanvasHandle, MapCanvasProps>(function MapCanvas(props, ref) {
    return (
      <ReactFlowProvider>
        <MapCanvasInner {...props} ref={ref} />
      </ReactFlowProvider>
    );
  }),
);
```

Then delete `applyViewLayout` from `src/features/maps/map-layouts.ts` (it has no remaining callers). Add to `src/styles.css`, after `.orbit-map-edge-sequence .react-flow__edge-path { … }`:

```css
.orbit-map-edge-selected .react-flow__edge-path {
  stroke: #67e8f9;
  stroke-width: 2;
  filter: drop-shadow(0 0 6px rgba(103, 232, 249, 0.7));
}
```

- [ ] **Step 4: Run the canvas tests and the whole maps folder**

Run: `npm test -- src/features/maps/map-canvas.test.tsx`
Expected: PASS. Then run `npm test -- src/features/maps` — `maps-page.test.tsx` will now fail because `MapCanvas` props changed; that file is deleted in Task 11, so ignore its failures until then and confirm every other file in the folder passes.

- [ ] **Step 5: Commit**

```bash
git add src/features/maps/map-canvas.tsx src/features/maps/map-canvas.test.tsx src/features/maps/map-layouts.ts src/styles.css
git commit -m "feat(maps): canvas selection model, edge editing, keyboard, imperative handle"
```

---
### Task 6: Inspector — node, edge and map modes

**Files:**
- Rewrite: `src/features/maps/map-inspector.tsx`
- Rewrite: `src/features/maps/map-inspector.test.tsx`

**Interfaces:**
- Consumes: `updateNode`, `deleteNode`, `updateEdge`, `deleteEdge`, `nodeAccentColor` (Task 2 / existing); label helpers (Task 2); `MapSelection`, `SetGraphOptions` (Task 3); `workspacePath` from `src/features/workspaces/workspace-path.ts`; `Field` from `src/components/field.tsx`; `InlineAlert` from `src/components/inline-alert.tsx`.
- Produces:

```ts
export type MapInspectorProps = {
  graph: EditableMapGraph;
  selection: MapSelection;
  workspaceId: string;
  projectId: string | null;
  isConverting: boolean;
  conversionError: string | null;
  onGraphChange: (graph: EditableMapGraph, options?: SetGraphOptions) => void;
  onSelect: (selection: MapSelection) => void;
  onConvert: (type: ConvertedObjectType) => void;
};
export function convertedHref(workspaceId: string, projectId: string | null, node: EditableMapNode): string | null;
export const MapInspector: React.MemoExoticComponent<(props: MapInspectorProps) => JSX.Element>;
```

- Text-field edits pass `coalesceKey` (`node:<id>:title`, `node:<id>:body`, `edge:<id>:label`, `map:title`, `map:description`) so typing collapses into one undo entry.
- Conversion buttons are labelled **Task**, **Note**, **Milestone** under a "Convert to" heading. On a global map, Task and Milestone are disabled with the reason `Choose a project map to convert to a task or milestone.`

- [ ] **Step 1: Rewrite the inspector test**

Replace `src/features/maps/map-inspector.test.tsx` with:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { convertedHref, MapInspector, type MapInspectorProps } from "./map-inspector";
import type { EditableMapGraph, EditableMapNode } from "./map-types";

function node(id: string, extra: Partial<EditableMapNode> = {}): EditableMapNode {
  return { id, title: id, body: "", nodeType: "idea", status: "open", position: { x: 0, y: 0 }, accent: "cyan", tags: [], ...extra };
}

const graph: EditableMapGraph = {
  title: "Feature plan",
  description: "",
  defaultView: "mind_map",
  nodes: [node("root", { title: "Root", tags: ["alpha"] }), node("child", { title: "Child" })],
  edges: [{ id: "root-child", sourceNodeId: "root", targetNodeId: "child", edgeType: "association", label: "", isDirectional: false }],
};

function renderInspector(overrides: Partial<MapInspectorProps> = {}) {
  const props = {
    graph,
    selection: { kind: "node", id: "root" } as MapInspectorProps["selection"],
    workspaceId: "ws-1",
    projectId: "p-1" as string | null,
    isConverting: false,
    conversionError: null as string | null,
    onGraphChange: vi.fn(),
    onSelect: vi.fn(),
    onConvert: vi.fn(),
    ...overrides,
  };
  render(
    <MemoryRouter>
      <MapInspector {...(props as MapInspectorProps)} />
    </MemoryRouter>,
  );
  return props;
}

describe("MapInspector", () => {
  it("edits the map title and description when nothing is selected", async () => {
    const user = userEvent.setup();
    const props = renderInspector({ selection: null });

    await user.type(screen.getByRole("textbox", { name: "Title" }), "!");

    const [next, options] = props.onGraphChange.mock.calls[0];
    expect(next.title).toBe("Feature plan!");
    expect(options).toEqual({ coalesceKey: "map:title" });
    expect(screen.getByText("Select a node or connection to edit it.")).toBeTruthy();
  });

  it("changes a node's type and accent", async () => {
    const user = userEvent.setup();
    const props = renderInspector();

    await user.selectOptions(screen.getByRole("combobox", { name: "Type" }), "risk");

    const next = props.onGraphChange.mock.calls[0][0] as EditableMapGraph;
    expect(next.nodes[0]).toMatchObject({ nodeType: "risk", accent: "violet" });
  });

  it("changes a node's status and dates", async () => {
    const user = userEvent.setup();
    const props = renderInspector();

    await user.selectOptions(screen.getByRole("combobox", { name: "Status" }), "selected");
    expect((props.onGraphChange.mock.calls[0][0] as EditableMapGraph).nodes[0].status).toBe("selected");

    await user.type(screen.getByLabelText("Due date"), "2026-10-01");
    const last = props.onGraphChange.mock.calls.at(-1)?.[0] as EditableMapGraph;
    expect(last.nodes[0].dueDate).toBe("2026-10-01");
  });

  it("adds tags with Enter or a comma and removes them", async () => {
    const user = userEvent.setup();
    const props = renderInspector();

    await user.type(screen.getByRole("textbox", { name: "Add tag" }), "beta{Enter}");
    expect((props.onGraphChange.mock.calls[0][0] as EditableMapGraph).nodes[0].tags).toEqual(["alpha", "beta"]);

    await user.type(screen.getByRole("textbox", { name: "Add tag" }), "gamma,");
    expect((props.onGraphChange.mock.calls[1][0] as EditableMapGraph).nodes[0].tags).toEqual(["alpha", "gamma"]);

    await user.click(screen.getByRole("button", { name: "Remove tag alpha" }));
    expect((props.onGraphChange.mock.calls[2][0] as EditableMapGraph).nodes[0].tags).toEqual([]);
  });

  it("converts through the three buttons on a project map", async () => {
    const user = userEvent.setup();
    const props = renderInspector();

    await user.click(screen.getByRole("button", { name: "Task" }));
    await user.click(screen.getByRole("button", { name: "Note" }));
    await user.click(screen.getByRole("button", { name: "Milestone" }));

    expect(props.onConvert.mock.calls.map(([type]) => type)).toEqual(["task", "note", "milestone"]);
  });

  it("disables task and milestone conversion on a global map", () => {
    renderInspector({ projectId: null });

    expect(screen.getByRole("button", { name: "Task" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Milestone" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Note" })).not.toBeDisabled();
    expect(screen.getByText("Choose a project map to convert to a task or milestone.")).toBeTruthy();
  });

  it("shows the converted state with an Open link and the error when conversion fails", () => {
    const converted = {
      ...graph,
      nodes: [node("root", { status: "converted", convertedType: "task", convertedId: "t-1", convertedAt: "now" }), node("child")],
    };
    renderInspector({ graph: converted, conversionError: "boom" });

    expect(screen.getByText(/Converted to task/)).toBeTruthy();
    expect(screen.getByRole("link", { name: /Open/ })).toHaveAttribute("href", "/w/ws-1/projects/p-1?task=t-1");
    expect(screen.queryByRole("button", { name: "Task" })).toBeNull();
    expect(screen.getByText("boom")).toBeTruthy();
  });

  it("deletes the node and clears the selection", async () => {
    const user = userEvent.setup();
    const props = renderInspector();

    await user.click(screen.getByRole("button", { name: "Delete node" }));

    const next = props.onGraphChange.mock.calls[0][0] as EditableMapGraph;
    expect(next.nodes.map((item) => item.id)).toEqual(["child"]);
    expect(next.edges).toEqual([]);
    expect(props.onSelect).toHaveBeenCalledWith(null);
  });

  it("edits and deletes a connection", async () => {
    const user = userEvent.setup();
    const props = renderInspector({ selection: { kind: "edge", id: "root-child" } });

    expect(screen.getByText("Root → Child")).toBeTruthy();
    await user.selectOptions(screen.getByRole("combobox", { name: "Type" }), "dependency");
    expect((props.onGraphChange.mock.calls[0][0] as EditableMapGraph).edges[0].edgeType).toBe("dependency");

    await user.click(screen.getByRole("switch", { name: "Directional" }));
    expect((props.onGraphChange.mock.calls[1][0] as EditableMapGraph).edges[0].isDirectional).toBe(true);

    await user.type(screen.getByRole("textbox", { name: "Label" }), "x");
    expect(props.onGraphChange.mock.calls[2][1]).toEqual({ coalesceKey: "edge:root-child:label" });

    await user.click(screen.getByRole("button", { name: "Delete connection" }));
    expect((props.onGraphChange.mock.calls[3][0] as EditableMapGraph).edges).toEqual([]);
    expect(props.onSelect).toHaveBeenCalledWith(null);
  });
});

describe("convertedHref", () => {
  it("links each converted type to its page", () => {
    expect(convertedHref("ws", "p", node("n", { convertedType: "task", convertedId: "t" }))).toBe("/w/ws/projects/p?task=t");
    expect(convertedHref("ws", null, node("n", { convertedType: "task", convertedId: "t" }))).toBeNull();
    expect(convertedHref("ws", null, node("n", { convertedType: "note", convertedId: "x" }))).toBe("/w/ws/notes?note=x");
    expect(convertedHref("ws", null, node("n", { convertedType: "milestone", convertedId: "m" }))).toBe("/w/ws/milestones/m");
    expect(convertedHref("ws", null, node("n"))).toBeNull();
  });
});
```

- [ ] **Step 2: Run to see it fail**

Run: `npm test -- src/features/maps/map-inspector.test.tsx`
Expected: FAIL (new props, `convertedHref` missing).

- [ ] **Step 3: Rewrite `map-inspector.tsx`**

```tsx
import { ArrowUpRight, Trash2, X } from "lucide-react";
import { memo, useState } from "react";
import { Link } from "react-router-dom";
import { Field } from "../../components/field";
import { InlineAlert } from "../../components/inline-alert";
import { workspacePath } from "../workspaces/workspace-path";
import { deleteEdge, deleteNode, nodeAccentColor, updateEdge, updateNode } from "./map-graph-ops";
import {
  mapEdgeTypeLabel,
  mapEdgeTypes,
  mapNodeStatusLabel,
  mapNodeStatuses,
  mapNodeTypeLabel,
  mapNodeTypes,
  type ConvertedObjectType,
  type EditableMapEdge,
  type EditableMapGraph,
  type EditableMapNode,
} from "./map-types";
import type { MapSelection, SetGraphOptions } from "./use-map-editor";

export type MapInspectorProps = {
  graph: EditableMapGraph;
  selection: MapSelection;
  workspaceId: string;
  projectId: string | null;
  isConverting: boolean;
  conversionError: string | null;
  onGraphChange: (graph: EditableMapGraph, options?: SetGraphOptions) => void;
  onSelect: (selection: MapSelection) => void;
  onConvert: (type: ConvertedObjectType) => void;
};

const inputClass = "orbit-input w-full px-3 py-2 text-sm";
const eyebrowClass = "text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-slate-500";
const conversionOptions: Array<{ type: ConvertedObjectType; label: string }> = [
  { type: "task", label: "Task" },
  { type: "note", label: "Note" },
  { type: "milestone", label: "Milestone" },
];

export function convertedHref(workspaceId: string, projectId: string | null, node: EditableMapNode): string | null {
  if (!node.convertedType || !node.convertedId) return null;
  if (node.convertedType === "task") {
    return projectId ? workspacePath(workspaceId, `/projects/${projectId}?task=${node.convertedId}`) : null;
  }
  if (node.convertedType === "note") return workspacePath(workspaceId, `/notes?note=${node.convertedId}`);
  return workspacePath(workspaceId, `/milestones/${node.convertedId}`);
}

function Eyebrow({ label, title }: { label: string; title: string }) {
  return (
    <div>
      <p className={eyebrowClass}>{label}</p>
      <h2 className="mt-1 truncate text-base font-semibold text-white">{title}</h2>
    </div>
  );
}

type NodeInspectorProps = Omit<MapInspectorProps, "selection"> & { node: EditableMapNode };

function NodeInspector({
  graph,
  node,
  workspaceId,
  projectId,
  isConverting,
  conversionError,
  onGraphChange,
  onSelect,
  onConvert,
}: NodeInspectorProps) {
  const [tagDraft, setTagDraft] = useState("");
  const isConverted = Boolean(node.convertedId);
  const href = convertedHref(workspaceId, projectId, node);
  const needsProject = !projectId;

  function patch(fields: Partial<Omit<EditableMapNode, "id">>, coalesceKey?: string) {
    onGraphChange(updateNode(graph, node.id, fields), coalesceKey ? { coalesceKey: `node:${node.id}:${coalesceKey}` } : undefined);
  }

  function commitTag(raw: string) {
    const tag = raw.trim();
    setTagDraft("");
    if (!tag || node.tags.includes(tag)) return;
    patch({ tags: [...node.tags, tag] });
  }

  return (
    <div className="grid gap-4">
      <Eyebrow label="Node" title={node.title} />

      <Field label="Title">
        <input className={inputClass} onChange={(event) => patch({ title: event.target.value }, "title")} value={node.title} />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Type">
          <select
            className={inputClass}
            onChange={(event) => {
              const nodeType = event.target.value as EditableMapNode["nodeType"];
              patch({ nodeType, accent: nodeAccentColor(nodeType) });
            }}
            value={node.nodeType}
          >
            {mapNodeTypes.map((type) => (
              <option key={type} value={type}>
                {mapNodeTypeLabel(type)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Status">
          {isConverted ? (
            <p className="orbit-input px-3 py-2 text-sm text-slate-300">Converted</p>
          ) : (
            <select
              className={inputClass}
              onChange={(event) => patch({ status: event.target.value as EditableMapNode["status"] })}
              value={node.status}
            >
              {mapNodeStatuses
                .filter((status) => status !== "converted")
                .map((status) => (
                  <option key={status} value={status}>
                    {mapNodeStatusLabel(status)}
                  </option>
                ))}
            </select>
          )}
        </Field>
      </div>

      <Field label="Notes">
        <textarea className={`${inputClass} min-h-28`} onChange={(event) => patch({ body: event.target.value }, "body")} value={node.body} />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Start date">
          <input className={inputClass} onChange={(event) => patch({ startDate: event.target.value || null })} type="date" value={node.startDate ?? ""} />
        </Field>
        <Field label="Due date">
          <input className={inputClass} onChange={(event) => patch({ dueDate: event.target.value || null })} type="date" value={node.dueDate ?? ""} />
        </Field>
      </div>

      <div className="grid gap-1 text-sm">
        <span className="font-medium text-slate-200">Tags</span>
        {node.tags.length > 0 ? (
          <ul className="flex flex-wrap gap-1.5">
            {node.tags.map((tag) => (
              <li className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-xs text-slate-200" key={tag}>
                {tag}
                <button
                  aria-label={`Remove tag ${tag}`}
                  className="text-slate-400 hover:text-white"
                  onClick={() => patch({ tags: node.tags.filter((item) => item !== tag) })}
                  type="button"
                >
                  <X aria-hidden="true" className="h-3 w-3" />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        <input
          aria-label="Add tag"
          className={inputClass}
          onChange={(event) => {
            const value = event.target.value;
            if (value.endsWith(",")) commitTag(value.slice(0, -1));
            else setTagDraft(value);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              commitTag(tagDraft);
            }
          }}
          placeholder="Add a tag and press Enter"
          value={tagDraft}
        />
      </div>

      <section className="grid gap-2 border-t border-white/10 pt-4">
        <p className="text-sm font-medium text-slate-200">Convert to</p>
        {isConverted ? (
          <p className="text-sm text-slate-300">
            Converted to {node.convertedType ?? "workspace item"}.{" "}
            {href ? (
              <Link className="inline-flex items-center gap-1 font-semibold text-cyan-200 hover:text-cyan-100" to={href}>
                Open
                <ArrowUpRight aria-hidden="true" className="h-3.5 w-3.5" />
              </Link>
            ) : null}
          </p>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-2">
              {conversionOptions.map((option) => (
                <button
                  className="orbit-button-secondary justify-center px-2 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={isConverting || (needsProject && option.type !== "note")}
                  key={option.type}
                  onClick={() => onConvert(option.type)}
                  type="button"
                >
                  {option.label}
                </button>
              ))}
            </div>
            {needsProject ? <p className="text-xs text-amber-200">Choose a project map to convert to a task or milestone.</p> : null}
          </>
        )}
        {conversionError ? <InlineAlert tone="error">{conversionError}</InlineAlert> : null}
      </section>

      <button
        className="orbit-button-danger-quiet justify-center gap-1.5 text-xs"
        onClick={() => {
          onGraphChange(deleteNode(graph, node.id));
          onSelect(null);
        }}
        type="button"
      >
        <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
        Delete node
      </button>
    </div>
  );
}

type EdgeInspectorProps = Pick<MapInspectorProps, "graph" | "onGraphChange" | "onSelect"> & { edge: EditableMapEdge };

function EdgeInspector({ graph, edge, onGraphChange, onSelect }: EdgeInspectorProps) {
  const titleOf = (id: string) => graph.nodes.find((node) => node.id === id)?.title ?? "?";

  function patch(fields: Partial<Omit<EditableMapEdge, "id">>, coalesceKey?: string) {
    onGraphChange(updateEdge(graph, edge.id, fields), coalesceKey ? { coalesceKey: `edge:${edge.id}:${coalesceKey}` } : undefined);
  }

  return (
    <div className="grid gap-4">
      <Eyebrow label="Connection" title={`${titleOf(edge.sourceNodeId)} → ${titleOf(edge.targetNodeId)}`} />

      <Field label="Type">
        <select className={inputClass} onChange={(event) => patch({ edgeType: event.target.value as EditableMapEdge["edgeType"] })} value={edge.edgeType}>
          {mapEdgeTypes.map((type) => (
            <option key={type} value={type}>
              {mapEdgeTypeLabel(type)}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Label">
        <input className={inputClass} onChange={(event) => patch({ label: event.target.value }, "label")} value={edge.label} />
      </Field>

      <label className="flex items-center justify-between gap-3 text-sm">
        <span className="font-medium text-slate-200">Directional</span>
        <input
          aria-label="Directional"
          checked={edge.isDirectional}
          className="h-4 w-4 accent-cyan-300"
          onChange={(event) => patch({ isDirectional: event.target.checked })}
          role="switch"
          type="checkbox"
        />
      </label>

      <button
        className="orbit-button-danger-quiet justify-center gap-1.5 text-xs"
        onClick={() => {
          onGraphChange(deleteEdge(graph, edge.id));
          onSelect(null);
        }}
        type="button"
      >
        <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
        Delete connection
      </button>
    </div>
  );
}

function MapDetails({ graph, onGraphChange }: Pick<MapInspectorProps, "graph" | "onGraphChange">) {
  return (
    <div className="grid gap-4">
      <Eyebrow label="Map" title={graph.title} />
      <Field label="Title">
        <input className={inputClass} onChange={(event) => onGraphChange({ ...graph, title: event.target.value }, { coalesceKey: "map:title" })} value={graph.title} />
      </Field>
      <Field label="Description">
        <textarea
          className={`${inputClass} min-h-24`}
          onChange={(event) => onGraphChange({ ...graph, description: event.target.value }, { coalesceKey: "map:description" })}
          value={graph.description}
        />
      </Field>
      <p className="text-sm text-slate-400">Select a node or connection to edit it.</p>
    </div>
  );
}

export const MapInspector = memo(function MapInspector(props: MapInspectorProps) {
  const { graph, selection } = props;
  const node = selection?.kind === "node" ? (graph.nodes.find((item) => item.id === selection.id) ?? null) : null;
  const edge = selection?.kind === "edge" ? (graph.edges.find((item) => item.id === selection.id) ?? null) : null;

  if (node) return <NodeInspector {...props} node={node} />;
  if (edge) return <EdgeInspector edge={edge} graph={graph} onGraphChange={props.onGraphChange} onSelect={props.onSelect} />;
  return <MapDetails graph={graph} onGraphChange={props.onGraphChange} />;
});
```

- [ ] **Step 4: Run the inspector tests**

Run: `npm test -- src/features/maps/map-inspector.test.tsx`
Expected: PASS. If `getByLabelText("Due date")` cannot find the date input, `Field` renders a `<label>` wrapping the input so the label association is implicit — check the test's query uses the exact label text.

- [ ] **Step 5: Commit**

```bash
git add src/features/maps/map-inspector.tsx src/features/maps/map-inspector.test.tsx
git commit -m "feat(maps): inspector edits nodes, connections and map details"
```

---

### Task 7: Toolbar — Add node, Arrange, Fit, Undo/Redo, Details, save status

**Files:**
- Rewrite: `src/features/maps/map-toolbar.tsx`
- Rewrite: `src/features/maps/map-toolbar.test.tsx`
- Modify: `src/features/maps/map-types.ts` (remove `mapViews` and `mapViewLabel`)
- Modify: `src/styles.css` (save-status dot)

**Interfaces:**
- Consumes: `arrangeModes`, `arrangeModeLabel`, `ArrangeMode` (Task 2); `MapSaveStatus` (Task 3).
- Produces:

```ts
export type MapToolbarProps = {
  status: MapSaveStatus;
  error: string | null;
  canUndo: boolean;
  canRedo: boolean;
  isInspectorOpen: boolean;
  onAddNode: () => void;
  onArrange: (mode: ArrangeMode) => void;
  onFitView: () => void;
  onToggleInspector: () => void;
  onRetrySave: () => void;
  onUndo: () => void;
  onRedo: () => void;
};
export function MapSaveStatusIndicator(props: { status: MapSaveStatus; error: string | null; onRetry: () => void }): JSX.Element;
export function MapToolbar(props: MapToolbarProps): JSX.Element;
```

- Status copy: `saved` → "Saved", `dirty` and `saving` → "Saving…", `error` → "Couldn't save" plus a **Retry** button. The indicator is `aria-live="polite"`.

- [ ] **Step 1: Rewrite the toolbar test**

Replace `src/features/maps/map-toolbar.test.tsx` with:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MapToolbar, type MapToolbarProps } from "./map-toolbar";

function renderToolbar(overrides: Partial<MapToolbarProps> = {}) {
  const props: MapToolbarProps = {
    status: "saved",
    error: null,
    canUndo: true,
    canRedo: false,
    isInspectorOpen: false,
    onAddNode: vi.fn(),
    onArrange: vi.fn(),
    onFitView: vi.fn(),
    onToggleInspector: vi.fn(),
    onRetrySave: vi.fn(),
    onUndo: vi.fn(),
    onRedo: vi.fn(),
    ...overrides,
  };
  render(<MapToolbar {...props} />);
  return props;
}

describe("MapToolbar", () => {
  it("shows the save status and a retry action on error", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<MapToolbar {...renderToolbarProps()} status="saved" />);
    expect(screen.getByText("Saved")).toBeTruthy();

    rerender(<MapToolbar {...renderToolbarProps()} status="dirty" />);
    expect(screen.getByText("Saving…")).toBeTruthy();

    rerender(<MapToolbar {...renderToolbarProps()} status="saving" />);
    expect(screen.getByText("Saving…")).toBeTruthy();

    const onRetrySave = vi.fn();
    rerender(<MapToolbar {...renderToolbarProps()} error="offline" onRetrySave={onRetrySave} status="error" />);
    expect(screen.getByText("Couldn't save")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetrySave).toHaveBeenCalled();
  });

  it("wires the action buttons", async () => {
    const user = userEvent.setup();
    const props = renderToolbar();

    await user.click(screen.getByRole("button", { name: "Add node" }));
    await user.click(screen.getByRole("button", { name: "Fit view" }));
    await user.click(screen.getByRole("button", { name: "Details" }));
    await user.click(screen.getByRole("button", { name: "Undo" }));

    expect(props.onAddNode).toHaveBeenCalled();
    expect(props.onFitView).toHaveBeenCalled();
    expect(props.onToggleInspector).toHaveBeenCalled();
    expect(props.onUndo).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Redo" })).toBeDisabled();
  });

  it("marks Details pressed while the inspector is open", () => {
    renderToolbar({ isInspectorOpen: true });
    expect(screen.getByRole("button", { name: "Details" })).toHaveAttribute("aria-pressed", "true");
  });

  it("offers the four arrange modes from a menu", async () => {
    const user = userEvent.setup();
    const props = renderToolbar();

    await user.click(screen.getByRole("button", { name: "Arrange" }));
    expect(screen.getAllByRole("menuitem").map((item) => item.textContent)).toEqual(["Radial", "Left to right", "Top down", "By date"]);

    await user.click(screen.getByRole("menuitem", { name: "Top down" }));
    expect(props.onArrange).toHaveBeenCalledWith("top_down");
    expect(screen.queryByRole("menu")).toBeNull();
  });
});

function renderToolbarProps(): MapToolbarProps {
  return {
    status: "saved",
    error: null,
    canUndo: false,
    canRedo: false,
    isInspectorOpen: false,
    onAddNode: vi.fn(),
    onArrange: vi.fn(),
    onFitView: vi.fn(),
    onToggleInspector: vi.fn(),
    onRetrySave: vi.fn(),
    onUndo: vi.fn(),
    onRedo: vi.fn(),
  };
}
```

- [ ] **Step 2: Rewrite `map-toolbar.tsx`**

```tsx
import { clsx } from "clsx";
import { ChevronDown, GitBranch, LayoutGrid, Maximize2, PanelRight, Redo2, Undo2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { arrangeModeLabel, arrangeModes, type ArrangeMode } from "./map-layouts";
import type { MapSaveStatus } from "./use-map-editor";

export type MapToolbarProps = {
  status: MapSaveStatus;
  error: string | null;
  canUndo: boolean;
  canRedo: boolean;
  isInspectorOpen: boolean;
  onAddNode: () => void;
  onArrange: (mode: ArrangeMode) => void;
  onFitView: () => void;
  onToggleInspector: () => void;
  onRetrySave: () => void;
  onUndo: () => void;
  onRedo: () => void;
};

const statusCopy: Record<MapSaveStatus, string> = {
  saved: "Saved",
  dirty: "Saving…",
  saving: "Saving…",
  error: "Couldn't save",
};

const buttonClass = "orbit-button-tertiary gap-1.5 px-2.5 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-40";
const iconButtonClass = "orbit-button-tertiary h-8 w-8 justify-center px-0 disabled:cursor-not-allowed disabled:opacity-40";

export function MapSaveStatusIndicator({ status, error, onRetry }: { status: MapSaveStatus; error: string | null; onRetry: () => void }) {
  return (
    <div aria-live="polite" className="flex items-center gap-1.5 px-1 text-xs text-slate-400" data-status={status}>
      <span aria-hidden="true" className={clsx("map-save-dot", `map-save-dot-${status}`)} />
      <span title={status === "error" && error ? error : undefined}>{statusCopy[status]}</span>
      {status === "error" ? (
        <button className="font-semibold text-amber-200 transition hover:text-amber-100" onClick={onRetry} type="button">
          Retry
        </button>
      ) : null}
    </div>
  );
}

function ArrangeMenu({ onArrange }: { onArrange: (mode: ArrangeMode) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setIsOpen(false);
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [isOpen]);

  return (
    <div className="relative" onKeyDown={(event) => event.key === "Escape" && setIsOpen(false)} ref={menuRef}>
      <button aria-expanded={isOpen} aria-haspopup="menu" className={buttonClass} onClick={() => setIsOpen((current) => !current)} type="button">
        <LayoutGrid aria-hidden="true" className="h-3.5 w-3.5" />
        Arrange
        <ChevronDown aria-hidden="true" className="h-3 w-3" />
      </button>
      {isOpen ? (
        <div className="surface-raised absolute right-0 top-9 z-20 grid w-40 gap-0.5 rounded-lg border border-slate-400/15 p-1" role="menu">
          {arrangeModes.map((mode) => (
            <button
              className="map-card-menu-item"
              key={mode}
              onClick={() => {
                setIsOpen(false);
                onArrange(mode);
              }}
              role="menuitem"
              type="button"
            >
              {arrangeModeLabel(mode)}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function MapToolbar({
  status,
  error,
  canUndo,
  canRedo,
  isInspectorOpen,
  onAddNode,
  onArrange,
  onFitView,
  onToggleInspector,
  onRetrySave,
  onUndo,
  onRedo,
}: MapToolbarProps) {
  return (
    <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-1.5">
      <MapSaveStatusIndicator error={error} onRetry={onRetrySave} status={status} />
      <button aria-label="Undo" className={iconButtonClass} disabled={!canUndo} onClick={onUndo} title="Undo (Ctrl+Z)" type="button">
        <Undo2 aria-hidden="true" className="h-3.5 w-3.5" />
      </button>
      <button aria-label="Redo" className={iconButtonClass} disabled={!canRedo} onClick={onRedo} title="Redo (Ctrl+Shift+Z)" type="button">
        <Redo2 aria-hidden="true" className="h-3.5 w-3.5" />
      </button>
      <button className={buttonClass} onClick={onAddNode} type="button">
        <GitBranch aria-hidden="true" className="h-3.5 w-3.5" />
        Add node
      </button>
      <ArrangeMenu onArrange={onArrange} />
      <button aria-label="Fit view" className={iconButtonClass} onClick={onFitView} title="Fit view" type="button">
        <Maximize2 aria-hidden="true" className="h-3.5 w-3.5" />
      </button>
      <button aria-pressed={isInspectorOpen} className={buttonClass} onClick={onToggleInspector} type="button">
        <PanelRight aria-hidden="true" className="h-3.5 w-3.5" />
        Details
      </button>
    </div>
  );
}
```

Remove `mapViews` and `mapViewLabel` from `src/features/maps/map-types.ts` (grep first: `grep -rn "mapViews\|mapViewLabel" src` — the only remaining callers are `src/dev/orbit-flo-visual-review.tsx` via the old toolbar props, which Task 12 replaces; if `map-types.test.ts` or `map-templates.ts` reference them, keep `mapViews` and delete only `mapViewLabel`).

Add to `src/styles.css`, after `.orbit-map-edge-selected … { }`:

```css
.map-save-dot {
  height: 0.4rem;
  width: 0.4rem;
  border-radius: 999px;
  background: #64748b;
}

.map-save-dot-dirty,
.map-save-dot-saving {
  background: #67e8f9;
  box-shadow: 0 0 8px rgba(103, 232, 249, 0.8);
}

.map-save-dot-error {
  background: #fbbf24;
}
```

- [ ] **Step 3: Run the toolbar tests**

Run: `npm test -- src/features/maps/map-toolbar.test.tsx src/features/maps/map-types.test.ts`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/features/maps/map-toolbar.tsx src/features/maps/map-toolbar.test.tsx src/features/maps/map-types.ts src/styles.css
git commit -m "feat(maps): toolbar with Arrange menu, undo/redo and autosave status"
```

---

### Task 8: `NewMapDialog`

**Files:**
- Create: `src/features/maps/new-map-dialog.tsx`
- Create: `src/features/maps/new-map-dialog.test.tsx`
- Modify: `src/styles.css` (selected option style)

**Interfaces:**
- Consumes: `Modal` from `src/components/modal.tsx` (`{ title, onClose, size, children }`); `mapTemplates` from `map-templates.ts` (`{ id, title, description, nodes, edges }[]`); `TemplateThumbnail` (Task 4).
- Produces:

```ts
export type NewMapInput = { templateId: string | null; title: string };
export function NewMapDialog(props: { isCreating: boolean; error: string | null; onClose: () => void; onCreate: (input: NewMapInput) => void }): JSX.Element;
```

- [ ] **Step 1: Write the failing test**

Create `src/features/maps/new-map-dialog.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { mapTemplates } from "./map-templates";
import { NewMapDialog } from "./new-map-dialog";

function renderDialog(overrides: Partial<React.ComponentProps<typeof NewMapDialog>> = {}) {
  const props = { isCreating: false, error: null, onClose: vi.fn(), onCreate: vi.fn(), ...overrides };
  render(<NewMapDialog {...props} />);
  return props;
}

describe("NewMapDialog", () => {
  it("lists a blank option and every template, with Blank selected", () => {
    renderDialog();
    const options = screen.getAllByRole("radio");
    expect(options).toHaveLength(mapTemplates.length + 1);
    expect(screen.getByRole("radio", { name: /Blank map/ })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("textbox", { name: "Map title" })).toHaveValue("Untitled map");
  });

  it("fills the title from the chosen template and submits it", async () => {
    const user = userEvent.setup();
    const props = renderDialog();

    await user.click(screen.getByRole("radio", { name: /Feature plan/ }));
    expect(screen.getByRole("textbox", { name: "Map title" })).toHaveValue("Feature plan");

    await user.click(screen.getByRole("button", { name: "Create map" }));
    expect(props.onCreate).toHaveBeenCalledWith({ templateId: "feature-plan", title: "Feature plan" });
  });

  it("submits a blank map with an edited title on Enter", async () => {
    const user = userEvent.setup();
    const props = renderDialog();

    const title = screen.getByRole("textbox", { name: "Map title" });
    await user.clear(title);
    await user.type(title, "Q4 themes{Enter}");

    expect(props.onCreate).toHaveBeenCalledWith({ templateId: null, title: "Q4 themes" });
  });

  it("falls back to Untitled map when the title is blank", async () => {
    const user = userEvent.setup();
    const props = renderDialog();

    await user.clear(screen.getByRole("textbox", { name: "Map title" }));
    await user.click(screen.getByRole("button", { name: "Create map" }));

    expect(props.onCreate).toHaveBeenCalledWith({ templateId: null, title: "Untitled map" });
  });

  it("shows the error and disables Create while creating", () => {
    renderDialog({ error: "nope", isCreating: true });
    expect(screen.getByText("nope")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Creating…" })).toBeDisabled();
  });

  it("closes from Cancel", async () => {
    const user = userEvent.setup();
    const props = renderDialog();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(props.onClose).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run to see it fail**

Run: `npm test -- src/features/maps/new-map-dialog.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the dialog**

Create `src/features/maps/new-map-dialog.tsx`:

```tsx
import { useState } from "react";
import { InlineAlert } from "../../components/inline-alert";
import { Modal } from "../../components/modal";
import { mapTemplates } from "./map-templates";
import { TemplateThumbnail } from "./map-template-thumbnail";

export type NewMapInput = { templateId: string | null; title: string };

type NewMapDialogProps = {
  isCreating: boolean;
  error: string | null;
  onClose: () => void;
  onCreate: (input: NewMapInput) => void;
};

const BLANK_TITLE = "Untitled map";

export function NewMapDialog({ isCreating, error, onClose, onCreate }: NewMapDialogProps) {
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [title, setTitle] = useState(BLANK_TITLE);

  function choose(id: string | null, nextTitle: string) {
    setTemplateId(id);
    setTitle(nextTitle);
  }

  function submit() {
    if (isCreating) return;
    onCreate({ templateId, title: title.trim() || BLANK_TITLE });
  }

  return (
    <Modal onClose={onClose} size="md" title="New map">
      <form
        className="grid gap-5"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <div aria-label="Start from" className="grid gap-2 sm:grid-cols-2" role="radiogroup">
          <button
            aria-checked={templateId === null}
            className="map-template-card new-map-option"
            onClick={() => choose(null, BLANK_TITLE)}
            role="radio"
            type="button"
          >
            <span aria-hidden="true" className="map-card-thumbnail-placeholder h-[3.25rem] w-24 shrink-0 rounded-md" />
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-white">Blank map</span>
              <span className="mt-1 block text-xs leading-5 text-slate-400">Start with an empty canvas.</span>
            </span>
          </button>
          {mapTemplates.map((template) => (
            <button
              aria-checked={templateId === template.id}
              className="map-template-card new-map-option"
              key={template.id}
              onClick={() => choose(template.id, template.title)}
              role="radio"
              type="button"
            >
              <TemplateThumbnail edges={template.edges} nodes={template.nodes} />
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-white">{template.title}</span>
                <span className="mt-1 line-clamp-2 block text-xs leading-5 text-slate-400">{template.description}</span>
              </span>
            </button>
          ))}
        </div>

        <label className="grid gap-1 text-sm">
          <span className="font-medium text-slate-200">Title</span>
          <input aria-label="Map title" className="orbit-input px-3 py-2" onChange={(event) => setTitle(event.target.value)} value={title} />
        </label>

        {error ? <InlineAlert tone="error">{error}</InlineAlert> : null}

        <div className="flex justify-end gap-2">
          <button className="orbit-button-secondary" onClick={onClose} type="button">
            Cancel
          </button>
          <button className="orbit-button" disabled={isCreating} type="submit">
            {isCreating ? "Creating…" : "Create map"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
```

Add to `src/styles.css`, after `.map-template-card:disabled { … }` (inside the `@layer components` block):

```css
  .new-map-option[aria-checked="true"] {
    border-color: rgba(103, 232, 249, 0.5);
    background: rgba(15, 23, 42, 0.6);
  }
```

- [ ] **Step 4: Run the test**

Run: `npm test -- src/features/maps/new-map-dialog.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/maps/new-map-dialog.tsx src/features/maps/new-map-dialog.test.tsx src/styles.css
git commit -m "feat(maps): New map dialog with blank and template options"
```

---

### Task 9: `MapLibraryPage`

**Files:**
- Create: `src/features/maps/map-library-page.tsx`
- Create: `src/features/maps/map-library-page.test.tsx`

**Interfaces:**
- Consumes: Task 1 queries; `withFreshIds` (Task 1); `createMapFromTemplate(templateId, { projectId })` from `map-templates.ts` (returns `EditableMapGraph`); `MapCard` (Task 4); `NewMapDialog`, `NewMapInput` (Task 8); `EmptyState({ title, message, illustration?, action?, isLoading? })`; `useAuth()` → `{ isLoading, user }`; `useWorkspaceId()`.
- Produces: `export function MapLibraryPage(props: { projectId?: string | null; onOpenMap: (mapId: string) => void }): JSX.Element`

- [ ] **Step 1: Write the failing test**

Create `src/features/maps/map-library-page.test.tsx`:

```tsx
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
  beforeEach(() => {
    vi.clearAllMocks();
    mapMocks.listMindMaps.mockResolvedValue([map(), map({ id: "map-2", title: "Roadmap" })]);
    mapMocks.listMindMapPreviews.mockResolvedValue({
      "map-1": { nodes: [{ id: "a", position: { x: 0, y: 0 }, nodeType: "idea" }, { id: "b", position: { x: 1, y: 1 }, nodeType: "idea" }], edges: [] },
      "map-2": { nodes: [], edges: [] },
    });
    mapMocks.createMindMap.mockResolvedValue(map({ id: "map-new", title: "Feature plan" }));
    mapMocks.replaceMindMapGraph.mockImplementation(async (_client: unknown, input: { graph: unknown }) => input.graph);
    mapMocks.updateMindMap.mockResolvedValue(map({ title: "Renamed" }));
    mapMocks.archiveMindMap.mockResolvedValue(map({ archived_at: "now" }));
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
```

- [ ] **Step 2: Run to see it fail**

Run: `npm test -- src/features/maps/map-library-page.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the library page**

Create `src/features/maps/map-library-page.tsx`:

```tsx
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Rocket, Share2, Telescope } from "lucide-react";
import { useState } from "react";
import { EmptyState } from "../../components/empty-state";
import { InlineAlert } from "../../components/inline-alert";
import { supabase } from "../../lib/supabase/client";
import { useAuth } from "../auth/use-auth";
import { useWorkspaceId } from "../workspaces/workspace-context";
import { MapCard } from "./map-card";
import { withFreshIds } from "./map-graph-ops";
import { createMapFromTemplate } from "./map-templates";
import type { EditableMapGraph } from "./map-types";
import {
  archiveMindMap,
  createMindMap,
  duplicateMindMap,
  listMindMapPreviews,
  listMindMaps,
  mindMapKeys,
  replaceMindMapGraph,
  updateMindMap,
  type MindMap,
} from "./maps.queries";
import { NewMapDialog, type NewMapInput } from "./new-map-dialog";

const mapsFeatureStrip = [
  { icon: Telescope, title: "See the big picture", body: "Zoom out and watch themes emerge." },
  { icon: Share2, title: "Connect what matters", body: "Link ideas into constellations." },
  { icon: Rocket, title: "Move ideas forward", body: "Turn a node into real mission work." },
];

type MapLibraryPageProps = {
  projectId?: string | null;
  onOpenMap: (mapId: string) => void;
};

function blankGraph(title: string): EditableMapGraph {
  return { title, description: "", defaultView: "mind_map", nodes: [], edges: [] };
}

export function MapLibraryPage({ projectId = null, onOpenMap }: MapLibraryPageProps) {
  const { isLoading, user } = useAuth();
  const workspaceId = useWorkspaceId();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [renamingMapId, setRenamingMapId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const listKey = mindMapKeys.list(workspaceId, projectId);
  const previewsKey = mindMapKeys.previews(workspaceId, projectId);

  const mapsQuery = useQuery({
    queryKey: listKey,
    queryFn: () => listMindMaps(supabase, { workspaceId, projectId }),
    enabled: Boolean(user),
    staleTime: 60_000,
  });
  const maps = mapsQuery.data ?? [];
  const mapIds = maps.map((item) => item.id);

  const previewsQuery = useQuery({
    queryKey: previewsKey,
    queryFn: () => listMindMapPreviews(supabase, { workspaceId, mapIds }),
    enabled: Boolean(user) && mapIds.length > 0,
    staleTime: 60_000,
  });

  function invalidateLibrary() {
    void queryClient.invalidateQueries({ queryKey: listKey });
    void queryClient.invalidateQueries({ queryKey: previewsKey });
  }

  const createMutation = useMutation({
    mutationFn: async ({ templateId, title }: NewMapInput) => {
      const graph = templateId ? withFreshIds({ ...createMapFromTemplate(templateId, { projectId }), title }) : blankGraph(title);
      const map = await createMindMap(supabase, {
        workspaceId,
        projectId,
        userId: user?.id as string,
        title,
        description: graph.description,
        defaultView: "mind_map",
      });
      if (graph.nodes.length > 0) {
        try {
          await replaceMindMapGraph(supabase, { workspaceId, mapId: map.id, graph });
        } catch (cause) {
          await archiveMindMap(supabase, { id: map.id, workspaceId }).catch(() => undefined);
          throw cause;
        }
      }
      return map;
    },
    onSuccess: (map) => {
      invalidateLibrary();
      setIsDialogOpen(false);
      onOpenMap(map.id);
    },
  });

  const renameMutation = useMutation({
    mutationFn: (input: { id: string; title: string }) => updateMindMap(supabase, { id: input.id, workspaceId, title: input.title }),
    onSuccess: invalidateLibrary,
    onError: (error) => setActionError(error.message),
    onSettled: () => setRenamingMapId(null),
  });

  const duplicateMutation = useMutation({
    mutationFn: (map: MindMap) =>
      duplicateMindMap(supabase, { workspaceId, projectId, userId: user?.id as string, sourceMapId: map.id, title: `${map.title} copy` }),
    onSuccess: (map) => {
      invalidateLibrary();
      onOpenMap(map.id);
    },
    onError: (error) => setActionError(error.message),
  });

  const archiveMutation = useMutation({
    mutationFn: (id: string) => archiveMindMap(supabase, { id, workspaceId }),
    onSuccess: (_map, id) => {
      queryClient.setQueryData<MindMap[]>(listKey, (current) => current?.filter((item) => item.id !== id));
      invalidateLibrary();
    },
    onError: (error) => setActionError(error.message),
  });

  if (isLoading) {
    return <EmptyState isLoading title="Loading maps" message="Checking your session before opening the visual workspace." />;
  }
  if (!user) {
    return <EmptyState title="Sign in required" message="Sign in to plan with maps." />;
  }

  const newMapButton = (
    <button
      className="orbit-button gap-1.5"
      onClick={() => {
        setActionError(null);
        setIsDialogOpen(true);
      }}
      type="button"
    >
      <Plus aria-hidden="true" className="h-4 w-4" />
      New map
    </button>
  );

  return (
    <div className="orbit-page-enter grid gap-5">
      <div className="flex items-center justify-between gap-3">
        {projectId ? (
          <p className="text-sm text-slate-400">Maps attached to this mission.</p>
        ) : (
          <h1 className="text-2xl font-bold text-white">Maps</h1>
        )}
        {newMapButton}
      </div>

      {actionError ? <InlineAlert tone="error">{actionError}</InlineAlert> : null}

      {mapsQuery.isPending ? (
        <EmptyState isLoading title="Loading map library" message="Fetching visual plans." />
      ) : mapsQuery.isError ? (
        <EmptyState
          action={
            <button className="orbit-button-secondary" onClick={() => void mapsQuery.refetch()} type="button">
              Retry
            </button>
          }
          message={mapsQuery.error.message}
          title="Could not load maps"
        />
      ) : maps.length === 0 ? (
        <div className="grid gap-4">
          <EmptyState
            action={newMapButton}
            illustration="maps"
            message="Start a blank map or pick a template to open the planning canvas."
            title="No maps yet"
          />
          <div aria-label="What maps are for" className="grid gap-3 sm:grid-cols-3">
            {mapsFeatureStrip.map(({ icon: Icon, title, body }) => (
              <div className="surface-quiet flex items-start gap-3 rounded-xl p-4" key={title}>
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-cyan-300/10 text-cyan-200">
                  <Icon aria-hidden="true" className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white">{title}</p>
                  <p className="mt-0.5 text-sm leading-6 text-slate-400">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {maps.map((item) => (
            <MapCard
              isRenaming={renamingMapId === item.id}
              key={item.id}
              map={item}
              onArchive={() => archiveMutation.mutate(item.id)}
              onCancelRename={() => setRenamingMapId(null)}
              onDuplicate={() => duplicateMutation.mutate(item)}
              onOpen={() => onOpenMap(item.id)}
              onRename={(title) => renameMutation.mutate({ id: item.id, title })}
              onStartRename={() => setRenamingMapId(item.id)}
              preview={previewsQuery.data?.[item.id]}
            />
          ))}
        </div>
      )}

      {isDialogOpen ? (
        <NewMapDialog
          error={createMutation.error?.message ?? null}
          isCreating={createMutation.isPending}
          onClose={() => setIsDialogOpen(false)}
          onCreate={(input) => createMutation.mutate(input)}
        />
      ) : null}
    </div>
  );
}
```

If `EmptyState` does not accept an `action` prop by that name, open `src/components/empty-state.tsx` and use the prop it exposes for a trailing element (line 37 shows `action?: React.ReactNode`).

- [ ] **Step 4: Run the test**

Run: `npm test -- src/features/maps/map-library-page.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/maps/map-library-page.tsx src/features/maps/map-library-page.test.tsx
git commit -m "feat(maps): library page with cards, create, rename, duplicate and archive"
```

---
### Task 10: `MapEditorPage`

**Files:**
- Create: `src/features/maps/map-editor-page.tsx`
- Create: `src/features/maps/map-editor-page.test.tsx`
- Modify: `src/styles.css` (inspector dock, hint strip, empty canvas, title input)

**Interfaces:**
- Consumes: `useMapEditor` (Task 3), `MapCanvas` + `MapCanvasHandle` (Task 5), `MapInspector` (Task 6), `MapToolbar` (Task 7), `arrangeGraph`, `placeNewNode` (Task 2), `createNodeAt`, `createConnectedNode` (existing), queries (`getMindMapGraph`, `replaceMindMapGraph`, `convertMindMapNode`, `mindMapKeys`), `notesKeys` from `src/features/notes/notes.queries.ts`.
- Produces:

```ts
export const MAP_HINTS_KEY = "orbit-flo:maps-hints-dismissed";
export function MapEditorPage(props: {
  mapId: string;
  projectId?: string | null;
  onBack: () => void;
  initialSelection?: MapSelection;
}): JSX.Element;
```

- Callers render it with `key={mapId}` so a different map remounts the hook.

- [ ] **Step 1: Write the failing editor test**

Create `src/features/maps/map-editor-page.test.tsx`:

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MAP_HINTS_KEY, MapEditorPage } from "./map-editor-page";
import type { EditableMapGraph, EditableMapNode } from "./map-types";

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
      onChange: (graph: EditableMapGraph) => void;
      onSelect: (selection: { kind: "node"; id: string } | null) => void;
    },
    ref: React.ForwardedRef<{ fitView: () => void; viewportCenter: () => { x: number; y: number } }>,
  ) {
    React.useImperativeHandle(ref, () => ({ fitView: canvasMocks.fitView, viewportCenter: () => ({ x: 500, y: 300 }) }));
    return (
      <div data-renaming={props.renamingNodeId ?? ""} data-testid="mock-canvas">
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
    renderEditor();
    await screen.findByRole("textbox", { name: "Map title" });

    await user.click(screen.getByRole("button", { name: "Mock edit" }));
    await waitFor(() => expect(mapMocks.replaceMindMapGraph).toHaveBeenCalledTimes(1));
    expect((mapMocks.replaceMindMapGraph.mock.calls[0][1] as { graph: EditableMapGraph }).graph.title).toBe("Edited");
    expect(await screen.findByText("Saved")).toBeTruthy();

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
});
```

- [ ] **Step 2: Run to see it fail**

Run: `npm test -- src/features/maps/map-editor-page.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the editor page**

Create `src/features/maps/map-editor-page.tsx`:

```tsx
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { clsx } from "clsx";
import { ArrowLeft, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { EmptyState } from "../../components/empty-state";
import { supabase } from "../../lib/supabase/client";
import { useAuth } from "../auth/use-auth";
import { notesKeys } from "../notes/notes.queries";
import { useWorkspaceId } from "../workspaces/workspace-context";
import { MapCanvas, type MapCanvasHandle } from "./map-canvas";
import { createConnectedNode, createNodeAt } from "./map-graph-ops";
import { MapInspector } from "./map-inspector";
import { arrangeGraph, placeNewNode, type ArrangeMode } from "./map-layouts";
import { MapToolbar } from "./map-toolbar";
import type { ConvertedObjectType, EditableMapGraph } from "./map-types";
import { convertMindMapNode, getMindMapGraph, mindMapKeys, replaceMindMapGraph } from "./maps.queries";
import { useMapEditor, type MapSelection } from "./use-map-editor";

export const MAP_HINTS_KEY = "orbit-flo:maps-hints-dismissed";
const HINT_NODE_LIMIT = 3;
const editableTags = new Set(["INPUT", "TEXTAREA", "SELECT"]);

function readHintsDismissed() {
  try {
    return window.localStorage.getItem(MAP_HINTS_KEY) === "1";
  } catch {
    return false;
  }
}

function writeHintsDismissed() {
  try {
    window.localStorage.setItem(MAP_HINTS_KEY, "1");
  } catch {
    // Storage can be unavailable; the strip simply returns next visit.
  }
}

type MapEditorPageProps = {
  mapId: string;
  projectId?: string | null;
  onBack: () => void;
  initialSelection?: MapSelection;
};

function MapTitleInput({ title, onCommit }: { title: string; onCommit: (title: string) => void }) {
  const [draft, setDraft] = useState(title);
  const [isEditing, setIsEditing] = useState(false);
  const cancelledRef = useRef(false);

  useEffect(() => {
    if (!isEditing) setDraft(title);
  }, [isEditing, title]);

  function commit() {
    setIsEditing(false);
    if (cancelledRef.current) {
      cancelledRef.current = false;
      setDraft(title);
      return;
    }
    const trimmed = draft.trim();
    if (trimmed && trimmed !== title) onCommit(trimmed);
    else setDraft(title);
  }

  return (
    <input
      aria-label="Map title"
      className="map-title-input min-w-0 flex-1 bg-transparent px-1 text-base font-semibold text-white outline-none"
      onBlur={commit}
      onChange={(event) => setDraft(event.target.value)}
      onFocus={() => setIsEditing(true)}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          event.currentTarget.blur();
        }
        if (event.key === "Escape") {
          event.preventDefault();
          cancelledRef.current = true;
          event.currentTarget.blur();
        }
      }}
      value={draft}
    />
  );
}

const hints = [
  ["Double-click", "to add"],
  ["Tab", "child"],
  ["Enter", "sibling"],
  ["Drag a handle", "to connect"],
] as const;

function MapHintStrip({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div className="map-hint-strip" data-testid="map-hint-strip">
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
        {hints.map(([key, text], index) => (
          <span className="inline-flex items-center gap-1.5" key={key}>
            {index > 0 ? (
              <span aria-hidden="true" className="text-slate-600">
                ·
              </span>
            ) : null}
            <kbd className="map-hint-key">{key}</kbd>
            {text}
          </span>
        ))}
      </p>
      <button aria-label="Dismiss hints" className="grid h-6 w-6 place-items-center rounded-full text-slate-500 hover:text-slate-200" onClick={onDismiss} type="button">
        <X aria-hidden="true" className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export function MapEditorPage({ mapId, projectId = null, onBack, initialSelection = null }: MapEditorPageProps) {
  const { isLoading: isAuthLoading, user } = useAuth();
  const workspaceId = useWorkspaceId();
  const queryClient = useQueryClient();
  const canvasRef = useRef<MapCanvasHandle>(null);
  const [renamingNodeId, setRenamingNodeId] = useState<string | null>(null);
  const [isInspectorOpen, setIsInspectorOpen] = useState(initialSelection !== null);
  const [hintsDismissed, setHintsDismissed] = useState(readHintsDismissed);

  const graphQuery = useQuery({
    queryKey: mindMapKeys.graph(workspaceId, mapId),
    queryFn: () => getMindMapGraph(supabase, { workspaceId, mapId }),
    enabled: Boolean(user),
    staleTime: 5 * 60_000,
  });

  const save = useCallback(
    (graph: EditableMapGraph) => replaceMindMapGraph(supabase, { workspaceId, mapId, graph }),
    [mapId, workspaceId],
  );
  const onSaved = useCallback(
    (graph: EditableMapGraph) => {
      const key = mindMapKeys.graph(workspaceId, mapId);
      const previous = queryClient.getQueryData<EditableMapGraph>(key);
      queryClient.setQueryData(key, graph);
      if (previous?.title !== graph.title) {
        void queryClient.invalidateQueries({ queryKey: mindMapKeys.list(workspaceId, projectId) });
      }
    },
    [mapId, projectId, queryClient, workspaceId],
  );

  const editor = useMapEditor({ initialGraph: graphQuery.data ?? null, save, onSaved, initialSelection });
  const { graph, selection, setGraph, setSelection } = editor;

  useEffect(() => {
    if (selection) setIsInspectorOpen(true);
  }, [selection]);

  const selectedNode = selection?.kind === "node" ? (graph?.nodes.find((item) => item.id === selection.id) ?? null) : null;

  const convertMutation = useMutation({
    mutationFn: async (type: ConvertedObjectType) => {
      if (!selectedNode) throw new Error("Select a node before converting it.");
      if ((type === "task" || type === "milestone") && !projectId) {
        throw new Error("Choose a project map to convert to a task or milestone.");
      }
      await editor.flush();
      const result = await convertMindMapNode(supabase, { id: selectedNode.id, workspaceId, projectId, convertedType: type });
      const convertedId = result.node.converted_id ?? result.convertedObject?.id;
      const convertedType = result.node.converted_type as ConvertedObjectType | null;
      if (!convertedId || !convertedType || !result.node.converted_at) {
        throw new Error("Could not convert the selected node.");
      }
      return { nodeId: selectedNode.id, convertedId, convertedType, convertedAt: result.node.converted_at };
    },
    onSuccess: ({ nodeId, convertedId, convertedType, convertedAt }) => {
      editor.mergeServerNode(nodeId, { status: "converted", convertedType, convertedId, convertedAt });
      void queryClient.invalidateQueries({ queryKey: mindMapKeys.graph(workspaceId, mapId) });
      if (convertedType === "task" && projectId) {
        void queryClient.invalidateQueries({ queryKey: ["work-items", workspaceId, projectId] });
        void queryClient.invalidateQueries({ queryKey: ["due-calendar"] });
      }
      if (convertedType === "milestone" && projectId) {
        void queryClient.invalidateQueries({ queryKey: ["milestones", workspaceId, projectId] });
      }
      if (convertedType === "note") {
        void queryClient.invalidateQueries({ queryKey: notesKeys.workspace(workspaceId) });
        if (projectId) void queryClient.invalidateQueries({ queryKey: notesKeys.project(workspaceId, projectId) });
      }
    },
  });

  const handleAddNode = useCallback(() => {
    if (!graph) return;
    const nodeId = crypto.randomUUID();
    if (selection?.kind === "node") {
      setGraph(createConnectedNode(graph, selection.id, nodeId, crypto.randomUUID()));
    } else {
      const center = canvasRef.current?.viewportCenter() ?? { x: 0, y: 0 };
      setGraph(createNodeAt(graph, placeNewNode(graph.nodes, center), nodeId));
    }
    setSelection({ kind: "node", id: nodeId });
    setRenamingNodeId(nodeId);
  }, [graph, selection, setGraph, setSelection]);

  const handleArrange = useCallback(
    (mode: ArrangeMode) => {
      if (!graph) return;
      setGraph(arrangeGraph(graph, mode));
      window.requestAnimationFrame(() => canvasRef.current?.fitView());
    },
    [graph, setGraph],
  );

  function handleKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (!(event.ctrlKey || event.metaKey)) return;
    const key = event.key.toLowerCase();
    if (key === "s") {
      event.preventDefault();
      void editor.flush().catch(() => undefined);
      return;
    }
    const target = event.target as HTMLElement;
    if (editableTags.has(target.tagName) || target.isContentEditable) return;
    if (key === "z") {
      event.preventDefault();
      if (event.shiftKey) editor.redo();
      else editor.undo();
    } else if (key === "y") {
      event.preventDefault();
      editor.redo();
    }
  }

  function dismissHints() {
    writeHintsDismissed();
    setHintsDismissed(true);
  }

  if (isAuthLoading) {
    return <EmptyState isLoading title="Loading map" message="Checking your session." />;
  }
  if (!user) {
    return <EmptyState title="Sign in required" message="Sign in to plan with maps." />;
  }
  if (graphQuery.isError && !graph) {
    return (
      <EmptyState
        action={
          <div className="flex gap-2">
            <button className="orbit-button-secondary" onClick={() => void graphQuery.refetch()} type="button">
              Retry
            </button>
            <button className="orbit-button-tertiary" onClick={onBack} type="button">
              Back to maps
            </button>
          </div>
        }
        message={graphQuery.error.message}
        title="Could not load map"
      />
    );
  }
  if (!graph) {
    return <EmptyState isLoading title="Opening map" message="Loading the saved nodes and connections." />;
  }

  const showHints = !hintsDismissed && graph.nodes.length < HINT_NODE_LIMIT;
  const canvasHeight = projectId ? "h-[max(28rem,calc(100vh-14rem))]" : "h-[max(28rem,calc(100vh-9.5rem))]";

  return (
    <div className="orbit-page-enter grid gap-3" data-testid="map-editor" onKeyDown={handleKeyDown}>
      <header className="surface-whisper flex min-h-11 flex-wrap items-center gap-2 rounded-lg px-2 py-1">
        <button className="orbit-button-tertiary gap-1 px-2 py-1 text-xs" onClick={onBack} type="button">
          <ArrowLeft aria-hidden="true" className="h-3.5 w-3.5" />
          Maps
        </button>
        <MapTitleInput onCommit={(title) => setGraph({ ...graph, title }, { coalesceKey: "map:title" })} title={graph.title} />
        <MapToolbar
          canRedo={editor.canRedo}
          canUndo={editor.canUndo}
          error={editor.error}
          isInspectorOpen={isInspectorOpen}
          onAddNode={handleAddNode}
          onArrange={handleArrange}
          onFitView={() => canvasRef.current?.fitView()}
          onRedo={editor.redo}
          onRetrySave={editor.retry}
          onToggleInspector={() => setIsInspectorOpen((current) => !current)}
          onUndo={editor.undo}
          status={editor.status}
        />
      </header>

      <div className={clsx("grid gap-3", isInspectorOpen && "lg:grid-cols-[minmax(0,1fr)_20rem]")}>
        <div className="relative min-w-0">
          <MapCanvas
            className={canvasHeight}
            graph={graph}
            onChange={setGraph}
            onRenamingChange={setRenamingNodeId}
            onSelect={setSelection}
            ref={canvasRef}
            renamingNodeId={renamingNodeId}
            selection={selection}
          />
          {graph.nodes.length === 0 ? <p className="map-canvas-empty">Double-click anywhere to place your first idea</p> : null}
          {showHints ? <MapHintStrip onDismiss={dismissHints} /> : null}
        </div>

        {isInspectorOpen ? (
          <aside aria-label="Map details" className="map-inspector-dock surface-raised">
            <div className="flex justify-end pb-2 lg:hidden">
              <button className="orbit-button-secondary px-2 py-1 text-xs" onClick={() => setIsInspectorOpen(false)} type="button">
                Close details
              </button>
            </div>
            <MapInspector
              conversionError={convertMutation.error?.message ?? null}
              graph={graph}
              isConverting={convertMutation.isPending}
              onConvert={(type) => convertMutation.mutate(type)}
              onGraphChange={setGraph}
              onSelect={setSelection}
              projectId={projectId}
              selection={selection}
              workspaceId={workspaceId}
            />
          </aside>
        ) : null}
      </div>
    </div>
  );
}
```

Add to `src/styles.css`, after the `.map-save-dot-error { … }` block:

```css
.map-title-input {
  border-bottom: 1px solid transparent;
  transition: border-color 160ms ease;
}

.map-title-input:focus {
  border-bottom-color: rgba(103, 232, 249, 0.5);
}

.map-inspector-dock {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  z-index: 40;
  width: 100%;
  max-width: 24rem;
  overflow-y: auto;
  padding: 1rem;
}

@media (min-width: 1024px) {
  .map-inspector-dock {
    position: sticky;
    top: 1rem;
    z-index: auto;
    width: auto;
    max-width: none;
    max-height: calc(100vh - 2rem);
    align-self: start;
    border-radius: 0.75rem;
  }
}

.map-canvas-empty {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  pointer-events: none;
  font-size: 0.875rem;
  color: #94a3b8;
}

.map-hint-strip {
  position: absolute;
  bottom: 0.75rem;
  left: 50%;
  z-index: 5;
  display: flex;
  max-width: calc(100% - 2rem);
  align-items: center;
  gap: 0.75rem;
  padding: 0.375rem 0.5rem 0.375rem 0.85rem;
  border: 1px solid var(--orbit-border);
  border-radius: 999px;
  background: var(--orbit-surface-quiet);
  backdrop-filter: blur(10px);
  transform: translateX(-50%);
}

.map-hint-key {
  padding: 0.1rem 0.4rem;
  border: 1px solid rgba(103, 232, 249, 0.3);
  border-radius: 0.25rem;
  font-family: inherit;
  font-size: 0.625rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #cffafe;
}
```

- [ ] **Step 4: Run the editor tests**

Run: `npm test -- src/features/maps/map-editor-page.test.tsx`
Expected: PASS. Known snags: the Ctrl+S test needs the keyboard event to reach the editor root — the focused element after the click is the "Mock edit" button inside the root, so bubbling works; if `fitView` is not called, `requestAnimationFrame` in jsdom fires within ~16ms, which `waitFor` covers.

- [ ] **Step 5: Commit**

```bash
git add src/features/maps/map-editor-page.tsx src/features/maps/map-editor-page.test.tsx src/styles.css
git commit -m "feat(maps): full-width editor page with docked inspector, hints and autosave"
```

---

### Task 11: Routes, project tab, and removal of the old page

**Files:**
- Create: `src/features/maps/maps-routes.tsx`, `src/features/maps/project-maps-tab.tsx`, `src/features/maps/project-maps-tab.test.tsx`
- Modify: `src/app/route-loaders.ts`, `src/app/routes.tsx`, `src/app/App.test.tsx`
- Modify: `src/features/projects/project-workspace-page.tsx`, `src/features/projects/project-workspace-page.test.tsx`
- Delete: `src/features/maps/maps-page.tsx`, `src/features/maps/maps-page.test.tsx`, `src/features/maps/map-library-panel.tsx`, `src/features/maps/map-library-panel.test.tsx`

**Interfaces:**
- Produces:
  - `MapsLibraryRoute()` and `MapsEditorRoute()` in `maps-routes.tsx`
  - `ProjectMapsTab({ projectId: string })` in `project-maps-tab.tsx`
  - `loadMapsLibraryRoute`, `loadMapsEditorRoute`, `loadProjectMapsTab` in `route-loaders.ts` (replacing `loadMapsPage`)

- [ ] **Step 1: Write the project-tab test**

Create `src/features/maps/project-maps-tab.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { ProjectMapsTab } from "./project-maps-tab";

vi.mock("./map-library-page", () => ({
  MapLibraryPage: ({ onOpenMap, projectId }: { onOpenMap: (id: string) => void; projectId: string | null }) => (
    <button onClick={() => onOpenMap("map-9")} type="button">
      Library for {projectId}
    </button>
  ),
}));
vi.mock("./map-editor-page", () => ({
  MapEditorPage: ({ mapId, onBack, projectId }: { mapId: string; onBack: () => void; projectId: string | null }) => (
    <button onClick={onBack} type="button">
      Editor {mapId} in {projectId}
    </button>
  ),
}));

function LocationProbe() {
  const location = useLocation();
  return <p data-testid="location">{location.search}</p>;
}

function renderTab(initialEntry: string) {
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route
          element={
            <>
              <ProjectMapsTab projectId="project-1" />
              <LocationProbe />
            </>
          }
          path="/projects/:projectId"
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe("ProjectMapsTab", () => {
  it("shows the library and writes ?map= when a map opens", async () => {
    const user = userEvent.setup();
    renderTab("/projects/project-1?task=t-1");

    await user.click(screen.getByRole("button", { name: "Library for project-1" }));

    expect(screen.getByRole("button", { name: "Editor map-9 in project-1" })).toBeTruthy();
    expect(screen.getByTestId("location").textContent).toBe("?task=t-1&map=map-9");
  });

  it("shows the editor for ?map= and clears it on back", async () => {
    const user = userEvent.setup();
    renderTab("/projects/project-1?map=map-3");

    await user.click(screen.getByRole("button", { name: "Editor map-3 in project-1" }));

    expect(screen.getByRole("button", { name: "Library for project-1" })).toBeTruthy();
    expect(screen.getByTestId("location").textContent).toBe("");
  });
});
```

- [ ] **Step 2: Create the route wrappers and tab**

`src/features/maps/project-maps-tab.tsx`:

```tsx
import { useSearchParams } from "react-router-dom";
import { MapEditorPage } from "./map-editor-page";
import { MapLibraryPage } from "./map-library-page";

export function ProjectMapsTab({ projectId }: { projectId: string }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const mapId = searchParams.get("map");

  function setMap(id: string | null) {
    const next = new URLSearchParams(searchParams);
    if (id) next.set("map", id);
    else next.delete("map");
    setSearchParams(next);
  }

  return mapId ? (
    <MapEditorPage key={mapId} mapId={mapId} onBack={() => setMap(null)} projectId={projectId} />
  ) : (
    <MapLibraryPage onOpenMap={setMap} projectId={projectId} />
  );
}
```

`src/features/maps/maps-routes.tsx`:

```tsx
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { useWorkspaceId } from "../workspaces/workspace-context";
import { workspacePath } from "../workspaces/workspace-path";
import { MapEditorPage } from "./map-editor-page";
import { MapLibraryPage } from "./map-library-page";

export function MapsLibraryRoute() {
  const workspaceId = useWorkspaceId();
  const navigate = useNavigate();
  return <MapLibraryPage onOpenMap={(mapId) => navigate(workspacePath(workspaceId, `/maps/${mapId}`))} />;
}

export function MapsEditorRoute() {
  const { mapId } = useParams();
  const workspaceId = useWorkspaceId();
  const navigate = useNavigate();
  if (!mapId) return <Navigate replace to={workspacePath(workspaceId, "/maps")} />;
  return <MapEditorPage key={mapId} mapId={mapId} onBack={() => navigate(workspacePath(workspaceId, "/maps"))} />;
}
```

- [ ] **Step 3: Wire the loaders and routes**

In `src/app/route-loaders.ts` replace the `loadMapsPage` export with:

```ts
export const loadMapsLibraryRoute = () =>
  import("../features/maps/maps-routes").then((module) => ({ default: module.MapsLibraryRoute }));

export const loadMapsEditorRoute = () =>
  import("../features/maps/maps-routes").then((module) => ({ default: module.MapsEditorRoute }));

export const loadProjectMapsTab = () =>
  import("../features/maps/project-maps-tab").then((module) => ({ default: module.ProjectMapsTab }));
```

and change `"/maps": loadMapsPage,` in `routePrefetchers` to `"/maps": loadMapsLibraryRoute,`.

In `src/app/routes.tsx`:
- Replace the `loadMapsPage` import with `loadMapsEditorRoute, loadMapsLibraryRoute` and `const MapsPage = lazy(loadMapsPage);` with:

```ts
const MapsLibraryRoute = lazy(loadMapsLibraryRoute);
const MapsEditorRoute = lazy(loadMapsEditorRoute);
```

- After `<Route element={<ResolveWorkspace />} path="/maps" />` add `<Route element={<ResolveWorkspace />} path="/maps/:mapId" />`.
- Replace `<Route element={<MapsPage />} path="maps" />` with:

```tsx
          <Route element={<MapsLibraryRoute />} path="maps" />
          <Route element={<MapsEditorRoute />} path="maps/:mapId" />
```

- [ ] **Step 4: Update the project workspace page**

In `src/features/projects/project-workspace-page.tsx`:

1. Line 69: `const loadMapsPage = () => import("../maps/maps-page").then((module) => ({ default: module.MapsPage }));` → `const loadProjectMapsTab = () => import("../maps/project-maps-tab").then((module) => ({ default: module.ProjectMapsTab }));`
2. Line 79: `const MapsPage = lazy(loadMapsPage);` → `const ProjectMapsTab = lazy(loadProjectMapsTab);`
3. Line 700: `void loadMapsPage();` → `void loadProjectMapsTab();`
4. Move `const [searchParams, setSearchParams] = useSearchParams();` (line 135) above the `activeTab` state and change that state to:

```ts
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<WorkspaceTab>(() => (searchParams.has("map") ? "Maps" : "Board"));
```

5. Line 1116: `<MapsPage projectId={projectId} />` → `{projectId ? <ProjectMapsTab projectId={projectId} /> : null}`.

- [ ] **Step 5: Update the two existing test files**

`src/features/projects/project-workspace-page.test.tsx`:
- Replace the `vi.mock("../maps/maps-page", …)` block (lines 173–180) with:

```tsx
vi.mock("../maps/project-maps-tab", () => ({
  ProjectMapsTab: ({ projectId }: { projectId: string }) => (
    <>
      <h1>Maps</h1>
      <p>Maps project ID: {projectId}</p>
    </>
  ),
}));
```

- In "renders project maps from the Maps tab" change the expected heading to `"Maps"`.
- Add after it:

```tsx
  it("opens the Maps tab when the URL carries ?map=", async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/projects/project-1?map=map-1"]}>
          <Routes>
            <Route element={<ProjectWorkspacePage />} path="/projects/:projectId" />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(screen.getByRole("tab", { name: "Maps" })).toHaveAttribute("aria-selected", "true");
    expect(await screen.findByRole("heading", { name: "Maps" })).toBeTruthy();
  });
```

`src/app/App.test.tsx`:
- In the `vi.mock("./route-loaders", …)` factory replace the `loadMapsPage` line with:

```tsx
  loadMapsLibraryRoute: () => Promise.resolve({ default: () => <h1>Maps</h1> }),
  loadMapsEditorRoute: () => Promise.resolve({ default: () => <h1>Map editor</h1> }),
  loadProjectMapsTab: () => Promise.resolve({ default: () => <div>Project maps tab</div> }),
```

- Change `["Maps", "Visual planning workspace"],` to `["Maps", "Maps"],`.
- In "renders the maps route inside the app shell" expect heading `"Maps"`, and add:

```tsx
  it("renders the map editor route inside the app shell", async () => {
    await renderApp("/w/workspace-1/maps/map-1");

    expect(screen.getAllByRole("main")).toHaveLength(1);
    expect(await screen.findByRole("heading", { name: "Map editor" })).toBeTruthy();
  });
```

- [ ] **Step 6: Delete the old page and panel**

```bash
git rm src/features/maps/maps-page.tsx src/features/maps/maps-page.test.tsx src/features/maps/map-library-panel.tsx src/features/maps/map-library-panel.test.tsx
```

Then `grep -rn "maps-page\|map-library-panel\|MapsPage\|MapLibraryPanel" src` — the only hits must be in `src/dev/orbit-flo-visual-review.tsx` (fixed in Task 12).

- [ ] **Step 7: Run the affected suites**

Run: `npm test -- src/features/maps src/features/projects/project-workspace-page.test.tsx src/app/App.test.tsx`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add -A src/features/maps src/app src/features/projects/project-workspace-page.tsx src/features/projects/project-workspace-page.test.tsx
git commit -m "feat(maps): library and editor routes, project ?map= tab, remove old page"
```

---

### Task 12: Capture fixtures, full verification, visual check

**Files:**
- Modify: `src/dev/orbit-flo-visual-fixtures.ts`, `src/dev/orbit-flo-visual-review.tsx`
- Modify: `docs/superpowers/specs/2026-09-01-maps-flow-redesign-design.md` (top-down spacing line)

- [ ] **Step 1: Add map fixtures**

In `src/dev/orbit-flo-visual-fixtures.ts`, after `export const visualMindMap = …;` add:

```ts
export const visualMapId = "8a1f7c1e-6d2b-4c0e-9f3a-2b5d6e7f8a90";

export const visualMapRow: Tables["mind_maps"]["Row"] = {
  id: visualMapId,
  workspace_id: visualWorkspaceId,
  project_id: null,
  title: "Feature plan",
  description: "",
  default_view: "mind_map",
  created_by: visualUserId,
  created_at: "2026-07-01T12:00:00.000Z",
  updated_at: timestamp,
  archived_at: null,
};

export const visualMapRows: Tables["mind_maps"]["Row"][] = [
  visualMapRow,
  { ...visualMapRow, id: "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e", title: "Launch flow", updated_at: "2026-07-11T09:00:00.000Z" },
  { ...visualMapRow, id: "c3d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7f", title: "Q3 decision", updated_at: "2026-07-09T18:30:00.000Z" },
];

export const visualMapPreviews = Object.fromEntries(
  [
    [visualMapRows[0].id, createMapFromTemplate("feature-plan", { projectId: null })],
    [visualMapRows[1].id, createMapFromTemplate("launch-flow", { projectId: null })],
    [visualMapRows[2].id, createMapFromTemplate("decision-tree", { projectId: null })],
  ].map(([id, graph]) => [
    id,
    {
      nodes: (graph as typeof visualMindMap).nodes.map((node) => ({ id: node.id, position: node.position, nodeType: node.nodeType })),
      edges: (graph as typeof visualMindMap).edges.map((edge) => ({ id: edge.id, sourceNodeId: edge.sourceNodeId, targetNodeId: edge.targetNodeId })),
    },
  ]),
);
```

(Template ids come from `map-templates.ts`: `feature-plan`, `bug-investigation`, `launch-flow`, `product-roadmap`, `decision-tree`, `meeting-brainstorm`.)

- [ ] **Step 2: Point the two screens at the new pages**

In `src/dev/orbit-flo-visual-review.tsx`:
- Replace the imports of `MapCanvas`, `MapLibraryPanel`, `MapToolbar` with:

```ts
import { MapEditorPage } from "../features/maps/map-editor-page";
import { MapLibraryPage } from "../features/maps/map-library-page";
import { mindMapKeys } from "../features/maps/maps.queries";
```

and add `visualMapId, visualMapPreviews, visualMapRows` to the fixtures import (keep `visualMindMap`).
- In `createVisualQueryClient()` add, next to the other seeds:

```ts
  client.setQueryData(mindMapKeys.list(visualWorkspaceId, null), visualMapRows);
  client.setQueryData(mindMapKeys.previews(visualWorkspaceId, null), visualMapPreviews);
  client.setQueryData(mindMapKeys.graph(visualWorkspaceId, visualMapId), visualMindMap);
```

- Replace `MapsLibraryScreen` and `MindMapScreen` with:

```tsx
function MapsLibraryScreen() {
  return (
    <ProductScreen>
      <MapLibraryPage onOpenMap={() => undefined} />
    </ProductScreen>
  );
}

function MindMapScreen() {
  return (
    <ProductScreen>
      <MapEditorPage
        initialSelection={{ kind: "node", id: visualMindMap.nodes[0].id }}
        mapId={visualMapId}
        onBack={() => undefined}
      />
    </ProductScreen>
  );
}
```

- Remove the now-unused `EmptyState` import if nothing else in the file uses it (check with grep first).

- [ ] **Step 3: Type-check and run everything**

Run: `npm run build`
Expected: succeeds (the visual-review file now type-checks).

Run: `npm test`
Expected: all green. If the whole suite false-fails with worker timeouts on a loaded machine, re-run with `npm test -- --maxWorkers=2` before trusting failures.

- [ ] **Step 4: Visual check through the fixture route**

The capture route only mounts when Vite runs with `VITE_CAPTURE_MODE=1`. Ensure `.worktrees/project-command-center/.env.development.local` contains `VITE_CAPTURE_MODE=1` (it is git-ignored; create it if missing), start the `orbit-flo-worktree` preview, and open:

- `http://localhost:5173/__visual/02-maps-library` at 1440×900 and 390×844 — three cards with thumbnails, node counts, "Updated …", a New map button; the ⋯ menu opens with Rename / Duplicate / Archive; New map opens the dialog with Blank plus six templates.
- `http://localhost:5173/__visual/03-maps-mind-map` at 1440×900 — slim header (Maps back link, title, "Saved" dot, Undo/Redo, Add node, Arrange, Fit, Details), canvas filling the width, inspector docked on the right with the "Feature" node's fields; at 390×844 the inspector becomes a drawer with "Close details".

Fix anything that looks off (spacing, overflow, colours outside the design rules) before moving on. Take screenshots for the PR description.

- [ ] **Step 5: Correct the spec's top-down spacing line**

In `docs/superpowers/specs/2026-09-01-maps-flow-redesign-design.md`, section 3 "Arrange" bullet, change `Left to right / Top down: classic layered tree, 260px between depths, 90px between siblings, subtrees stacked without overlap.` to `Left to right: 260px between depths, 90px between siblings. Top down: 150px between depths, 240px between siblings so 200px-wide labels never overlap. Subtrees stacked without overlap.`

- [ ] **Step 6: Commit**

```bash
git add src/dev/orbit-flo-visual-fixtures.ts src/dev/orbit-flo-visual-review.tsx docs/superpowers/specs/2026-09-01-maps-flow-redesign-design.md
git commit -m "chore(maps): capture fixtures for the library grid and editor"
```

- [ ] **Step 7: Finish the branch**

Invoke `superpowers:finishing-a-development-branch`: push `maps-flow-redesign`, open a PR against `main` titled `feat: maps that flow - library grid, autosaving editor, docked inspector`, and include the two screenshots. Remember the repo's branch-cleanup gotcha: `gh pr merge --delete-branch` silently fails here; delete the branch explicitly after merge and fast-forward the primary checkout.
