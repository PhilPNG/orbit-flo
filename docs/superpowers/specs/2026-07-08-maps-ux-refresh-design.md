# Maps UX Refresh

**Date:** 2026-07-08
**Branch:** `codex/project-command-center`
**Status:** Approved by user

## Problem

The Maps page's left column stacks a large header, a create button, the saved-maps list, and text-only template cards — too dense, not scrollable on its own. After selecting a map, the right column opens with oversized boxes (stacked status panels above the toolbar, a padded two-row toolbar, a fixed-height canvas wrapper). Templates all render identical star-dot nodes and their cards don't show what they create.

## Goals

- Left column: compact, templates-only, separately scrollable, each card showing its structure.
- Right column: tight vertical rhythm from header to canvas; saved maps reachable from the toolbar.
- Templates visually distinct: node shapes by type on canvas, live structure thumbnails on cards, richer premade starter content.

## Design

### 1. Template gallery (left panel)

`map-library-panel.tsx` becomes a compact template gallery:
- Slim "New blank map" button at top (secondary style, not a big cyan block).
- Template list: `overflow-y-auto` with a viewport-based max height (`max-h-[calc(100vh-14rem)]`), panel `self-start sticky top-6`.
- Card layout: `TemplateThumbnail` (left, ~96×52 SVG) + title + one truncated description line; padding `p-2.5`.
- Saved-maps list and the "Visual plans / Map library" header are removed from the panel.

`TemplateThumbnail` (new `map-template-thumbnail.tsx`): pure component taking a template's nodes/edges; normalizes node positions into a 96×52 viewBox (padding 8), draws edges as 1px lines (`rgba(103,232,249,0.35)`) and nodes as 3px-radius dots colored by `nodeAccentColor(nodeType)` (cyan `#67e8f9`, blue `#60a5fa`, violet `#a78bfa`). Because it renders real template data, every card's preview is automatically distinct and truthful.

### 2. Right column

- `maps-page.tsx`: the `mapsQuery.isPending` / `isError`, `isCreatingMap`, graph-loading, and "Choose a visual plan" EmptyStates render inside the canvas slot (below the toolbar or in its place when no toolbar), never stacked above it. Page header shrinks: eyebrow removed, `h1` stays.
- `map-toolbar.tsx`: one compact row (`p-2`, `gap-2`): view tabs as a small segmented control (`text-xs`), an **"Open map…" `<select>`** listing saved maps (value = selected map id; `aria-label="Open map"`; changing it calls the existing `onSelectMap`; hover-prefetch preserved via `onFocus` prefetching all is dropped — prefetch happens on select), then Add node / Details / Save (compact, `px-2.5 py-1.5 text-xs`), dirty state as a small dot + label.
  - New props: `maps: MindMap[]`, `selectedMapId: string | null`, `onSelectMap: (id: string) => void` (moved from the library panel).
- `map-canvas.tsx`: remove the outer `<section className="grid min-h-[520px] gap-3">`; the canvas div becomes the root with `h-[max(30rem,calc(100vh-19rem))]`.

### 3. Distinct templates

**Node shapes by type** (`map-star-node.tsx` + CSS): the leading glyph is chosen by a new `shape` field in `StarNodeData` (derived in `map-canvas.tsx` via a `nodeShape(nodeType)` helper in `map-graph-ops.ts`):
| nodeType | shape | rendering |
|---|---|---|
| idea, task_candidate | `dot` | current glowing dot |
| milestone | `planet` | small planet + ring (reuse `star-planet-badge` styling as a leading glyph, cyan-tinted) |
| decision | `diamond` | 45°-rotated square, violet |
| risk | `triangle` | CSS clip-path triangle, violet |
| note, reference | `card` | 8×6 rounded rectangle outline, blue |
| option | `ring` | hollow circle, blue |
The converted planet badge stays as the trailing element; accent colors keep the existing `nodeAccentColor` rule.

**Richer premade content** (`map-templates.ts`, IDs and titles unchanged):
- `feature-plan` (mind_map): Feature → Requirements, Target users, Scope cuts, Risks, Task breakdown, Success metrics, Launch plan (radial, 8 nodes).
- `bug-investigation` (flowchart): Symptom → Reproduce → Hypothesis → Evidence → Fix → Verify, plus a "Regression test" branch off Fix (7 nodes).
- `launch-flow` (flowchart): Checklist → Dependencies → Approval → Deploy → Announce → Follow-up, plus "Rollback plan" branch off Deploy (7 nodes).
- `product-roadmap` (timeline): Theme → Now / Next / Later milestones → Candidate tasks (6 nodes, staggered rows).
- `decision-tree` (decision_tree): Decision → Option A / Option B / Option C → Outcome A / Outcome B (6 nodes).
- `meeting-brainstorm` (mind_map): Topic → Ideas, Decisions, Actions, Open questions (radial, 5 nodes).

## Testing

- `map-template-thumbnail.test.tsx`: renders one dot per node and one line per edge for a given template.
- `map-star-node.test.tsx`: shape glyph per nodeType (diamond for decision, triangle for risk, etc.).
- `maps-page.test.tsx`: saved-map selection updated to the toolbar dropdown; template creation flows unchanged (titles stable).
- Visual verification via dev-server screenshots.

## Non-goals

- No changes to save/convert/query logic, view layouts (`map-layouts.ts`), or the inspector drawer.
