# Maps UX Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Compact scrollable template gallery with live SVG thumbnails, saved maps in an always-visible "Open map…" dropdown, tight right-column spacing, node shapes by type, and richer premade templates.

**Architecture:** A pure `nodeShape(nodeType)` helper drives both the new StarNode glyphs and (via `nodeAccentColor`) the `TemplateThumbnail` SVG that renders each template's real nodes/edges. The library panel slims to templates-only; the saved-maps list becomes a `<select>` in the middle column's top row (spec amendment: the toolbar only exists when a map is open, so the select lives beside it in `maps-page.tsx`, not inside `MapToolbar`).

**Tech Stack:** React 19, `src/styles.css`, vitest + testing-library.

**Spec:** `docs/superpowers/specs/2026-07-08-maps-ux-refresh-design.md`

## Global Constraints

- Work in `C:\src\Personal\ToDo\.worktrees\project-command-center` on `codex/project-command-center`.
- Template IDs and titles unchanged. No changes to save/convert/query logic or `map-layouts.ts`.
- Keep test-asserted markers: template button accessible names (title + description text), `data-testid="star-node-root"`, `orbit-constellation-canvas`.
- `npm test` green after every task (`--maxWorkers=2` under load). Commit after every task.

---

### Task 1: `nodeShape` helper

**Files:**
- Modify: `src/features/maps/map-graph-ops.ts`
- Modify: `src/features/maps/map-graph-ops.test.ts`

**Interfaces:**
- Produces: `nodeShape(nodeType: MindMapNodeType): "dot" | "planet" | "diamond" | "triangle" | "card" | "ring"` and `export type NodeShape`.

- [ ] **Step 1: Write the failing test** — append to `map-graph-ops.test.ts`:

```ts
describe("nodeShape", () => {
  it("maps node types onto distinct glyph shapes", () => {
    expect(nodeShape("idea")).toBe("dot");
    expect(nodeShape("task_candidate")).toBe("dot");
    expect(nodeShape("milestone")).toBe("planet");
    expect(nodeShape("decision")).toBe("diamond");
    expect(nodeShape("risk")).toBe("triangle");
    expect(nodeShape("note")).toBe("card");
    expect(nodeShape("reference")).toBe("card");
    expect(nodeShape("option")).toBe("ring");
  });
});
```

Add `nodeShape` to the import line.

- [ ] **Step 2:** Run `npx vitest run src/features/maps/map-graph-ops.test.ts` → FAIL.

- [ ] **Step 3: Implement** — append to `map-graph-ops.ts`:

```ts
export type NodeShape = "dot" | "planet" | "diamond" | "triangle" | "card" | "ring";

const shapeByNodeType: Record<MindMapNodeType, NodeShape> = {
  idea: "dot",
  task_candidate: "dot",
  milestone: "planet",
  decision: "diamond",
  risk: "triangle",
  note: "card",
  reference: "card",
  option: "ring",
};

export function nodeShape(nodeType: MindMapNodeType): NodeShape {
  return shapeByNodeType[nodeType];
}
```

- [ ] **Step 4:** Run the test file → PASS.
- [ ] **Step 5:** `git add src/features/maps/map-graph-ops.ts src/features/maps/map-graph-ops.test.ts && git commit -m "Add node shape mapping for map glyphs"`

---

### Task 2: StarNode shape glyphs

**Files:**
- Modify: `src/features/maps/map-star-node.tsx`
- Modify: `src/features/maps/map-star-node.test.tsx`
- Modify: `src/features/maps/map-canvas.tsx` (thread `shape` into node data)
- Modify: `src/styles.css`

**Interfaces:**
- `StarNodeData` gains `shape: NodeShape` (import type from `./map-graph-ops`). `map-canvas.tsx`'s `toFlowNode` sets `shape: nodeShape(node.nodeType)`.

- [ ] **Step 1: Write the failing tests** — in `map-star-node.test.tsx`, add `shape: "dot"` to the `data()` factory defaults, then append:

