# Electric polish: glow everywhere, lightning where it matters

**Branched from `codex/component-motion`** ([PR #58](https://github.com/PhilPNG/ToDo/pull/58)), not yet merged. Rebase onto `main` once it is.

Follows sub-project 1 (the galaxy backdrop) and sub-project 2 (motion that marks
transient state). This is the visual-richness pass on top of both.

## The problem

Sub-project 2 was deliberately restrained. Every animation bound to a state that
was singular by construction, and boxes at rest were left completely quiet —
hairline border, no glow, nothing.

The result is correct and slightly austere. A product themed as a deep-space
observatory has a live galaxy behind it and flat grey rectangles in front.

## The decision: glow is not motion

Sub-project 2 established a rule that still holds:

> Motion marks what is happening or what just happened. It never marks a
> standing condition.

**A glow is not motion.** A box that glows softly at rest is not competing for
attention, is not animating, and costs nothing per frame. What made "animated
borders on every card" the wrong idea was the *animation*, not the *glow*.

So: every box glows, always. Nothing at rest moves. Motion stays exactly where
sub-project 2 put it.

### React Bits' Electric Border decomposes along that same line

Its source splits cleanly in two:

- **Three static blur layers** (`eb-glow-1`, `eb-glow-2`, `eb-background-glow`)
  — a tight bright ring, a soft mid blur, and a wide ambient wash. **No
  animation whatsoever.**
- **An animated canvas** drawing a Perlin-displaced rounded-rect path.

That is precisely the split this spec needs, from the component actually asked
for. The static half goes on every box; the animated half goes on one element.

## Design

### Every box: layered box-shadow, no DOM

React Bits stacks three blurred `div`s. That does not fit here — cards already
use `::before` for the pointer spotlight and `::after` for the state border, so
extra layers would collide with both.

A layered `box-shadow` reproduces the same three-part look with **zero elements
and zero pseudo-elements**: a tight ring, a soft mid blur, a wide ambient wash.

It reaches every box through **five class names**, all defined in
`src/styles.css`'s components layer and used ~58 times across the app:

| Class | Uses | Role |
|---|---|---|
| `orbit-panel` | 36 | general panels |
| `surface-quiet` | 12 | standard cards and rows |
| `surface-raised` | 5 | menus, active cards |
| `surface-focus` | 3 | modals, drag previews |
| `orbit-task-card` | 2 | kanban cards |

**Almost no `.tsx` file changes for the glow** — that is the point of doing it
here rather than call site by call site, and it means the next theme change is
one edit, not fifty-eight. Two exceptions: `auth-page.tsx` and `maps-page.tsx`
each paired a shared surface class with a Tailwind `shadow-2xl` utility, and
Tailwind's utilities layer always outranks this file's components layer
regardless of source order — so `shadow-2xl` won the cascade and the glow
never painted. Both surfaces already carry comparable or heavier elevation on
their own, so `shadow-2xl` was removed from both instead of fighting layer
order.

**The glow is violet, not cyan** — `--orbit-violet` (`#7c3aed`) at low alpha.

This matters more than it looks. Cyan means "you can touch this", and that one
signal is what keeps a dark UI legible. Putting cyan on all fifty-eight boxes
would dilute it everywhere at once — the same argument that kept cyan out of the
atmosphere in sub-project 1, applied to the foreground.

The July design language already designates the right token: violet is
**ambient only, never a control colour**. A decorative glow is exactly what it
exists for. The electric border on the drop target stays cyan, because that one
*is* an interaction state.

### The drop target: the animated half

The vendored canvas replaces the conic-gradient arc currently on
`.kanban-drop-target`. Three changes from the original, all necessary:

1. **A reduced-motion guard.** Canvas is not reachable by the CSS
   `prefers-reduced-motion` rule, exactly as with the galaxy canvas and click
   sparks. It renders nothing when the preference is set.
2. **Paused when `document.hidden`,** and frame-capped.
3. **Octave count trimmed.** Measured from the source: a column-sized element
   samples its perimeter roughly 900 times, each running 10 noise octaves on two
   axes — about **18,000 noise evaluations per frame**. Affordable for one
   element that only exists mid-drag; prohibitive for forty. Octaves drop from
   10 to 5 and the perimeter sample count is capped at 240, taking it to roughly
   2,400 evaluations per frame — an eighth of the original, and visually
   indistinguishable at this scale because the high octaves contribute
   sub-pixel detail.

**`oklch(from var(--color) l c h)` is replaced.** The original uses relative
colour syntax, a newer baseline than anything else in this project. Explicit
token values go in instead rather than quietly raising the browser floor.

**It is an overlay, not a wrapper**, unlike the original component it was
vendored from. Board columns are flex items in a horizontal scroller, so
nesting children inside three extra divs would change layout; instead it is
one absolutely-positioned canvas placed inside the column. That is acceptable
for exactly one element — a board column — and is why it is not used more
widely.

### Navigation: a light sweep

A gradient bar translates across an overlay inside `RouteSettle`, ~300ms,
`pointer-events: none`, above both screens.

Because it is an overlay rather than a transition between two mounted trees, it
needs none of the exit-animation machinery that made full choreography
disproportionate in sub-project 2. It composes with the settle already there.

### Lists: stagger, with a cap

Rows carry `--stagger-index` from their render index, and
`animation-delay: calc(var(--stagger-index) * 40ms)`.

**The index is capped at 12.** Uncapped, a 200-row list would take eight seconds
to finish appearing, and the last rows would arrive long after the user started
reading. Past the cap everything shares the final delay.

**Landed on one call site, not "lists" generally.** `.orbit-stagger` is wired
up on kanban cards only. Every other list in the app (inbox, mission log,
suggestion rows) does not carry `--stagger-index` and does not stagger. Treat
this as the mechanism proven at one site rather than a feature that reached
lists as a whole — wiring it into the others is deferred, not done.

### Dashboard: count-up

A `useCountUp` hook ticks the dashboard's stat numbers and the mission-progress
percentage from zero on mount. It respects reduced motion by rendering the final
value immediately, and it is pure enough to test without rendering.

## Files

- Modify `src/styles.css` — the glow on five surface classes, the light-sweep
  overlay, the stagger rule
- Create `src/components/electric-border.tsx` and its test — the vendored canvas
- Modify `src/features/work-items/kanban-board.tsx` — wrap the drop-target
  column; remove the conic arc from it; add `--stagger-index` to cards
- Modify `src/app/route-transition.tsx` — the sweep overlay
- Create `src/lib/use-count-up.ts` and its test
- Modify `src/features/dashboard/dashboard-page.tsx` — count-up on stat numbers
- Modify `LICENSES/react-bits-MIT.txt` — note the second vendored component

No schema, query, mutation or route change. No new dependency.

## Testing

- **`useCountUp` is tested directly** — start value, end value, the reduced-motion
  path returning the final value immediately, and a value that changes mid-count.
- **`ElectricBorder`'s reduced-motion guard is tested** by setting the media
  query and asserting no canvas mounts, the same shape as the click-spark test.
  The canvas drawing itself is not tested: jsdom has no 2D rendering worth
  asserting on, and mocking one would prove only that the mock works.
- **The stagger cap is tested** as a pure function — index 3 gives 120ms, index
  50 gives the capped delay, not two seconds.
- **The full suite must stay at 803 passing**, with no existing test modified. (792 at the start of this spec; 802 after the surfaces in this refresh landed; 803 after the `useCountUp` settling fix added its own regression test.)

## Risks

- **The glow is the highest-blast-radius change in the whole refresh.** Five
  class names reach ~58 call sites, so a value that is too strong is visible
  everywhere at once. It is also one line to tune, and one line to remove.
- **Electric Border is the most expensive thing added so far**, and it runs on
  top of an existing WebGL canvas. It only exists while a drag is in progress,
  which bounds the exposure, but a slow machine will feel it during exactly the
  interaction that most needs to stay responsive. If it does, the fallback is
  the conic arc that already works.
- **Layered box-shadows on many elements have a real paint cost** when they
  overlap and blur widely. The wide ambient wash is the expensive layer and is
  kept low-radius for that reason.
- **A light sweep on every navigation is the effect most likely to wear out.**
  It is deliberately short. If it grates, it is one rule.

## What this deliberately does not cover

- **The token migration** — 71 files still hardcoding Tailwind colour utilities.
  That remains its own piece of work and is now more valuable, not less.
- **A global motion intensity control.** Considered and declined for now. Worth
  revisiting: this refresh has added a WebGL galaxy, glowing boxes, an electric
  canvas, screen sweeps and staggered lists, and the only escape hatch is an
  OS-level preference.
- **A modal entrance.** The modal still borrows `orbit-page-enter`, which
  carries the `will-change: transform` containing-block issue fixed for routes
  in sub-project 2. Low risk there, but it is the same defect in a second place.
