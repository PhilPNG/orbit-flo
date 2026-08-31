# Galaxy foundation: palette, atmosphere, and a motion vocabulary that loops

**Sub-project 1 of 3** in a wholesale UI refresh. Sub-project 2 is the shared
primitives in `src/components/`; sub-project 3 is the 20 feature directories.
Each ships a working app on its own.

## The problem

Orbit Flo is already a deep-space product. The 2026-07-12 redesign named it
*Quiet Orbit Observatory*: a near-black indigo canvas, a sparse three-depth
starfield, ambient bloom, cyan for anything interactive.

It reads as flat. The reason is not an accident of implementation — it is the
design language working exactly as written:

> **Drift:** star layers move almost imperceptibly over minutes.
>
> Repeated scanlines, rapid shooting stars, pulsing borders, and arcade-style
> loops are excluded.

A backdrop that changes imperceptibly over minutes is a wallpaper. The product
is themed as a galaxy and rendered as a gradient.

## The decision: supersede the motion rule, keep everything else

**This spec deliberately reverses the no-decorative-loops rule.** That rule was
considered and chosen in July; it is being replaced now, not overlooked. Written
down as a reversal so the next reader finds a decision rather than a
contradiction.

What is **not** changing, and why that matters more than what is:

- **Cyan `#22d3ee` remains the interaction colour**, and violet remains ambient
  only. One colour meaning "you can touch this" is what keeps a dark UI legible.
  A richer background that drifted toward cyan would quietly destroy that
  signal, so the new atmosphere colours are chosen to stay clear of it.
- **The three surface tiers, the panel colours, the typography and the spacing
  scale are untouched.** This adds atmosphere; it does not restate the product.
- **Settle, Dock, Ignite and Beacon carry over unchanged.** Only *Drift* is
  replaced.

## Design

### Palette: new atmosphere tokens only

Added to `src/styles.css` alongside the existing `--orbit-*` tokens:

| Token | Value | Role |
|---|---|---|
| `--orbit-nebula-violet` | `#7c3aed` | primary cloud field |
| `--orbit-nebula-magenta` | `#c026d3` | secondary cloud, used sparingly |
| `--orbit-nebula-teal` | `#0d9488` | counter-glow opposite the violet mass |
| `--orbit-star-cool` | `#e0f2fe` | majority star temperature |
| `--orbit-star-warm` | `#fcd9a8` | minority stars, for temperature variety |

**The teal needs care, because it is the one colour adjacent to cyan.** It is
permitted only as diffuse ambient mass at low opacity, never as a crisp edge,
a border, or anything with a defined boundary. Cyan's job is to mark what you
can touch, and it does that partly through sharpness — a soft teal cloud
several shades darker cannot be mistaken for a control, but a teal *line*
could. That restriction is the price of using the colour at all.

Star colour variety is the cheapest thing on this list and does more for realism
than any other single change: a field where every star is the same cyan-white
reads as printed dots, because real fields never look like that.

No existing token changes value. Nothing in `src/` that currently renders
correctly renders differently as a result of this table alone.

### Atmosphere: one component's internals

`StarFieldBackground` in `src/components/space-visuals.tsx` is mounted in five
places — `app-shell.tsx`, `auth-page.tsx`, `auth-callback-page.tsx`,
`auth-reset-page.tsx`, `require-auth.tsx` — and re-exported nowhere else.

**It keeps its name and its empty props signature.** All five call sites are
untouched. Only its internals change.

Internally it renders one of two things:

1. **A WebGL galaxy** — React Bits' galaxy shader, vendored into the repo and
   adapted to the tokens above, running on `ogl` (~30KB, MIT).
2. **A layered-CSS nebula** — radial gradients in the same colours. Not
   static: the CSS star layers drift and three meteors animate, including
   under capture mode — "fallback" describes which rendering path is chosen,
   not an absence of motion.

The fallback is chosen when WebGL is unavailable, when the user prefers reduced
motion, or when `import.meta.env.VITE_CAPTURE_MODE === "1"` — the signal that
already exists, is already typed in `src/vite-env.d.ts`, and already gates the
visual-review route in `src/app/routes.tsx`. Reading it directly is why the
component needs no new prop and the capture harness needs no change. **It is real engineering, not a
test shim:** a user on a blocked, failed, or software-rasterised WebGL context
sees a good background rather than a black rectangle. That it also makes 759
jsdom tests pass unchanged is a consequence, not the motivation.

### React Bits is vendored, not depended on

React Bits is copy-paste MIT source, not an installable package. The shader and
component are copied into `src/components/` under their licence with attribution
in a header comment. The only runtime dependency added is `ogl`.

This is stated because "add React Bits" sounds like one dependency and is
actually zero — the code becomes ours to maintain, which is a real cost and the
reason sub-project 1 proves the approach on exactly one component before
sub-projects 2 and 3 lean on it.

### Motion vocabulary v2

| Verb | Behaviour | Status |
|---|---|---|
| **Drift** | nebula and star layers move continuously and slowly | **replaces** July's Drift |
| **Parallax** | star layers offset with pointer position | **new** |
| **Shimmer** | a foreground element may loop a light or gradient pass | **new** |
| Settle | 4–6px rise and fade, ~300ms, on entry | unchanged |
| Dock | one soft pulse on save, capture, or drop | unchanged |
| Ignite | one short streak on completion | unchanged |
| Beacon | the single active focal element breathes | unchanged |

