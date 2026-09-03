# Maps Flow Redesign

**Date:** 2026-09-01
**Branch:** `maps-flow-redesign`
**Status:** Approved by user

## Problem

Interacting with Maps is clunky end to end:

- Saved maps live in a bare native `<select>` ("Open map…"). Nothing renames, duplicates or archives a map, so every blank map stays "Untitled map".
- The template gallery is pinned as a 288px left column even while editing, so the canvas never gets the width it needs.
- Picking a template creates an empty map row on the server and drops the user into a local draft that immediately reads "Unsaved changes". The map sits in the list with zero nodes until Save is pressed.
- "Add node" always drops the node at a fixed position, so repeated presses stack nodes on top of each other, often off-screen.
- The good gestures exist (double-click to create, Tab child, Enter sibling, double-click rename) but nothing on screen teaches them.
- The Flowchart / Timeline / Decision Tree tabs re-lay out nodes by array index, disable dragging, and dirty the map by changing `default_view`. They are half-built.
- No undo, no Ctrl+S, no visible way to delete a node or edit an edge.
- The inspector is a full-height overlay that covers the canvas, opened by a "Details" button. It cannot change a node's type, status or tags.
- Conversion demands a prior save ("Save this map before converting nodes"), so every conversion is two steps with a warning in between.
- Explicit Save with no navigation guard: leaving the page with unsaved changes loses them silently.

## Goals

- One clear path: library → editor → back, with the canvas owning the full content width while editing.
- Maps are manageable objects: rename, duplicate, archive, preview.
- Autosave replaces explicit Save; conversion never needs a prior save; nothing is lost on navigation.
- Canvas gestures are discoverable and complete: sensible node placement, undo/redo, delete, edge editing, arrange.
- The inspector docks beside the canvas and edits everything a node or edge stores.

## Non-goals

- Realtime collaboration, version history, comments.
- New tables or migrations. The existing `mind_maps`, `mind_map_nodes`, `mind_map_edges` tables, the `replace_mind_map_graph` and `convert_mind_map_node` RPCs, and the `mind_map_view` enum are used as they are.
- Changing the star-node visual language or the constellation canvas styling.
- Agent (WebMCP) tools for maps.

## Decisions taken with the user

| Question | Decision |
|---|---|
| Persistence | Debounced autosave; Save button removed |
| Alternate views | Replaced by one-shot **Arrange** actions that write real positions |
| Structure | Library grid, then a full-width editor at its own route |
| Scope | All four pain areas (opening/managing, canvas editing, details/conversion, saving) |

## Design

### 1. Routes and page structure

**Global maps**

- `/w/:workspaceId/maps` renders `MapLibraryPage`.
- `/w/:workspaceId/maps/:mapId` renders `MapEditorPage`. `/maps` (unscoped) keeps redirecting through `ResolveWorkspace` as today; `/maps/:mapId` is added to the same redirect so a shared link still lands on the editor.
- The editor header carries a "Maps" back link to the library.

**Project maps** (the Maps tab inside `ProjectWorkspacePage`)

- The tab renders the same two components through a small `ProjectMapsTab` wrapper that holds the open map id in the `?map=<id>` search param instead of a path segment. No param → library (filtered to the project); param → editor with a back link that clears the param.
- `ProjectWorkspacePage` initialises `activeTab` to `"Maps"` when `?map=` is present on mount, so a link that carries the param opens the right tab. That is the only change to the project page.

**Removed**: the "Visual planning workspace" `<h1>`, the "Open map…" `<select>`, the always-visible template column, the view tabs, and the Save button. The three-item feature strip survives only in the library's empty state.

### 2. Library (`map-library-page.tsx`)

- Header: title "Maps" (omitted inside a project tab, where the tab already names it) and a primary **New map** button.
- Grid of `MapCard`s (`sm:grid-cols-2 xl:grid-cols-3`), sorted by `updated_at desc` as today. Each card shows:
  - A live thumbnail drawn by the existing `TemplateThumbnail` from the map's real nodes and edges (the component already accepts arbitrary nodes/edges; it gets a larger 160×90 variant via a `size` prop).
  - Title, "N nodes", and relative updated time.
  - An overflow menu (⋯) with **Rename**, **Duplicate**, **Archive**. Delete is deliberately absent: the database only grants delete to owners and admins, while `archived_at` is updatable by every member.
- Clicking the card body opens the editor.
- Empty state: `EmptyState` with the `maps` illustration, "No maps yet", a New map button, and the existing three-item feature strip beneath it.
- Loading and error states use `EmptyState` as today.

