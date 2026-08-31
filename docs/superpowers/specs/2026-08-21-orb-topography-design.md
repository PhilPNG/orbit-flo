# Orb on the door, topography in the workspace

**Sub-project 4** of the UI refresh, following the galaxy backdrop (#57), motion
that marks state (#58), and glow-and-lightning (#60). Branched from `main` at
`4219a89`.

## The problem

Two screens still look like the product did before any of this started.

**`/auth`** shows a hand-built orbit diagram — three CSS rings, a raster core
image, two orbiting dots and four labelled cards. It is the first thing anyone
sees, and it is the least alive surface left.

**Inside a project**, the busiest screen in the app, the backdrop is the same
galaxy as everywhere else. Nothing distinguishes being *in* a project from being
anywhere else.

## The decision

React Bits' **Orb** replaces the rings and core art on `/auth`. React Bits'
**Topography** layers over the galaxy inside a project.

### What the Orb does not replace

`AuthOrbitScene` renders four labelled cards — *Plan*, *Brainstorm*, *Mind map*,
*Review* — orbiting the core. **Those are product messaging, not decoration:**
they are the only thing on the sign-in page that says what Orbit Flo is for.

The request was to replace "the circle orbit image", so the rings
(`auth-orbit-ring`), the core art (`auth-orbit-core-art`), the orbiting nodes
and the twinkles go. The four cards stay, floating over the Orb, keeping the
violet glow they gained in #60.

### Layering, chosen with the cost known

Topography sits **over** the galaxy rather than replacing it. This was chosen
deliberately after the cost was raised: two simultaneous WebGL contexts on the
densest screen in the product, alongside glowing surfaces, eight
`backdrop-blur` layers, and an electric-border canvas during drags.

Rather than re-argue it, this spec commits to **measuring** it — see Testing.
If the numbers are bad, that is a fact to decide on, not a prediction to trade.

## Design

### `AuthOrbitScene` keeps its signature

Its name and empty props are unchanged, so `auth-page.tsx:164` is untouched.
This is the same seam that let the galaxy replace the CSS starfield across five
call sites without editing any of them.

Internally it becomes: an `Orb` canvas, the four satellite cards, and nothing
else. The CSS for rings, core art, nodes and twinkles is removed rather than
left orphaned.

### Both components need the same four guards

Neither ships with the hygiene this project now expects. Orb needs all four;
Topography already has two.

| Guard | Orb | Topography |
|---|---|---|
| `prefers-reduced-motion` | **add** | **add** |
| Paused when hidden | **add** | already has (`visibilitychange`) |
| Paused when off-screen | **add** | already has (`IntersectionObserver`) |
| Frame cap | **add** | **add** |
| Device-pixel-ratio cap | **add** — it is currently *uncapped* | already capped at 2 |

The off-screen pause is added to the Orb rather than assumed unnecessary. `/auth`
scrolls on a narrow viewport, and an animating canvas below the fold is pure
cost — the same reasoning that put an `IntersectionObserver` in Topography
upstream.

The uncapped DPR is the most consequential of these. On a 4K display the Orb
would render four times the fragments for a decorative sphere, on the page where
a first-time visitor forms their impression of whether the product is fast.

### Topography needs a WebGL 2 check

It is `#version 300 es`. The galaxy is WebGL 1, so a machine that runs the
galaxy fine may still have no WebGL 2. When it is unavailable, Topography
renders nothing and the galaxy shows through unchanged — a clean degradation,
not a broken canvas.

### Its mouse listeners are dropped

Topography binds `mousemove` and `mouseleave` to its own canvas. Behind
`pointer-events: none` UI those can never fire. Registering listeners that
cannot run is dead code that reads as a feature, so `mouseInteraction` is off
and the handlers are removed.

### Mounting and colour

Topography mounts from the project workspace page, `position: fixed`,
`pointer-events: none`, above the galaxy and below content. It unmounts on
leaving, so the second context exists only where it was asked for.

Its defaults are `#5227FF` and `#FF9FFC` — a violet-and-pink that belongs to a
different product. They are retuned to the existing nebula tokens at low
opacity, because it sits behind the densest screen in the app and contour lines
directly under a kanban card must not compete with it.

## Files

- Modify `src/components/auth-orbit-scene.tsx` — internals only
- Create `src/components/orb.tsx` and its test
- Create `src/components/topography.tsx` and its test
- Modify `src/features/projects/project-workspace-page.tsx` — mount Topography
- Modify `src/styles.css` — remove the orphaned ring/core/node/twinkle rules,
  add the Topography layer positioning
- Modify `LICENSES/react-bits-MIT.txt` — record the third and fourth vendored
  components

No schema, query, mutation or route change. **No new dependency** — `ogl` is
already present from the galaxy.

## Testing

- **Each component's reduced-motion guard is tested** by setting the media query
  and asserting no canvas mounts — the same shape as `click-spark.test.tsx` and
  `electric-border.test.tsx`. This is the one guard CSS cannot provide, so it is
  the one that earns a test. jsdom has no WebGL either way, so this assertion
  alone would hold whether or not the guard existed — the reduced-motion tests
  additionally stub the module's WebGL-availability check (`isWebGLAvailable`
  for the orb, `hasWebGL2` for Topography) to return `true`, so the
  reduced-motion branch is the only thing left that can prevent a canvas. For
  the stub to actually reach the internal call in `topography.tsx` (rather than
  a same-module reference that bypasses a mocked export), that file calls
  `hasWebGL2()` through a self-namespace import instead of the bare local name.
- **Topography's WebGL 2 check is tested** — no WebGL 2 context means no canvas.
- **`AuthOrbitScene` still renders all four satellite labels.** This is the test
  that matters most in this spec: it is the guard against a future change
  quietly deleting the product's only sign-in-page messaging.
- **The canvases themselves are not tested.** jsdom has no WebGL, and mocking a
  context proves only that the mock works.
- **The full suite finished at 810 passing**, not the 803 originally targeted —
  809 after the initial implementation, plus one more from a post-ship review
  that found the reduced-motion tests vacuous (jsdom has no WebGL either way,
  so they passed whether or not the guard existed) and added a regression test
  for the orb's static fallback. One existing test *was* modified:
  `auth-page.test.tsx` asserted on `auth-orbit-core-art`, the raster image
  this spec deletes. That
  assertion necessarily changes — the image it checked no longer exists — so it was
  replaced with assertions on the four Plan/Brainstorm/Mind map/Review labels,
  which is what that test was actually protecting.

### The measurement, which is a deliverable

After it works, frame timings on the project workspace with the galaxy alone
versus galaxy plus Topography, on this machine, reported as numbers. Not "it
feels fine" — a median frame time for each, and the delta.

## Risks

- **Two WebGL contexts is the headline risk**, and it was chosen knowingly. The
  measurement above exists to turn it from an argument into a fact. If the delta
  is bad, the fallback is one line: mount Topography instead of the galaxy
  rather than over it.
- **Browsers cap simultaneous WebGL contexts** (commonly around 16) and evict
  the oldest when exceeded. Two is far from the cap, but the galaxy already
  handles `webglcontextlost`; Topography must not leave a dead canvas if it is
  ever evicted.
- **The Orb is on the first screen anyone sees.** A visitor on a weak machine
  forms their impression of the product's speed there. That is the reason for
  the DPR cap and the frame cap, not general tidiness.
- **Removing the ring CSS could orphan a selector still used elsewhere.** The
  ring, node and twinkle classes are checked for other users before deletion.

## What this deliberately does not cover

- **The token migration** — 71 files still hardcoding Tailwind colour utilities.
  Still outstanding, and still the thing that makes every future theme change
  expensive.
- **A global motion-intensity control.** Now six stacked effects — galaxy, glow,
  lightning, sweep, count-up, and these two — with an OS preference as the only
  escape hatch. Deferred once more, and increasingly hard to justify deferring.