Parallax is what sells depth. Continuous drift alone reads as a looping video;
layers that respond to the pointer read as a space you are inside. It applies to
the backdrop only, so it never competes with kanban drag or mind-map panning.

#### Craft rules for loops

Permission without constraint becomes noise, and this is a tool people stare at
for hours. Shimmer is bounded by three rules, and sub-project 2 inherits them:

1. **One looping *foreground* element per visual region.** This mirrors the
   existing rule that no region carries more than one glowing focal point.
   Scoped to foreground deliberately: the galaxy backdrop is now a permanent
   loop beneath every region, and counting it here would make this rule
   forbid any other loop anywhere, which is not the intent — the backdrop and
   a region's own foreground loop are different visual layers and do not
   compete for attention the way two foreground loops would.
2. **Minimum three-second period.** Anything faster reads as arcade, which is
   the specific quality July was right to exclude.
3. **Never on repeated list items.** A board of forty shimmering cards is the
   failure mode. Loops belong on singular, focal elements.

### Guardrails

- **`prefers-reduced-motion: reduce`, checked at mount, disables the canvas
  entirely** and selects the CSS fallback instead. `src/styles.css` already
  carries both media branches.
  If the preference changes *mid-session* while the canvas is already
  mounted, the behaviour is different — and better: `GalaxyCanvas` freezes on
  a single still WebGL frame rather than swapping to the CSS fallback, so the
  backdrop does not visibly change composition, just stops moving. Not
  slowed — off.
  This is asymmetric: toggling the preference back *off* mid-session resumes
  that same frozen canvas, but a session that started with reduced motion on
  (CSS fallback, canvas never mounted) does not upgrade to the canvas if the
  preference is turned off later — `StarFieldBackground`'s selection is
  decided once, at mount. Only a reload picks the canvas up.
- **Paused when `document.hidden`.** An animation loop in a background tab is
  pure battery cost, and this app is one people leave open all day.
- **Frame budget capped** rather than uncapped `requestAnimationFrame`, so a
  240Hz display does not do four times the work for no visible benefit.
- **The visual-review harness avoids the WebGL canvas.** Capture mode selects
  the CSS fallback — via the existing `VITE_CAPTURE_MODE` signal, so no
  harness file is touched — because a canvas repainting every frame is a
  worse determinism risk than the CSS layers. The CSS fallback is not itself
  static (the star layers drift and three meteors animate), so this guardrail
  narrows the risk rather than eliminating it.

## Files

- Modify `src/styles.css` — add the five atmosphere tokens and the fallback
  nebula layers
- Modify `src/components/space-visuals.tsx` — `StarFieldBackground` internals
- Create `src/components/galaxy-canvas.tsx` — the vendored shader and its WebGL
  lifecycle, kept separate so `space-visuals.tsx` stays readable and the
  vendored code has one clear home
- Create `src/components/galaxy-canvas.test.tsx`
- Modify `src/components/space-visuals.test.tsx` — cover fallback selection
- Modify `package.json` — add `ogl`

No route, query, mutation, or data-model change. No feature behaviour changes.

## Testing

- **`StarFieldBackground` renders the fallback under jsdom**, which is what
  keeps the existing suite green without any test being modified to accommodate
  the change.
- **Fallback selection is tested directly**, not incidentally — but only the
  no-WebGL case actually ships as a distinct test condition. All three new
  `space-visuals.test.tsx` cases run under jsdom, which has no WebGL, so they
  exercise the same branch of `useGalaxy` regardless of which assertion each
  one is written to illustrate. The reduced-motion-set and capture-mode
  branches of that selection have no dedicated coverage; jsdom cannot easily
  fake `matchMedia` returning true or provide a WebGL context to disprove
  against, so this is a real gap, not incidental.
- **The loop pauses on `document.hidden`** — not asserted by dispatching a
  `visibilitychange` event; there is no such dispatch in the suite. It is
  covered indirectly, through the pure `shouldRenderFrame` unit tests in
  `galaxy-canvas.test.tsx`, which assert that passing `hidden: true` returns
  `false` regardless of timing. That proves the gating function is correct;
  it does not prove the `rAF` loop actually reads `document.hidden` and
  calls it at the right moment.
- **The full suite must stay at 759 passing**, and the visual-review route must
  still make zero Supabase calls.

## Risks

- **A persistent WebGL canvas behind every page is the largest cost here.** It
  is mitigated by the reduced-motion off-switch, the hidden-tab pause and the
  frame cap — but on old integrated graphics it will still cost something. The
  fallback path is the escape hatch, and it is one boolean away.
- **Vendored code is code we own.** React Bits ships no updates to us; a bug in
  the shader is ours to fix.
- **Foreground loops were chosen over a stated reservation.** In a planning tool
  used for hours, constant movement is the change most likely to become
  irritating. The three craft rules exist specifically to keep that from
  happening, and sub-project 2 is where the judgement gets made against real
  components rather than in the abstract.
- **Star temperature variety could tip into looking like confetti** if the warm
  minority is too large or too saturated. It is a minority accent, not a second
  star colour.

## What this deliberately does not cover

- **Shared primitives** — buttons, fields, cards, modals, pills, empty states.
  Sub-project 2. Shimmer is defined here and applied there.
- **The 20 feature directories**, and migrating their 71 files off raw Tailwind
  colour utilities onto tokens. Sub-project 3. Until then a theme change still
  means editing class strings, which is the debt this refresh should retire.
- **Cursor effects** — Splash Cursor and similar were considered and excluded:
  they add work on every pointer move and would fight the kanban board and mind
  map, which this product leans on heavily.