```tsx
  it("renders a glyph per shape", () => {
    const { rerender } = render(<StarNode data={data({ shape: "diamond", accent: "violet" })} />);
    expect(screen.getByTestId("star-glyph")).toHaveClass("star-glyph-diamond");

    rerender(<StarNode data={data({ shape: "triangle", accent: "violet" })} />);
    expect(screen.getByTestId("star-glyph")).toHaveClass("star-glyph-triangle");

    rerender(<StarNode data={data({ shape: "planet" })} />);
    expect(screen.getByTestId("star-glyph")).toHaveClass("star-glyph-planet");

    rerender(<StarNode data={data({ shape: "card", accent: "blue" })} />);
    expect(screen.getByTestId("star-glyph")).toHaveClass("star-glyph-card");

    rerender(<StarNode data={data({ shape: "ring", accent: "blue" })} />);
    expect(screen.getByTestId("star-glyph")).toHaveClass("star-glyph-ring");

    rerender(<StarNode data={data({ shape: "dot" })} />);
    expect(screen.getByTestId("star-glyph")).toHaveClass("star-dot");
  });
```

Existing tests referencing `star-dot`: the first test's `getByTestId("star-dot")` assertions change to `getByTestId("star-glyph")` (same classes asserted: `star-dot-cyan` etc. stay for `dot` shape).

- [ ] **Step 2:** Run `npx vitest run src/features/maps/map-star-node.test.tsx` → FAIL.

- [ ] **Step 3: Implement** — in `map-star-node.tsx`:

Add to the type: `shape: NodeShape;` with `import type { NodeShape } from "./map-graph-ops";`

Replace the glyph span (`<span ... className={clsx("star-dot", ...)} data-testid="star-dot" />`) with:

```tsx
      <span
        aria-hidden="true"
        className={clsx(
          data.shape === "dot" && ["star-dot", `star-dot-${data.accent}`],
          data.shape !== "dot" && [`star-glyph-${data.shape}`, `star-glyph-${data.accent}`],
        )}
        data-testid="star-glyph"
      />
```

In `map-canvas.tsx`, add `nodeShape` to the `./map-graph-ops` import and set `shape: nodeShape(node.nodeType),` inside `toFlowNode`'s `data`.

In `src/styles.css` after `.star-dot-violet`:

```css
.star-glyph-cyan {
  --glyph-color: #67e8f9;
  --glyph-glow: rgba(103, 232, 249, 0.7);
}

.star-glyph-blue {
  --glyph-color: #60a5fa;
  --glyph-glow: rgba(96, 165, 250, 0.7);
}

.star-glyph-violet {
  --glyph-color: #a78bfa;
  --glyph-glow: rgba(167, 139, 250, 0.7);
}

.star-glyph-planet {
  position: relative;
  height: 0.7rem;
  width: 0.7rem;
  flex-shrink: 0;
  border-radius: 999px;
  background: radial-gradient(circle at 35% 30%, #a5f3fc, #0891b2 70%);
  box-shadow: 0 0 8px var(--glyph-glow);
}

.star-glyph-planet::after {
  content: "";
  position: absolute;
  left: 50%;
  top: 50%;
  height: 0.3rem;
  width: 1.05rem;
  border: 1px solid rgba(165, 243, 252, 0.7);
  border-radius: 999px;
  transform: translate(-50%, -50%) rotate(-24deg);
}

.star-glyph-diamond {
  height: 0.55rem;
  width: 0.55rem;
  flex-shrink: 0;
  background: var(--glyph-color);
  box-shadow: 0 0 8px var(--glyph-glow);
  transform: rotate(45deg);
}

.star-glyph-triangle {
  height: 0.6rem;
  width: 0.68rem;
  flex-shrink: 0;
  background: var(--glyph-color);
  clip-path: polygon(50% 0%, 0% 100%, 100% 100%);
  filter: drop-shadow(0 0 4px var(--glyph-glow));
}

.star-glyph-card {
  height: 0.5rem;
  width: 0.68rem;
  flex-shrink: 0;
  border: 1.5px solid var(--glyph-color);
  border-radius: 2px;
  box-shadow: 0 0 6px var(--glyph-glow);
}

.star-glyph-ring {
  height: 0.55rem;
  width: 0.55rem;
  flex-shrink: 0;
  border: 1.5px solid var(--glyph-color);
  border-radius: 999px;
  box-shadow: 0 0 6px var(--glyph-glow);
}
```

