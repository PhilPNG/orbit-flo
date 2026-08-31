# UI/UX Overhaul — "Deep Space Observatory"

**Date:** 2026-07-07
**Branch:** `codex/project-command-center`
**Status:** Approved by user (all three design sections)

## Problem

Orbit Flo's functionality is right, but the experience is too information-dense and the
space styling reads as generic. Two root causes, one origin:

1. **Accumulated panels.** Daily Mission Control stacks 10+ panels (flight plan, momentum,
   capture dock, suggestions, calendar blocks, focus session, review, timeline, shutdown,
   reflections). Project Workspace opens with a large always-expanded brief above its tabs.
2. **Accumulated effects.** ~6 competing surface treatments and many simultaneous infinite
   animations (aurora, comets, debris, HUD scan, radar sweep, deadline pulses) create noise
   instead of atmosphere.

## Goals

- Calm, "today-first" user flow: land on a few tasks plus one glance of context.
- Cinematic-minimal art direction: fewer, richer, hand-tuned effects. Observatory, not arcade.
- Every existing feature stays reachable — reorganized (tabs/drawers/disclosures), never deleted.
- Mind maps get full treatment: constellation visuals and faster editing interactions.

## Non-goals

- No changes to data model, queries, mutations, or Supabase schema.
- No feature removal or merging of overlapping panels (out of scope by user choice).
- No redesign of Calendar/Notes/Settings layouts — they inherit the foundation only.

---

## Section 1 — Visual & motion foundation

### Surfaces (3, replacing ~6)

| Token | Use | Treatment |
|---|---|---|
| `surface-primary` | Standard cards/panels | Near-black indigo, 1px hairline border, generous padding, **no** gradient sheen overlay |
| `surface-raised` | Modals, drawers, command palette | Slightly lighter fill + real depth shadow |
| `surface-whisper` | Secondary / "later" content | Borderless, faint fill; visually recedes |

Existing `orbit-panel`, `orbit-panel-soft`, `telemetry-chip`, `orbit-hud-surface`, and inline
glass-box styles migrate to these three.

### Color discipline

- Palette unchanged (deep space `#020817`, cyan, blue, violet).
- Rule: **cyan glow = interactive/active only; violet = ambient accent only; at most one
  glowing element per viewport region.**
- Body text moves from slate-400 to a warmer silver for contrast on navy.
- Uppercase micro-labels (`mission-label`) demoted: fewer instances, lighter weight.

### Signature background

One crafted scene replaces aurora + comets + debris + parallax grid + radar:

- Three-depth starfield layers (dense far / sparse mid / few near stars with subtle
  cross-flare) drifting at different speeds — parallax measured in minutes, not seconds.
- One fixed, very soft nebula gradient anchored to a corner.
- Barely-visible film-grain noise texture over flat areas.

### Typography & rhythm

Real scale: one page-title size, one section size, one body size, one caption size.
One consistent spacing unit so all panels breathe identically.

### Motion vocabulary — five verbs; nothing else moves

1. **Drift** — ambient starfield parallax (background only).
2. **Settle** — page/panel entry: rise 6px + fade, slight stagger, ~350ms (universalizes `orbit-page-enter`).
3. **Ignite** — task completion: a point-of-light flare streaks off the row; row eases out. The one celebration.
4. **Dock** — capture/save: item slots in with a single soft pulse (no infinite pulsing borders).
5. **Beacon** — the single active focus element may breathe slowly; max one per screen.

All infinite decorative loops (hud-scan, radar sweep, comet cycles, deadline pulses) removed.
`prefers-reduced-motion` support retained.

---

## Section 2 — Page layouts & user flow

### App shell

- Sidebar: logo + five primary destinations (Today, Missions, Maps, Calendar, Inbox);
  Brainstorm/Notes and Settings move to a quieter bottom group.
- Quick-add and command palette remain global.
- One icon set with consistent stroke (resolve PNG/lucide mix).

### Mission Control → "Today"

Single-column, centered composition (max ~44rem):

1. **Human header** — date + one-line state sentence ("3 objectives in orbit · next block
   at 2:00"). This sentence *is* the context strip; it fuses momentum + next calendar block.
2. **Flight Plan** — today's 3–5 tasks, larger type, roomy rows, complete/skip on hover.
3. **Quick capture** — one minimal input docked under the plan (Enter to submit; expandable
   for body/type).
4. **Mission log** — collapsed `surface-whisper` disclosure row below the fold. Opens one
   panel with tabs: *Focus · Review · Timeline · Shutdown · Reflection*. The calendar
   planning blocks (CalendarPlanningBlocks) move into the Timeline tab alongside the
   day timeline.
5. Suggested tasks appear as an inline "+ N suggestions" hint under the flight plan, not a
   standalone panel; clicking it expands the suggestion list in place, where each item has
   an add action (same behavior as today's SuggestedFlightPlan).

### Project Workspace

- Project Brief collapses to a two-line summary, expand-on-click.
- Header consolidates status/health/actions into one row.
- Tabs restyle to quiet underline style (structure unchanged).
- Kanban/task cards become flat quiet cards; only the hovered card lifts.

### Inbox

- One-column centered rhythm: current capture on `surface-primary`, remaining queue as a
  compact `surface-whisper` list. Triage feels like processing a stack.

### Calendar / Notes / Settings

- No structural changes; inherit surfaces, type scale, and Settle.

### Auth page

- Orbit scene stays as the artistic centerpiece, re-tuned: slower motion, floating chips
  reduced 3 → 1, core pulse becomes a slow breathe.

---

## Section 3 — Mind maps, shared components, delivery

### Mind maps → "Constellations"

**Visuals**

- Custom React Flow node components: each node is a **star node** — glowing point in the
  accent color (cyan/blue/violet by node type) with the title beside it in clean type.
- Selected node: soft halo ring (Beacon verb). Converted nodes: small planet-with-ring badge.
- Edges: **starlight lines** — thin gradient strokes brightening near endpoints; sequence
  edges keep dashes, slowed.
- Canvas: starfield-void background (custom `Background`), dark themed MiniMap, restyled controls.

**Interactions**

- Double-click empty canvas → create node at that point, already in inline-rename mode.
- Double-click node → inline rename in place.
- Tab / Enter from selected node → create connected child / sibling node.
- Inspector slims to a compact drawer opened by explicit "details" action only.

### Shared components

- `EmptyState`: loading → satellite loader; empty → small constellation illustration + one line.
- `Modal` → `surface-raised` + Settle.
- Repeated rose error boxes consolidate into one `<InlineAlert>` component (used for
  success/error feedback app-wide; query/mutation logic unchanged).
- Command palette keeps HUD personality, drops radar sweep, adopts `surface-raised`.

### Testing & delivery

- All work on `codex/project-command-center`. Existing vitest suite stays green; tests
  asserting on moved panels are updated to the new structure, not deleted.
- New behavior tests: Mission log disclosure, inline node create/rename, keyboard node creation.
- Visual verification: run dev server, screenshot key pages at desktop + mobile widths.
- Incremental phases, each committed separately for review:
  1. Foundation tokens/CSS + app shell
  2. Today page
  3. Project Workspace + Inbox
  4. Constellations (mind maps)
  5. Shared component sweep

## Decisions log

- Home shows tasks + one glance of context (user choice).
- Art direction: cinematic minimalism (user choice, recommended).
- Reorganize freely; nothing deleted (user choice, recommended).
- Mind maps: visuals + interactions (user choice, recommended).
- Approach A: design-system-first (user choice, recommended).
