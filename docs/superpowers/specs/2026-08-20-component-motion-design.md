# Component motion: borders that mean something, and screens that arrive

**Sub-project 2 of 3** in the UI refresh. Sub-project 1 built the galaxy backdrop
and a motion vocabulary that permits loops. Sub-project 3 migrates the 71 files
still hardcoding Tailwind colour utilities onto tokens.

**Branched from `codex/galaxy-foundation`**, which is not yet merged. Rebase onto
`main` once it is.

## The problem

Sub-project 1 made the *backdrop* alive and left the foreground exactly as it
was. Three things are missing:

1. **Nothing marks what is happening.** Dragging a kanban card, editing one, or
   tabbing to one all look identical to a card at rest.
2. **Screens do not arrive, they appear.** `routes.tsx` wraps `<Outlet />` in a
   bare `Suspense`, so navigation swaps content instantly — and on a cached or
   fast route the `RouteFallback` spinner flashes for a few frames first. That
   flash is probably more of what reads as unfinished than the absence of
   animation.
3. **Hover states are binary.** A card is hovered or it is not; nothing responds
   to *where* the pointer is.

## The decision: motion marks, it does not decorate

The obvious version of this request is an animated gradient border on every
kanban card. That was considered and rejected.

Sub-project 1's craft rules say loops belong on singular, focal elements and
**never on repeated list items**. A board of forty cards each running a
travelling border stops reading as premium and starts reading as a slot machine
— on a surface people stare at while trying to think.

So every animation here binds to a state that is **singular by construction**:

| State | Why it is singular | Mechanism |
|---|---|---|
| Dragging | you can only drag one card | existing `draggedItemId` |
| Focused | one element has focus | pure CSS `:focus-visible` |
| Just-updated | a single pass, then it stops | `useRecentlyUpdated` |

**The active nav item and a modal's primary action were also considered and
excluded**, for the same reason as overdue: both are standing conditions, not
things happening. The nav already carries a cyan treatment (`app-shell.tsx:84`)
and needs no motion to say which page you are on. The existing **Beacon** verb
already covers a single focal element breathing, if that is ever wanted; it does
not need a travelling border.

**Overdue was proposed and deliberately excluded.** A real board can carry a
dozen overdue cards, so it is the same failure mode wearing a different hat —
and it animates a state that is not changing. Overdue keeps a static treatment.

The rule this establishes, and which sub-project 3 inherits:

> Motion marks what is happening or what just happened. It never marks a
> standing condition.

## Design

### Borders are a class, not a wrapper

`.orbit-state-border`, with two modifiers:

- `--live` — continuous travel, **minimum 3s per revolution** per the craft rules
- `--once` — a single pass, then nothing

A class rather than a React wrapper component means no DOM changes at existing
call sites, no test churn, and it composes with whatever markup a card already
has. A wrapper would have forced an extra element into the kanban card, the
modal and the nav, each of which has its own layout assumptions.

The border colour is **cyan `#22d3ee`**, unchanged from the interaction colour.
These three states are all "this is the thing you are touching", which is
precisely what cyan already means. Introducing a new colour would weaken the
signal cyan carries everywhere else.

### The three bindings

**Dragging** binds to `draggedItemId` in `src/features/work-items/kanban-board.tsx:108`,
which already exists. Nothing new is tracked.

**Correction: the arc landed on the drop-target column, not the dragged card
itself.** The dragged card already ghosts to `opacity: 0.28` via
`kanban-drag-source`, and a parent's opacity applies to its whole subtree
including `::after`, so a border there rendered at ~28% opacity — nearly
invisible and redundant with the existing ghost treatment. The column the
card is about to land in (`dragOverColumnId`) gets `orbit-state-border
orbit-state-border--live` instead, which is also more useful: it shows where
the card will land, which is what a mid-drag user actually needs to see.

**Focus** is pure CSS `:focus-visible`, so it costs no JavaScript and works on
every element the class is applied to. It is also an accessibility improvement
on its own merits: a genuinely visible focus ring on a dark UI.

**Focus is static, not looping.** An element can sit focused for a minute, which
makes it a standing condition, not a transient one — the same reason the active
nav item was excluded above. The focus arc gets the same `opacity: 1` reveal as
the other two states but never the `--live` travel animation. It supplements the
native focus ring rather than replacing it; `.orbit-state-border:focus-visible`
does **not** set `outline: none`. Where `@property` is unsupported the
conic-gradient background is invalid and the arc silently fails to render, and
stripping the native ring on top of that would leave no focus indicator at all.

**Just-updated** is the only new machinery: a `useRecentlyUpdated` hook that
diffs a list of ids between renders and returns the set that changed, clearing
each after ~1.2s. It is pure logic over its inputs, which is what makes it
testable without rendering anything.

This is the existing **Dock** verb — "captures, saves, and dropped tasks land
with one soft pulse" — expressed as a border rather than a pulse. It is not a
new concept, and it is not a loop.

### Route transitions: settle in, and stop flashing

Two changes in `src/app/routes.tsx`:

1. **Settle, without remounting the screen.** The route wrapper is **not**
   keyed on `pathname`. It was during development, but a keyed wrapper
   remounts on every navigation, which discards any component state that
   survives a same-route navigation — concretely,
   `project-workspace-page`'s active tab and filters, reset every time you
   switched projects. The wrapper now persists across navigations; the first
   paint gets its settle from the existing `.orbit-route-enter` CSS keyframe,
   and every navigation after that replays the same settle via the Web
   Animations API (`wrapper.animate(...)`, in a `useEffect` keyed on
   `pathname`) on that persisting element — `fill: "none"` so nothing lingers
   once the replay ends. The effect guards `prefers-reduced-motion: reduce`
   itself (the CSS blanket rule only neutralises `animation`/`transition`,
   not WAAPI) and no-ops where `Element.animate` is unavailable, such as
   jsdom in tests.
2. **Delayed fallback.** `RouteFallback` renders `null` for its first 150ms. A
   route whose chunk is cached resolves well inside that window, so it settles
   in cleanly instead of showing a spinner for three frames. A genuinely slow
   route still gets the spinner, which is when a spinner is actually useful.

**Enter-only, deliberately.** React Router has no exit animation; playing the
outgoing screen out means holding it mounted while the next loads, which needs
either Motion (~35KB, against this refresh's no-dependency record) or
hand-rolled twin Outlets with rapid-navigation, back-button and load-failure
cases to get right. The cost is not proportionate to the gain.

### Hover and click polish

**Spotlight** — a radial highlight following the pointer inside a card. The
naive implementation attaches a `pointermove` listener per card; with forty
cards that is forty listeners doing layout reads. Instead **one delegated
listener per container** resolves the hovered card with `closest()` and sets
`--spot-x` / `--spot-y` on it. One listener regardless of card count.

**Glare** — a sheen sweeping across on hover, pure CSS, no JavaScript — was
designed and then cut before shipping. Nothing in `src/` applies the class, and
there was no obvious surface for it on this branch; sub-project 3 can add it
where it actually belongs rather than this branch shipping unreachable CSS with
a claim attached.

**Click Spark** — a short burst at the click point, on **primary actions only**.
Explicitly excluded from the kanban board and the mind map, where continuous
pointer work would fight dragging and panning.

### Reduced motion is nearly free

`src/styles.css` already neutralises `animation` and `transition` on `*`,
`*::before` and `*::after` under `prefers-reduced-motion: reduce`. Every
CSS-based effect above inherits that automatically.

**Click Spark is the sole exception**, because canvas drawing is not reachable
from CSS. It gets an explicit `matchMedia` guard and does not draw at all when
the preference is set.

## Files

- Create `src/lib/use-recently-updated.ts` and its test
- Create `src/components/click-spark.tsx` and its test
- Modify `src/styles.css` — the `.orbit-state-border` class and its two
  modifiers, plus the spotlight rules. **Not a new stylesheet:** `src/styles.css`
  is the only CSS file in `src/` and imports only Tailwind, so a second one
  would break the established pattern.
- Modify `src/app/routes.tsx` — non-remounting settle and delayed fallback
- Modify `src/features/work-items/kanban-board.tsx` — drag and just-updated
  bindings, and the delegated spotlight listener
- Modify `src/components/global-quick-add.tsx` — Click Spark on the primary
  action only. The modal (`src/components/modal.tsx`) does **not** get a
  state border or Click Spark; see above.

No schema, query, mutation, or route change. No new dependency.

## Testing

- **`useRecentlyUpdated` is tested directly** — ids appearing, ids changing, the
  clear after timeout, and the case that matters most: an id that changes twice
  in quick succession must not clear early from the first timer.
- **The delayed fallback is tested with fake timers** — nothing rendered before
  150ms, spinner after. Both halves, because a fallback that never appears is as
  wrong as one that always does.
- **Click Spark's reduced-motion guard is tested** by setting the media query
  match and asserting nothing is drawn. This is the one effect CSS does not
  cover, so it is the one that needs an explicit test.
- **Class-name decisions are tested** rather than the visual result — that a
  dragged id gets `--live` and a recently-updated id gets `--once`.
- **The full suite must stay at 792 passing**, with no existing test modified.

## Risks

- **Spotlight is the most likely thing to feel cheap.** A highlight that is too
  bright or too fast reads as a gimmick. It is one CSS value to tune, and the
  fallback is to remove one rule.
- **Click Spark on a canvas over an already-busy page.** Sub-project 1 added a
  live WebGL backdrop and there are eight `backdrop-blur` surfaces above it.
  Sparks are short-lived and unmount their canvas, but this is the effect most
  worth cutting if the page feels heavy.
- **`useRecentlyUpdated` fires on any change to a watched id**, including one
  the user did not cause — a background refetch that alters a field would flash
  a border. Tuning what counts as "changed" is the fiddly part.

## What this deliberately does not cover

- **Sub-project 3** — the 71 files still hardcoding Tailwind colour utilities.
- **Text animation** — Blur Text, Split Text, Count Up and similar all need GSAP
  or Motion. This refresh has added exactly one dependency so far and none of
  these earn a second.
- **Overdue and other standing conditions.** Static treatments, per the rule
  above.