- [ ] **Step 4:** Run `npx vitest run src/features/maps` → all PASS (canvas tests unaffected: node buttons render labels via the mock).
- [ ] **Step 5:** `git add src/features/maps/map-star-node.tsx src/features/maps/map-star-node.test.tsx src/features/maps/map-canvas.tsx src/styles.css && git commit -m "Render map node glyphs by node type"`

---

### Task 3: TemplateThumbnail + compact template gallery

**Files:**
- Create: `src/features/maps/map-template-thumbnail.tsx`
- Create: `src/features/maps/map-template-thumbnail.test.tsx`
- Modify: `src/features/maps/map-library-panel.tsx` (templates-only rework)
- Modify: `src/features/maps/maps-page.tsx` (drop `maps`/`selectedMapId`/`onPreviewMap`/`onSelectMap` props from the panel)

**Interfaces:**
- Produces: `TemplateThumbnail({ nodes, edges })` where nodes are `Array<{ id: string; position: {x,y}; nodeType: MindMapNodeType }>` and edges `Array<{ id: string; sourceNodeId: string; targetNodeId: string }>`; renders an aria-hidden 96×52 SVG.
- `MapLibraryPanel` props shrink to `{ isCreating, onCreateBlank, onCreateFromTemplate }`.

- [ ] **Step 1: Write the failing test** — create `map-template-thumbnail.test.tsx`:

```tsx
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { mapTemplates } from "./map-templates";
import { TemplateThumbnail } from "./map-template-thumbnail";

describe("TemplateThumbnail", () => {
  it("renders one dot per node and one line per edge", () => {
    const template = mapTemplates[0];
    const { container } = render(<TemplateThumbnail edges={template.edges} nodes={template.nodes} />);

    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(container.querySelectorAll("circle")).toHaveLength(template.nodes.length);
    expect(container.querySelectorAll("line")).toHaveLength(template.edges.length);
  });

  it("renders a single node without dividing by zero", () => {
    const { container } = render(
      <TemplateThumbnail
        edges={[]}
        nodes={[{ id: "solo", position: { x: 5, y: 5 }, nodeType: "idea" }]}
      />,
    );

    const circle = container.querySelector("circle");
    expect(circle?.getAttribute("cx")).toBe("48");
  });
});
```

Note: `mapTemplates` is typed with full nodes; the component accepts a structural subset so templates pass directly.

- [ ] **Step 2:** Run it → FAIL (module not found).

- [ ] **Step 3: Implement** — create `map-template-thumbnail.tsx`:

```tsx
import type { MindMapNodeType } from "../../lib/supabase/database.types";
import { nodeAccentColor } from "./map-graph-ops";

const accentHex = { cyan: "#67e8f9", blue: "#60a5fa", violet: "#a78bfa" } as const;

type ThumbnailNode = { id: string; position: { x: number; y: number }; nodeType: MindMapNodeType };
type ThumbnailEdge = { id: string; sourceNodeId: string; targetNodeId: string };

const WIDTH = 96;
const HEIGHT = 52;
const PAD = 8;

export function TemplateThumbnail({ edges, nodes }: { edges: ThumbnailEdge[]; nodes: ThumbnailNode[] }) {
  const xs = nodes.map((node) => node.position.x);
  const ys = nodes.map((node) => node.position.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanX = Math.max(maxX - minX, 1);
  const spanY = Math.max(maxY - minY, 1);

  const scaled = new Map(
    nodes.map((node) => [
      node.id,
      {
        x: PAD + ((node.position.x - minX) / spanX) * (WIDTH - PAD * 2),
        y: PAD + ((node.position.y - minY) / spanY) * (HEIGHT - PAD * 2),
        color: accentHex[nodeAccentColor(node.nodeType)],
      },
    ]),
  );

  return (
    <svg
      aria-hidden="true"
      className="h-[3.25rem] w-24 shrink-0 rounded-md border border-slate-400/10 bg-slate-950/60"
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      xmlns="http://www.w3.org/2000/svg"
    >
      {edges.map((edge) => {
        const source = scaled.get(edge.sourceNodeId);
        const target = scaled.get(edge.targetNodeId);
        if (!source || !target) return null;
        return (
          <line
            key={edge.id}
            stroke="rgba(103, 232, 249, 0.35)"
            strokeWidth="1"
            x1={source.x}
            x2={target.x}
            y1={source.y}
            y2={target.y}
          />
        );
      })}
      {nodes.map((node) => {
        const point = scaled.get(node.id);
        if (!point) return null;
        return <circle cx={point.x} cy={point.y} fill={point.color} key={node.id} r="3" />;
      })}
    </svg>
  );
}
```