**Previews query.** A new `listMindMapPreviews(client, { workspaceId, mapIds })` fetches, in two queries, the nodes (`id, map_id, node_type, position_x, position_y`) and edges (`map_id, source_node_id, target_node_id`) for every listed map, grouped by `map_id`. It runs after the list query resolves and is cached under a new key `mindMapKeys.previews(workspaceId, projectId)`. Cards render without the thumbnail until it arrives; there is no per-card graph fetch.

**New map dialog** (`new-map-dialog.tsx`, uses the shared `Modal`, size `md`):

- A **Blank map** card first, then the six existing templates, each with its thumbnail, title and description.
- Selecting a card fills a **Title** field (template title, or "Untitled map" for blank). Enter or the **Create** button creates the map.
- Creation is `createMindMap` followed immediately by `replaceMindMapGraph` with the materialised template graph (fresh node/edge ids, exactly as `materializeTemplateGraph` does today) in one `useMutation`. The list is invalidated and the editor opens. If the second call fails the map row is archived so no empty map is left behind, and the error is shown in the dialog.

**Rename** is an inline text input in place of the card title (from the menu) and in the editor header (click the title). **Duplicate** creates a new map titled "<title> copy" with the same graph and fresh ids, then opens it. **Archive** sets `archived_at = now()` through a new `archiveMindMap` query and invalidates the list; if the archived map is open, the editor navigates back to the library. `updateMindMap` is widened to a partial input `{ id, workspaceId, title?, description?, defaultView?, archivedAt? }` so rename and archive share it.

### 3. Editor (`map-editor-page.tsx`)

**Layout**

```
[← Maps]  Title (editable)        ● Saved      [+ Add node] [Arrange ▾] [Fit] [Details]
┌──────────────────────────────────────────────────────────┬────────────────┐
│                                                          │  Inspector     │
│                     canvas                               │  (docked,      │
│                                                          │   320px, lg+)  │
└──────────────────────────────────────────────────────────┴────────────────┘
[ hint strip: Double-click to add · Tab child · Enter sibling · Drag a handle to connect   ✕ ]
```

- The header is one 44px row on `surface-whisper`. The title is a borderless input that commits on blur/Enter and reverts on Escape; blank titles revert to the previous title.
- Save status is a small dot + label: **Saved** (slate), **Saving…** (cyan, the only glowing element in the header), **Couldn't save · Retry** (amber, Retry is a button). It is `aria-live="polite"`.
- Canvas height is `calc(100vh - 9.5rem)` with `min-h-[28rem]`; inside the project tab it is `calc(100vh - 14rem)` to allow for the project header and tab row.
- The inspector is a grid column (`lg:grid-cols-[minmax(0,1fr)_20rem]`) that appears when something is selected or the Details toggle is on; it never overlays the canvas at `lg` and above. Below `lg` it renders as the existing `surface-raised` right drawer with a close button.
- The hint strip renders only while the map has fewer than three nodes and until dismissed; dismissal is remembered in `localStorage` under `orbit-flo:maps-hints-dismissed`.
- Blank maps show a centred empty-canvas message ("Double-click anywhere to place your first idea") that disappears once a node exists.

**Toolbar actions**

- **Add node**: if a node is selected, creates a connected child (same as Tab). Otherwise places a node at the viewport centre (`screenToFlowPosition` of the canvas centre), nudged in 40px steps along a small spiral until it does not overlap an existing node's 200×40 box. The node is selected and enters rename.
- **Arrange ▾** (a small menu): **Radial**, **Left to right**, **Top down**, **By date**. Each calls a pure function in `map-layouts.ts` (replacing `applyViewLayout`) that returns new positions for every node, then applies them as one undoable graph change and fits the view.
  - Roots are the nodes with no incoming edge; if none, the node with the most edges. Children follow outgoing edges breadth-first; nodes unreachable from any root form their own trees placed after the first.
  - Radial: root at the centre, each depth on a ring 220px further out, siblings spread evenly within their parent's angular sector.
  - Left to right: 260px between depths, 90px between siblings. Top down: 150px between depths, 240px between siblings so 200px-wide labels never overlap. Subtrees stacked without overlap.
  - By date: dated nodes (start or due) on one row sorted ascending at 260px spacing; undated nodes on a second row 180px below in their existing left-to-right order.