(Single node: span clamps to 1 → position maps to PAD… test expects `cx="48"`. Fix: when `maxX === minX`, center instead: use `const centerFallback = spanX === 1 && maxX === minX;` — implement as: `x: maxX === minX ? WIDTH / 2 : PAD + ...` and `y: maxY === minY ? HEIGHT / 2 : PAD + ...`.)

- [ ] **Step 4: Rework the library panel** — replace the full contents of `map-library-panel.tsx`:

```tsx
import { Plus } from "lucide-react";
import { memo } from "react";
import { mapTemplates } from "./map-templates";
import { TemplateThumbnail } from "./map-template-thumbnail";

type MapLibraryPanelProps = {
  isCreating: boolean;
  onCreateBlank: () => void;
  onCreateFromTemplate: (templateId: string) => void;
};

export const MapLibraryPanel = memo(function MapLibraryPanel({
  isCreating,
  onCreateBlank,
  onCreateFromTemplate,
}: MapLibraryPanelProps) {
  return (
    <aside className="surface-whisper sticky top-6 grid gap-3 self-start rounded-xl p-3">
      <button
        type="button"
        className="orbit-button-secondary justify-center text-xs"
        disabled={isCreating}
        onClick={onCreateBlank}
      >
        <Plus className="h-4 w-4" aria-hidden="true" />
        New blank map
      </button>

      <p className="px-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Templates</p>
      <div className="grid max-h-[calc(100vh-16rem)] content-start gap-1.5 overflow-y-auto pr-1">
        {mapTemplates.map((template) => (
          <button
            key={template.id}
            type="button"
            className="flex items-center gap-2.5 rounded-lg border border-transparent p-2 text-left transition hover:border-cyan-300/25 hover:bg-slate-900/50 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isCreating}
            onClick={() => onCreateFromTemplate(template.id)}
          >
            <TemplateThumbnail edges={template.edges} nodes={template.nodes} />
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-white">{template.title}</span>
              <span className="mt-0.5 block truncate text-xs text-slate-400">{template.description}</span>
            </span>
          </button>
        ))}
      </div>
    </aside>
  );
});
```