- **Fit**: `fitView` with the existing options.
- **Details**: toggles the inspector open with whatever is selected (or the map's own title/description when nothing is).

**Keyboard** (handled on the canvas wrapper as today, ignored while an input has focus)

| Key | Action |
|---|---|
| Tab | connected child of the selected node |
| Enter | sibling of the selected node |
| Delete / Backspace | remove selected node (and its edges) or selected edge |
| Escape | clear selection, close inline rename |
| F2 or double-click | rename selected node |
| Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z | undo / redo |
| Ctrl/Cmd+S | flush pending autosave immediately (prevents the browser save dialog) |

**Undo/redo** is an in-memory stack of graph snapshots in `useMapEditor`, capped at 50, cleared when a different map opens. Drag moves push one entry on drag end, not per frame. Inline rename and inspector typing coalesce edits to the same field within 500ms into one entry.

**Edges** are selectable (`onEdgeClick`). A selected edge is highlighted, editable in the inspector, and deletable with Delete. Directional edges render an arrowhead marker; non-directional edges keep the current starlight gradient with no marker.

### 4. Inspector (`map-inspector.tsx`)

Three modes, chosen by what is selected:

**Node**

- Title (text), Type (select over `mapNodeTypes`, labelled: Idea, Task candidate, Note, Milestone, Decision, Option, Risk, Reference; changing it updates the glyph and accent immediately), Status (select: Open, Selected, Rejected, Archived; shows "Converted" read-only when converted), Notes (textarea), Start date, Due date, Tags (text input; comma or Enter adds a chip, ✕ removes).
- **Delete node** (secondary, at the bottom).
- **Convert** section with Task, Note, Milestone buttons. The only disabled reason left is "Choose a project map to convert to a task/milestone" on global maps. While a conversion runs all three are disabled.
- Converted nodes show "Converted to task" (or note / milestone) with an **Open** link: task → `/w/:ws/projects/:pid?task=<id>`, note → `/w/:ws/notes?note=<id>`, milestone → `/w/:ws/milestones/<id>`.
- Conversion flow: `await flush()` on the editor hook (sends any pending graph and waits for it), then `convertMindMapNode`. If the flush fails the conversion does not run and the save error is shown.

**Edge**

- Type (select over `mapEdgeTypes`: Association, Dependency, Sequence, Choice, Outcome), Label (text), Directional (switch), **Delete edge**.

**Map** (nothing selected, Details toggled on)

- Title and Description of the map, both autosaved through the same path.

### 5. Autosave (`use-map-editor.ts`)

`useMapEditor({ workspaceId, mapId })` owns everything the editor needs and is the only place that talks to the query module for graph writes.

- State: `graph`, `selected` (`{ kind: "node" | "edge", id } | null`), `status` (`"saved" | "saving" | "dirty" | "error"`), `error`, undo/redo stacks.
- `setGraph(next, { undoable = true })` updates state, pushes undo, marks dirty, and (re)starts an 800ms debounce timer.
- When the timer fires it calls `replaceMindMapGraph` with the latest graph. If a save is already in flight, the timer instead sets a `pending` flag; when the in-flight save settles, one more save runs with whatever is latest. Saves never queue deeper than one.
- On success: `status = "saved"`, and the server result is merged into local state **only for fields the server owns** (`convertedType/Id/At`); local positions and text are not overwritten, so a save landing mid-drag cannot jump nodes. The graph query cache is seeded with the merged graph. The list query is invalidated only when the title changed.
- On failure: `status = "error"`, local state is kept, and the save is retried after 2s, 6s, 18s. After the third failure it stays in `error` until the user presses Retry or edits again.
- `flush()` cancels the timer, runs a save now if dirty, and resolves when the latest save has settled. It is used by conversion, Ctrl+S, and unmount.
- Unmount / map change: `flush()` is fired (not awaited) so a route change still persists.
- `beforeunload` is registered only while `status` is `dirty`, `saving` or `error`.
- Opening a map: the graph query loads as today. The old `graphCache` / `dirtyMapIds` local-draft machinery is removed because autosave makes it unnecessary.

`default_view` is always sent as `"mind_map"`; the column and enum remain untouched.

### 6. Components and files

| File | Change |
|---|---|
| `maps-page.tsx` | Deleted. Replaced by the three pages below. |
| `map-library-page.tsx` | New: grid, cards, menu, empty state |
| `map-card.tsx` | New: one card with thumbnail, meta, overflow menu, inline rename |
| `new-map-dialog.tsx` | New: blank + template picker with title |
| `map-editor-page.tsx` | New: header, canvas, docked inspector, hint strip |
| `project-maps-tab.tsx` | New: `?map=` wrapper used by the project workspace |
| `use-map-editor.ts` | New: graph state, undo/redo, autosave, flush |
| `map-toolbar.tsx` | Rewritten: Add node, Arrange menu, Fit, Details, save status; no tabs, no Save |
| `map-inspector.tsx` | Rewritten: node / edge / map modes |
| `map-canvas.tsx` | Edge selection, arrow markers for directional edges, Delete handling for edges, exposes `fitView` and viewport-centre placement via a ref; keeps dblclick/Tab/Enter |
| `map-layouts.ts` | `applyViewLayout` replaced by `arrangeRadial`, `arrangeLeftToRight`, `arrangeTopDown`, `arrangeByDate`, plus `placeNewNode` |
| `map-graph-ops.ts` | Adds `deleteNode`, `deleteEdge`, `updateEdge`; existing helpers unchanged |
| `maps.queries.ts` | Adds `listMindMapPreviews`, `archiveMindMap`, `duplicateMindMap`; `updateMindMap` takes a partial |
| `map-library-panel.tsx` | Deleted; the template list moves into the dialog |
| `map-template-thumbnail.tsx` | Adds a `size` prop (`"sm"` 96×52, `"md"` 160×90) |
| `routes.tsx`, `route-loaders.ts` | `/maps/:mapId` redirect, `maps/:mapId` editor route, loaders for the two pages |
| `project-workspace-page.tsx` | Maps tab renders `ProjectMapsTab`; `activeTab` initialises from `?map=` |
| `command-palette.tsx`, `app-shell.tsx`, `mobile-more-sheet.tsx` | No change (still point at `/maps`) |
| `orbit-flo-visual-review.tsx`, `orbit-flo-visual-fixtures.ts` | `02-maps-library` becomes the card grid; `03-maps-mind-map` becomes the editor with the docked inspector open |
| `styles.css` | Card, menu, hint strip, selected-edge and arrowhead styles; the tab styles go |

Everything lives under `src/features/maps/` except the route and project-page edits.

### 7. Visual language

Follows the approved Deep Space Observatory rules: cards on `surface-primary`, the dialog and mobile drawer on `surface-raised`, the editor header on `surface-whisper`. Cyan is reserved for the active/interactive element: the selected node, the "Saving…" dot, focus rings. Violet stays ambient. No new motion beyond `orbit-page-enter` on the library and a Dock pulse on the save status when a save lands. Uppercase micro-labels appear only on the hint strip's key caps.

### 8. Error handling

| Situation | Behaviour |
|---|---|
| Library list fails | `EmptyState` with the error and a Retry |
| Previews fail | Cards render without thumbnails; no error shown |
| Create fails at step 1 | Error in the dialog, nothing created |
| Create fails at step 2 | Map archived, error in the dialog |
| Graph load fails | `EmptyState` in the canvas slot with Retry and a back link |
| Autosave fails | Amber status, local edits kept, three retries, manual Retry |
| Conversion flush fails | Conversion not attempted; save error shown in the inspector |
| Conversion RPC fails | Node stays unconverted; error under the Convert buttons |
| Archive fails | `InlineAlert` on the library; card stays |

### 9. Testing

Each new file gets a colocated test, following the existing pattern (Vitest + Testing Library, Supabase client mocked).

- `use-map-editor.test.ts`: debounce fires once for rapid edits; a second edit during an in-flight save produces exactly one follow-up save with the latest graph; `flush()` resolves after the save settles; failure sets `error`, keeps local graph, retries on the schedule; undo/redo round-trip; cap at 50; server `converted*` fields merge without overwriting local positions.
- `map-library-page.test.tsx`: renders cards with node counts; New map → template → Create calls create then replace with the template's node count and navigates; Rename commits on Enter and reverts on Escape; Archive calls `archiveMindMap` and removes the card; empty state shows the feature strip.
- `map-editor-page.test.tsx`: Add node with nothing selected places at the viewport centre and enters rename; with a node selected it creates a connected child; Arrange → Left to right changes positions and is undoable; Delete removes a selected edge; Ctrl+S calls flush; the hint strip hides after dismissal and when nodes ≥ 3; Convert awaits flush before calling the RPC.
- `map-inspector.test.tsx`: type change updates the node; tags add/remove; edge mode edits type/label/directional; converted node shows the right Open link per type.
- `map-layouts.test.ts`: each arrange function is deterministic, handles cycles and disconnected nodes, and produces no overlapping positions for the templates; `placeNewNode` avoids occupied boxes.
- `maps.queries.test.ts`: previews are grouped by map id; archive sets `archived_at`; duplicate creates fresh ids.
- `project-workspace-page.test.tsx`: `?map=` on mount opens the Maps tab.
- `App.test.tsx`: the new lazy pages are stubbed where the shell test needs them (CI has no Supabase env; see the CI env gotcha).
- `orbit-flo-visual-review` fixtures: the capture harness's `createVisualQueryClient` seeds the new list, previews and graph queries so the zero-Supabase-calls assertion holds.

Commands (from the worktree):

```bash
npm test -- src/features/maps src/features/projects/project-workspace-page.test.tsx src/App.test.tsx
```

```bash
npm run build
```

Visual verification through the fixture route at 1440×900 and 390×844.

## Open questions

None. Decisions above are final for this iteration.