In `maps-page.tsx`, update the `<MapLibraryPanel ... />` call to pass only `isCreating`, `onCreateBlank`, `onCreateFromTemplate` (delete the `maps`, `selectedMapId`, `onPreviewMap`, `onSelectMap` lines — `handlePreviewMap` becomes unused ONLY if nothing else references it; it is re-consumed in Task 4's dropdown, so leave the function in place).

- [ ] **Step 5:** Run `npx vitest run src/features/maps` → maps-page tests that clicked a SAVED map by title (e.g., "opens the inspector drawer") will FAIL — that's expected until Task 4 adds the dropdown; if so, proceed to Task 4 before committing, then commit Tasks 3+4 together. If all pass (no saved-map test isolated), commit now:

`git add src/features/maps && git commit -m "Compact template gallery with live thumbnails"`

---

### Task 4: Open-map dropdown + tight right column

**Files:**
- Modify: `src/features/maps/maps-page.tsx`
- Modify: `src/features/maps/map-toolbar.tsx` (compact styling only)
- Modify: `src/features/maps/map-canvas.tsx` (drop outer section wrapper)
- Modify: `src/features/maps/maps-page.test.tsx`

**Interfaces:**
- The select: `<select aria-label="Open map">` with placeholder option "Open map…", options = saved maps, `value={selectedMapId ?? ""}`, onChange → existing `handleSelectMap`; `onFocus` → prefetch each map via existing `handlePreviewMap`.

- [ ] **Step 1: Restructure the middle column in `maps-page.tsx`** — replace the middle `<section className="grid min-w-0 gap-3">...</section>` content with:

```tsx
        <section className="grid min-w-0 content-start gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Open map"
              className="orbit-input max-w-56 px-2.5 py-1.5 text-xs"
              onChange={(event) => {
                if (event.target.value) handleSelectMap(event.target.value);
              }}
              onFocus={() => maps.forEach((item) => handlePreviewMap(item.id))}
              value={selectedMapId ?? ""}
            >
              <option value="">Open map…</option>
              {maps.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title}
                </option>
              ))}
            </select>
            {editableGraph ? (
              <MapToolbar
                activeView={editableGraph.defaultView}
                hasSelection={Boolean(selectedNode)}
                isDirty={isDirty}
                isSaving={isSavingMap}
                onAddNode={handleAddNode}
                onOpenDetails={() => setIsInspectorOpen(true)}
                onSave={handleSave}
                onViewChange={handleViewChange}
              />
            ) : null}
          </div>

          {draftMessage ? (
            <p className="rounded-md border border-cyan-400/30 bg-cyan-400/10 px-3 py-2 text-sm text-cyan-100">{draftMessage}</p>
          ) : null}

          {mapsQuery.isPending ? (
            <EmptyState isLoading title="Loading map library" message="Fetching visual plans." />
          ) : mapsQuery.isError ? (
            <EmptyState title="Could not load maps" message={mapsQuery.error.message} />
          ) : isCreatingMap ? (
            <EmptyState isLoading title="Creating map draft..." message="Preparing the editable map workspace." />
          ) : isSelectedGraphLoading ? (
            <EmptyState isLoading title="Loading map graph" message="Opening the saved nodes and connections." />
          ) : selectedGraphQuery.isError && selectedMapId && !editableGraph ? (
            <EmptyState title="Could not load map graph" message={selectedGraphQuery.error.message} />
          ) : editableGraph ? (
            <MapCanvas
              graph={editableGraph}
              selectedNodeId={selectedNodeId}
              view={editableGraph.defaultView}
              onChange={handleGraphChange}
              onSelectNode={setSelectedNodeId}
            />
          ) : (
            <EmptyState
              title="Choose a visual plan"
              message="Start a blank map or pick a template to open the planning canvas."
            />
          )}
          {createMapMutation.isError ? (
            <InlineAlert tone="error">{createMapMutation.error.message}</InlineAlert>
          ) : null}
          {saveMapMutation.isError ? (
            <InlineAlert tone="error">{saveMapMutation.error.message}</InlineAlert>
          ) : null}
        </section>
```

(This chains the status states with `:` so exactly ONE box renders — no stacking. The old `MapToolbar` block above `MapCanvas` and the separate pending/error paragraphs are replaced by this structure. The page header keeps `h1` but delete the eyebrow `<p className="text-sm font-medium uppercase tracking-wide text-cyan-300">Maps</p>`.)

- [ ] **Step 2: Compact the toolbar** — in `map-toolbar.tsx`, change the wrapper to `className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 bg-slate-950/60 p-2"`; view-tab buttons to `px-2.5 py-1.5 text-xs font-medium`; the three action buttons to `px-2.5 py-1.5 text-xs`; the dirty label to `text-xs`.

- [ ] **Step 3: Drop the canvas wrapper** — in `map-canvas.tsx`, replace the returned JSX's outer `<section className="grid min-h-[520px] gap-3">` + inner div with a single root div (keep all handlers/attributes), className `"orbit-constellation-canvas h-[max(30rem,calc(100vh-19rem))] overflow-hidden rounded-lg border border-white/10 bg-slate-950/60"`.

- [ ] **Step 4: Update tests** — in `maps-page.test.tsx`, the drawer test's saved-map click `await user.click(await screen.findByRole("button", { name: "Feature plan" }));` becomes:

```tsx
    await user.selectOptions(await screen.findByLabelText("Open map"), "map-1");
```

Run `npx vitest run src/features/maps` and fix any other test that clicked a saved map (not template) button the same way; template-card clicks (regex names including description text) are untouched.

- [ ] **Step 5:** Full check `npx vitest run src/features/maps && npm run build` → PASS. Commit:

`git add src/features/maps && git commit -m "Move saved maps to toolbar dropdown and tighten maps layout"`

---

### Task 5: Richer premade templates

**Files:**
- Modify: `src/features/maps/map-templates.ts` (replace `templateCatalog` bodies; IDs/titles/defaultViews unchanged)

- [ ] **Step 1: Replace the six template definitions** with richer graphs (keep `node()`/`edge()` helpers):

```ts
const templateCatalog: MapTemplate[] = [
  {
    id: "feature-plan",
    title: "Feature plan",
    description: "Shape a feature from idea through launch readiness.",
    defaultView: "mind_map",
    nodes: [
      node("feature", "Feature", 0, 0, "idea"),
      node("requirements", "Requirements", 300, -160, "note"),
      node("users", "Target users", 340, 0, "reference"),
      node("scope", "Scope cuts", 300, 160, "decision"),
      node("tasks", "Task breakdown", -300, 160, "task_candidate"),
      node("risks", "Risks", -340, 0, "risk"),
      node("metrics", "Success metrics", -300, -160, "note"),
      node("launch", "Launch plan", 0, -240, "milestone"),
    ],
    edges: [
      edge("feature-requirements", "feature", "requirements"),
      edge("feature-users", "feature", "users"),
      edge("feature-scope", "feature", "scope"),
      edge("feature-tasks", "feature", "tasks"),
      edge("feature-risks", "feature", "risks"),
      edge("feature-metrics", "feature", "metrics"),
      edge("feature-launch", "feature", "launch"),
    ],
  },
  {
    id: "bug-investigation",
    title: "Bug investigation",
    description: "Track a bug from symptom to verified fix.",
    defaultView: "flowchart",
    nodes: [
      node("symptom", "Symptom report", 0, 0, "note"),
      node("reproduce", "Reproduce reliably", 240, 0, "task_candidate"),
      node("hypothesis", "Root-cause hypothesis", 480, 0, "idea"),
      node("evidence", "Evidence & logs", 720, 0, "reference"),
      node("fix", "Fix", 960, 0, "task_candidate"),
      node("verify", "Verify in prod", 1200, 0, "milestone"),
      node("regression", "Regression test", 960, 180, "task_candidate"),
    ],
    edges: [
      edge("symptom-reproduce", "symptom", "reproduce", "sequence"),
      edge("reproduce-hypothesis", "reproduce", "hypothesis", "sequence"),
      edge("hypothesis-evidence", "hypothesis", "evidence", "sequence"),
      edge("evidence-fix", "evidence", "fix", "sequence"),
      edge("fix-verify", "fix", "verify", "sequence"),
      edge("fix-regression", "fix", "regression"),
    ],
  },
  {
    id: "launch-flow",
    title: "Launch flow",
    description: "Coordinate launch steps, dependencies, approvals, and follow-up.",
    defaultView: "flowchart",
    nodes: [
      node("checklist", "Launch checklist", 0, 0, "task_candidate"),
      node("dependencies", "Dependencies clear", 250, 0, "reference"),
      node("approval", "Go / no-go", 500, 0, "decision"),
      node("deploy", "Deploy", 750, 0, "milestone"),
      node("announce", "Announce", 1000, 0, "task_candidate"),
      node("follow-up", "Follow-up review", 1250, 0, "note"),
      node("rollback", "Rollback plan", 750, 180, "risk"),
    ],
    edges: [
      edge("checklist-dependencies", "checklist", "dependencies", "sequence"),
      edge("dependencies-approval", "dependencies", "approval", "sequence"),
      edge("approval-deploy", "approval", "deploy", "sequence"),
      edge("deploy-announce", "deploy", "announce", "sequence"),
      edge("announce-follow-up", "announce", "follow-up", "sequence"),
      edge("deploy-rollback", "deploy", "rollback"),
    ],
  },
  {
    id: "product-roadmap",
    title: "Product roadmap",
    description: "Plan product themes, milestones, and candidate tasks over time.",
    defaultView: "timeline",
    nodes: [
      node("theme", "Theme", 0, 0, "idea"),
      node("now", "Now", 260, -120, "milestone"),
      node("next", "Next", 520, 0, "milestone"),
      node("later", "Later", 780, 120, "milestone"),
      node("candidates", "Candidate tasks", 1040, 0, "task_candidate"),
      node("bets", "Open bets", 520, 200, "option"),
    ],
    edges: [
      edge("theme-now", "theme", "now", "sequence"),
      edge("now-next", "now", "next", "sequence"),
      edge("next-later", "next", "later", "sequence"),
      edge("later-candidates", "later", "candidates", "sequence"),
      edge("next-bets", "next", "bets"),
    ],
  },
  {
    id: "decision-tree",
    title: "Decision tree",
    description: "Compare options and track outcomes from a decision point.",
    defaultView: "decision_tree",
    nodes: [
      node("decision", "Decision", 0, 0, "decision"),
      node("option-a", "Option A", 300, -160, "option"),
      node("option-b", "Option B", 300, 0, "option"),
      node("option-c", "Option C", 300, 160, "option"),
      node("outcome-a", "Outcome if A", 620, -80, "milestone"),
      node("outcome-b", "Outcome if B/C", 620, 100, "milestone"),
    ],
    edges: [
      edge("decision-option-a", "decision", "option-a", "choice"),
      edge("decision-option-b", "decision", "option-b", "choice"),
      edge("decision-option-c", "decision", "option-c", "choice"),
      edge("option-a-outcome-a", "option-a", "outcome-a", "outcome"),
      edge("option-b-outcome-b", "option-b", "outcome-b", "outcome"),
      edge("option-c-outcome-b", "option-c", "outcome-b", "outcome"),
    ],
  },
  {
    id: "meeting-brainstorm",
    title: "Meeting brainstorm",
    description: "Capture a meeting topic, decisions, and follow-up actions.",
    defaultView: "mind_map",
    nodes: [
      node("topic", "Topic", 0, 0, "idea"),
      node("ideas", "Ideas", 280, -150, "idea"),
      node("decisions", "Decisions", 320, 30, "decision"),
      node("actions", "Actions", 280, 200, "task_candidate"),
      node("questions", "Open questions", -300, 30, "note"),
    ],
    edges: [
      edge("topic-ideas", "topic", "ideas"),
      edge("topic-decisions", "topic", "decisions"),
      edge("topic-actions", "topic", "actions"),
      edge("topic-questions", "topic", "questions"),
    ],
  },
];
```

- [ ] **Step 2:** Run `npx vitest run src/features/maps` → PASS (tests reference template titles and the "Requirements" node of feature-plan — kept; the "Feature" node id/title in bug tests: check `fireEvent.click(await screen.findByText("Feature"))` — feature-plan's root node keeps id `feature`, title "Feature" ✔).
- [ ] **Step 3:** `git add src/features/maps/map-templates.ts && git commit -m "Enrich map templates with premade structures"`

---

### Task 6: Verification

- [ ] **Step 1:** `npx vitest run --maxWorkers=2` → all green.
- [ ] **Step 2:** `npm run build` → exit 0.
- [ ] **Step 3:** Fake-session screenshot of `/maps` (template gallery thumbnails; open a template → compact toolbar row, glyph variety, no stacked boxes).
- [ ] **Step 4:** Commit polish if needed as `Polish maps layout after visual verification`.

## Self-Review (completed)

- **Spec coverage:** compact scrollable gallery ✔ (T3), thumbnails from real data ✔ (T3), saved maps dropdown ✔ (T4, amended location), stacked boxes → single slot ✔ (T4), compact toolbar ✔ (T4), canvas wrapper removal ✔ (T4), shapes by type ✔ (T1–T2), richer templates ✔ (T5).
- **Type consistency:** `NodeShape` shared T1→T2; `TemplateThumbnail` props match template data shape; toolbar props unchanged from Phase 4.
- **Placeholders:** none; single-node thumbnail edge case handled explicitly.
