# Electric Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every box a soft violet glow at rest, put crackling lightning on the one column you are dragging into, and make navigation and lists feel choreographed.

**Architecture:** The glow is a single custom property appended to five existing surface rules, so it reaches ~58 call sites with no `.tsx` changes. React Bits' Electric Border is vendored and split: its static glow layers are already covered by the box-shadow, and only its animated canvas is used, as an overlay rather than a wrapper.

**Tech Stack:** React 19, TypeScript, Vite, Tailwind v4, Vitest + Testing Library.

## Global Constraints

- Run tests with `npm test -- --maxWorkers=2`.
- End every commit message with: `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`
- **792 tests currently pass. No existing test may be modified.** If one breaks, the implementation is wrong, not the test.
- **No new dependency.**
- **The glow is violet (`--orbit-violet`), never cyan.** Cyan means "you can touch this"; putting it on every box would dilute that everywhere at once. The electric border on the drop target stays cyan because that *is* an interaction state.
- **All CSS animation goes inside the single existing `@media (prefers-reduced-motion: no-preference)` block.** Do not create a second one. Canvas work carries its own `matchMedia` guard, because CSS cannot reach canvas drawing.
- Motion marks what is happening or what just happened. It never marks a standing condition.

---

## File Structure

**Modify:** `src/styles.css` — the `--orbit-glow` token appended to five existing surface rules, the light-sweep overlay, the stagger rule.

**Create:** `src/components/electric-border.tsx` and `src/components/electric-border.test.tsx` — the vendored canvas, as an overlay component.

**Modify:** `src/features/work-items/kanban-board.tsx` — the drop-target overlay and `--stagger-index` on cards.

**Modify:** `src/app/route-transition.tsx` — the sweep overlay.

**Create:** `src/lib/use-count-up.ts` and `src/lib/use-count-up.test.ts`.

**Modify:** `src/features/dashboard/dashboard-page.tsx` — count-up on the stat numbers.

**Modify:** `LICENSES/react-bits-MIT.txt` — record the second vendored component.

---

## Task 1: The glow on every box

**Files:**
- Modify: `src/styles.css`

**Interfaces:**
- Produces: the custom property `--orbit-glow`.

### Background you need — read this before touching anything

**Every one of the five surface classes already has a `box-shadow`.** Adding a new `box-shadow` declaration would *replace* it, silently deleting the inset highlight and the drop shadow that give the whole UI its elevation. That would be a far worse regression than no glow at all.

The existing rules, all inside `@layer components` in `src/styles.css`:

```css
  .surface-quiet,
  .surface-primary,
  .orbit-panel {
    border: 1px solid var(--orbit-border);
    background: var(--orbit-surface-quiet);
    box-shadow: inset 0 1px rgba(255, 255, 255, 0.025), 0 18px 50px rgba(2, 8, 23, 0.28);
  }
```

`.surface-raised` has `box-shadow: inset 0 1px rgba(255, 255, 255, 0.04), 0 28px 72px rgba(2, 8, 23, 0.48);`, `.surface-focus` has its own, `.orbit-task-card` has `box-shadow: 0 10px 30px rgba(2, 8, 23, 0.24);`.

So the glow is **appended** to each existing list, via one token, so all five stay tunable from a single place.

Note `.mission-registry-row { box-shadow: none; }` deliberately strips the shadow on that row. It will strip the glow too. **That is correct** — a row inside a panel should not glow — so leave it alone.

- [ ] **Step 1: Add the glow token**

In the `:root` block in `src/styles.css`, immediately after the atmosphere tokens (`--orbit-star-warm`), add:

```css
  /* Three layers matching React Bits' Electric Border glow stack - a tight
     ring, a soft mid blur, a wide ambient wash - expressed as box-shadow so it
     needs no elements and cannot collide with the ::before spotlight or the
     ::after state border already on cards.

     Violet, not cyan, and deliberately so: cyan means "you can touch this", and
     this appears on roughly 58 surfaces. Violet is the token the design
     language designates as ambient-only, which is exactly what a decorative
     glow is. */
  --orbit-glow:
    0 0 0 1px rgba(124, 58, 237, 0.1),
    0 0 14px rgba(124, 58, 237, 0.1),
    0 0 40px rgba(124, 58, 237, 0.06);
```

- [ ] **Step 2: Append it to all five surface rules**

Append `, var(--orbit-glow)` to the end of the existing `box-shadow` in each of these rules. Do not otherwise change them.

```css
  .surface-quiet,
  .surface-primary,
  .orbit-panel {
    border: 1px solid var(--orbit-border);
    background: var(--orbit-surface-quiet);
    box-shadow: inset 0 1px rgba(255, 255, 255, 0.025), 0 18px 50px rgba(2, 8, 23, 0.28), var(--orbit-glow);
  }
```

Do the same for `.surface-raised`, `.surface-focus` and `.orbit-task-card`, keeping each rule's own existing shadow values exactly as they are.

- [ ] **Step 3: Verify nothing lost its elevation**

```bash
grep -n "box-shadow" src/styles.css | grep -c "var(--orbit-glow)"
grep -n "inset 0 1px rgba(255, 255, 255, 0.025), 0 18px 50px rgba(2, 8, 23, 0.28)" src/styles.css
```

Expected: the first prints the number of rules you appended to. The second must still find the original shadow **with the glow appended after it**, proving it was extended and not replaced.

Then read the diff and confirm **no existing shadow value was deleted or altered**. State this explicitly in your report.

- [ ] **Step 4: Run the suite and build**

```bash
npm test -- --maxWorkers=2
npm run build
```

Expected: 792 passing, clean build.

- [ ] **Step 5: Commit**

```bash
git add src/styles.css
git commit -m "feat: give every surface a soft violet glow"
```

---

## Task 2: Electric border on the drop target

**Files:**
- Create: `src/components/electric-border.tsx`, `src/components/electric-border.test.tsx`
- Modify: `src/features/work-items/kanban-board.tsx`
- Modify: `LICENSES/react-bits-MIT.txt`

**Interfaces:**
- Produces: `export function ElectricBorder({ radius }: { radius?: number }): JSX.Element | null`

### Background you need

Vendored from React Bits (MIT). **Six deliberate departures from the original**, each for a reason:

1. **It is an overlay, not a wrapper.** The original wraps its children in three nested divs. Board columns are `<section>` flex items in a horizontal scroller, so wrapping would change layout. This renders one absolutely-positioned canvas inside the already-`position: relative` column instead. No layout change at all.
2. **The three static glow divs are dropped.** Task 1's box-shadow already provides that glow on every surface; duplicating it here would double it on exactly one element.
3. **`oklch(from var(--color) l c h)` is gone.** Relative colour syntax is a newer baseline than anything else in this project. The canvas stroke uses an explicit colour.
4. **Octaves 10 → 5, sample count capped at 240.** The original samples a column's perimeter ~900 times at 10 octaves on two axes: ~18,000 noise evaluations per frame. This brings it to ~2,400. The high octaves contribute sub-pixel detail at this size.
5. **A reduced-motion guard**, because canvas is not reachable by the CSS rule.
6. **Paused when `document.hidden`, and frame-capped**, like the galaxy canvas.

The colour here **is** cyan — `#22d3ee` — because the drop target is an interaction state, which is what cyan means.

- [ ] **Step 1: Write the failing tests**

Create `src/components/electric-border.test.tsx`:

```tsx
import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ElectricBorder } from "./electric-border";

function setReducedMotion(matches: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: query.includes("reduce") ? matches : false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
    onchange: null,
  })) as unknown as typeof window.matchMedia;
}

describe("ElectricBorder", () => {
  afterEach(() => vi.restoreAllMocks());

  it("draws nothing when the user prefers reduced motion", () => {
    // Canvas is the one thing the global CSS reduced-motion rule cannot reach.
    // This guard is the only thing between a reduce-preference user and a
    // continuously animating border, so it gets its own test.
    setReducedMotion(true);
    const { container } = render(<ElectricBorder />);

    expect(container.querySelector("canvas")).toBeNull();
  });

  it("mounts a canvas when motion is allowed", () => {
    setReducedMotion(false);
    const { container } = render(<ElectricBorder />);

    expect(container.querySelector("canvas")).not.toBeNull();
  });

  it("marks the canvas decorative", () => {
    setReducedMotion(false);
    const { container } = render(<ElectricBorder />);

    expect(container.querySelector("canvas")).toHaveAttribute("aria-hidden", "true");
  });
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npm test -- --maxWorkers=2 electric-border`
Expected: FAIL, "Failed to resolve import ./electric-border".

- [ ] **Step 3: Implement**

Create `src/components/electric-border.tsx`:

```tsx
/**
 * A crackling border for the column you are dragging into.
 *
 * Vendored from React Bits (https://reactbits.dev), MIT licensed, by David Haz.
 * See LICENSES/react-bits-MIT.txt. Retrieved 2026-08-20 from
 * https://github.com/DavidHDev/react-bits, path
 * src/content/Animations/ElectricBorder/ElectricBorder.jsx
 *
 * Six deliberate departures from the original:
 *
 * - Overlay, not wrapper. The original nests children three divs deep. Board
 *   columns are flex items in a horizontal scroller, so wrapping would change
 *   layout; this is one absolutely-positioned canvas inside the column instead.
 * - No static glow divs. styles.css already gives every surface that glow via
 *   --orbit-glow; repeating it here would double it on one element.
 * - No oklch() relative colour syntax - a newer baseline than anything else
 *   here. The stroke colour is explicit.
 * - Octaves 10 -> 5 and samples capped at 240. The original runs ~18,000 noise
 *   evaluations per frame on a column-sized element; this runs ~2,400. The
 *   dropped octaves contribute sub-pixel detail at this size.
 * - A reduced-motion guard, because CSS cannot reach canvas drawing.
 * - Paused when the tab is hidden, and frame-capped.
 */
import { useEffect, useRef, useState } from "react";

const OCTAVES = 5;
const LACUNARITY = 1.6;
const GAIN = 0.7;
const CHAOS = 0.12;
const FREQUENCY = 10;
const DISPLACEMENT = 26;
const BORDER_OFFSET = 30;
const MAX_SAMPLES = 240;
const SPEED = 1;
/** 30fps. This runs during a drag, where responsiveness matters more than smoothness. */
const FRAME_INTERVAL_MS = 1000 / 30;
/** Cyan, because a drop target is an interaction state - which is what cyan means here. */
const STROKE = "#22d3ee";

function random(x: number): number {
  return (Math.sin(x * 12.9898) * 43758.5453) % 1;
}

function noise2D(x: number, y: number): number {
  const i = Math.floor(x);
  const j = Math.floor(y);
  const fx = x - i;
  const fy = y - j;

  const a = random(i + j * 57);
  const b = random(i + 1 + j * 57);
  const c = random(i + (j + 1) * 57);
  const d = random(i + 1 + (j + 1) * 57);

  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);

  return a * (1 - ux) * (1 - uy) + b * ux * (1 - uy) + c * (1 - ux) * uy + d * ux * uy;
}

function octavedNoise(x: number, time: number, seed: number): number {
  let y = 0;
  let amplitude = CHAOS;
  let frequency = FREQUENCY;

  for (let i = 0; i < OCTAVES; i += 1) {
    y += amplitude * noise2D(frequency * x + seed * 100, time * frequency * 0.3);
    frequency *= LACUNARITY;
    amplitude *= GAIN;
  }

  return y;
}

function cornerPoint(cx: number, cy: number, r: number, start: number, arc: number, t: number) {
  const angle = start + t * arc;
  return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
}

/** A point at fraction `t` around a rounded rectangle's perimeter. */
export function roundedRectPoint(
  t: number,
  left: number,
  top: number,
  width: number,
  height: number,
  radius: number,
): { x: number; y: number } {
  const straightW = width - 2 * radius;
  const straightH = height - 2 * radius;
  const arc = (Math.PI * radius) / 2;
  const perimeter = 2 * straightW + 2 * straightH + 4 * arc;
  const distance = t * perimeter;
  let acc = 0;

  if (distance <= acc + straightW) {
    return { x: left + radius + ((distance - acc) / straightW) * straightW, y: top };
  }
  acc += straightW;

  if (distance <= acc + arc) {
    return cornerPoint(left + width - radius, top + radius, radius, -Math.PI / 2, Math.PI / 2, (distance - acc) / arc);
  }
  acc += arc;

  if (distance <= acc + straightH) {
    return { x: left + width, y: top + radius + ((distance - acc) / straightH) * straightH };
  }
  acc += straightH;

  if (distance <= acc + arc) {
    return cornerPoint(left + width - radius, top + height - radius, radius, 0, Math.PI / 2, (distance - acc) / arc);
  }
  acc += arc;

  if (distance <= acc + straightW) {
    return { x: left + width - radius - ((distance - acc) / straightW) * straightW, y: top + height };
  }
  acc += straightW;

  if (distance <= acc + arc) {
    return cornerPoint(left + radius, top + height - radius, radius, Math.PI / 2, Math.PI / 2, (distance - acc) / arc);
  }
  acc += arc;

  if (distance <= acc + straightH) {
    return { x: left, y: top + height - radius - ((distance - acc) / straightH) * straightH };
  }
  acc += straightH;

  return cornerPoint(left + radius, top + radius, radius, Math.PI, Math.PI / 2, (distance - acc) / arc);
}

export function ElectricBorder({ radius = 12 }: { radius?: number }) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    const query = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!query) {
      setAllowed(true);
      return;
    }
    const sync = () => setAllowed(!query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (!allowed) return;
    const host = hostRef.current;
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!host || !canvas || !context) return;

    let width = 0;
    let height = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      const rect = host.getBoundingClientRect();
      width = rect.width + BORDER_OFFSET * 2;
      height = rect.height + BORDER_OFFSET * 2;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
    };
    resize();

    const observer = new ResizeObserver(resize);
    observer.observe(host);

    let frameId = 0;
    let lastFrameAt = 0;
    let elapsed = 0;

    const draw = (now: number) => {
      frameId = requestAnimationFrame(draw);
      if (document.hidden) return;
      if (lastFrameAt !== 0 && now - lastFrameAt < FRAME_INTERVAL_MS) return;
      const delta = lastFrameAt === 0 ? 0 : (now - lastFrameAt) / 1000;
      lastFrameAt = now;
      elapsed += delta * SPEED;

      context.setTransform(1, 0, 0, 1, 0, 0);
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.scale(dpr, dpr);
      context.strokeStyle = STROKE;
      context.lineWidth = 1;
      context.lineCap = "round";
      context.lineJoin = "round";

      const boxW = width - BORDER_OFFSET * 2;
      const boxH = height - BORDER_OFFSET * 2;
      if (boxW <= 0 || boxH <= 0) return;
      const r = Math.min(radius, Math.min(boxW, boxH) / 2);
      const perimeter = 2 * (boxW + boxH) + 2 * Math.PI * r;
      const samples = Math.min(MAX_SAMPLES, Math.max(24, Math.floor(perimeter / 2)));

      context.beginPath();
      for (let i = 0; i <= samples; i += 1) {
        const t = i / samples;
        const point = roundedRectPoint(t, BORDER_OFFSET, BORDER_OFFSET, boxW, boxH, r);
        const dx = octavedNoise(t * 8, elapsed, 0) * DISPLACEMENT;
        const dy = octavedNoise(t * 8, elapsed, 1) * DISPLACEMENT;
        if (i === 0) context.moveTo(point.x + dx, point.y + dy);
        else context.lineTo(point.x + dx, point.y + dy);
      }
      context.closePath();
      context.stroke();
    };

    frameId = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(frameId);
      observer.disconnect();
    };
  }, [allowed, radius]);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-10 overflow-visible"
      ref={hostRef}
    >
      {allowed ? (
        <canvas
          aria-hidden="true"
          className="pointer-events-none absolute"
          ref={canvasRef}
          style={{ left: `-${BORDER_OFFSET}px`, top: `-${BORDER_OFFSET}px` }}
        />
      ) : null}
    </div>
  );
}
```

- [ ] **Step 4: Run the tests**

Run: `npm test -- --maxWorkers=2 electric-border`
Expected: PASS, 3 tests.

- [ ] **Step 5: Put it on the drop target**

In `src/features/work-items/kanban-board.tsx`:

Add the import:

```tsx
import { ElectricBorder } from "../../components/electric-border";
```

Find the column `<section>` — it is the element whose `clsx` contains `dragOverColumnId === column.id && "kanban-drop-target"`. Two changes:

- Remove `orbit-state-border` and `orbit-state-border--live` from that element's class list if present, since the canvas replaces the conic arc there. **Leave `kanban-drop-target` itself alone** — its static `border-color` rule stays.
- Render the overlay as the section's first child, only when that column is the drop target:

```tsx
{dragOverColumnId === column.id ? <ElectricBorder radius={12} /> : null}
```

The section must be `position: relative` for the absolute overlay to anchor. Check whether it already is; if not, add `relative` to its class list and say so in your report.

- [ ] **Step 6: Delete `--live`, which this task just made dead**

The drop-target column was `orbit-state-border--live`'s **only** user. Removing it in Step 5 leaves those rules unreachable — and a previous round of this refresh specifically cleaned up dead `--live` rules, so re-shipping them would undo that.

In `src/styles.css`:
- Remove `.orbit-state-border--live::after` from the `opacity: 1` reveal list.
- Remove the `.orbit-state-border--live::after` animation rule from inside the `@media (prefers-reduced-motion: no-preference)` block.

**Leave `--once` and `:focus-visible` exactly as they are** — both still have real users (recently-updated cards, and focused cards via `tabIndex`).

Then prove nothing dangles:

```bash
grep -rn "orbit-state-border--live" src/
```

Expected: **no output.** If anything remains, report what and where rather than deleting more.

- [ ] **Step 7: Record the second vendored component**

Append to `LICENSES/react-bits-MIT.txt` a line noting that both `src/components/galaxy-canvas.tsx` and `src/components/electric-border.tsx` are derived from React Bits under this licence.

- [ ] **Step 8: Run the suite and build**

```bash
npm test -- --maxWorkers=2
npm run build
```

Expected: 792 + 3 passing, clean build.

- [ ] **Step 9: Commit**

```bash
git add src/components/electric-border.tsx src/components/electric-border.test.tsx src/features/work-items/kanban-board.tsx src/styles.css LICENSES/react-bits-MIT.txt
git commit -m "feat: put lightning on the column you are dragging into"
```

---

## Task 3: Light sweep and staggered lists

**Files:**
- Modify: `src/styles.css`
- Modify: `src/app/route-transition.tsx`
- Modify: `src/features/work-items/kanban-board.tsx`

**Interfaces:**
- Produces: `export function staggerDelayMs(index: number): number`
- Consumes: `RouteSettle` in `src/app/route-transition.tsx`

### Background you need

`src/app/route-transition.tsx` exports `FALLBACK_DELAY_MS`, `DelayedFallback` and `RouteSettle`. `RouteSettle` holds a ref to its wrapper div and replays a settle via the Web Animations API on `pathname` change, guarded by its own `matchMedia` check. **Read it before editing** — the sweep hooks into the same effect rather than adding a second one.

- [ ] **Step 1: Write the failing test for the stagger cap**

Create `src/lib/stagger.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { STAGGER_STEP_MS, STAGGER_MAX_INDEX, staggerDelayMs } from "./stagger";

describe("staggerDelayMs", () => {
  it("steps evenly for early items", () => {
    expect(staggerDelayMs(0)).toBe(0);
    expect(staggerDelayMs(3)).toBe(3 * STAGGER_STEP_MS);
  });

  it("caps so a long list does not trickle in for seconds", () => {
    // Uncapped, a 200-row list would take eight seconds to finish appearing and
    // the last rows would arrive long after the user started reading.
    expect(staggerDelayMs(50)).toBe(STAGGER_MAX_INDEX * STAGGER_STEP_MS);
    expect(staggerDelayMs(200)).toBe(STAGGER_MAX_INDEX * STAGGER_STEP_MS);
  });

  it("never returns a negative delay", () => {
    expect(staggerDelayMs(-4)).toBe(0);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npm test -- --maxWorkers=2 stagger`
Expected: FAIL, "Failed to resolve import ./stagger".

- [ ] **Step 3: Implement**

Create `src/lib/stagger.ts`:

```ts
export const STAGGER_STEP_MS = 40;
/** Past this, everything shares the final delay. A 200-row list staggered
 *  uncapped would take eight seconds to finish arriving. */
export const STAGGER_MAX_INDEX = 12;

export function staggerDelayMs(index: number): number {
  if (index <= 0) return 0;
  return Math.min(index, STAGGER_MAX_INDEX) * STAGGER_STEP_MS;
}
```

- [ ] **Step 4: Run the test**

Run: `npm test -- --maxWorkers=2 stagger`
Expected: PASS, 3 tests.

- [ ] **Step 5: Add the CSS**

In `src/styles.css`, beside the other component rules:

```css
/* A streak of light crossing the viewport as a screen changes. An overlay above
   both screens rather than a transition between them, which is what lets it
   avoid the exit-animation machinery entirely. */
.orbit-route-sweep {
  background: linear-gradient(
    100deg,
    transparent 42%,
    rgba(34, 211, 238, 0.14) 50%,
    transparent 58%
  );
  inset: 0;
  pointer-events: none;
  position: fixed;
  transform: translateX(-100%);
  z-index: 40;
}

/* Items settle in one after another. The delay comes from --stagger-index,
   which callers set from the render index via staggerDelayMs. */
.orbit-stagger {
  --stagger-index: 0;
}
```

And inside the existing `@media (prefers-reduced-motion: no-preference)` block:

```css
  .orbit-route-sweep--playing {
    animation: orbit-route-sweep 320ms ease-out;
  }

  .orbit-stagger {
    animation: orbit-page-enter 320ms ease-out both;
    animation-delay: calc(var(--stagger-index) * 1ms);
  }
```

And beside the other keyframes:

```css
@keyframes orbit-route-sweep {
  from {
    transform: translateX(-100%);
  }

  to {
    transform: translateX(100%);
  }
}
```

- [ ] **Step 6: Play the sweep on navigation**

In `src/app/route-transition.tsx`, inside `RouteSettle`, add a second ref for a sweep element and render it as a sibling of the wrapper:

```tsx
      <div className="orbit-route-sweep" ref={sweepRef} />
```

In the **existing** `useEffect` that replays the settle — after the reduced-motion guard, so it inherits it — restart the sweep by removing and re-adding the class, forcing a reflow between so the animation replays:

```tsx
    const sweep = sweepRef.current;
    if (sweep) {
      sweep.classList.remove("orbit-route-sweep--playing");
      // Reading offsetWidth forces a reflow, which is what makes the class
      // re-add restart the animation rather than being coalesced away.
      void sweep.offsetWidth;
      sweep.classList.add("orbit-route-sweep--playing");
    }
```

Do not add a second effect and do not add a second reduced-motion check.

- [ ] **Step 7: Stagger the kanban cards**

In `src/features/work-items/kanban-board.tsx`, add the import:

```tsx
import { staggerDelayMs } from "../../lib/stagger";
```

The card `.map(...)` gives an index — add it to the callback signature if it is not already there. Then add `orbit-stagger` to the card's class list and set the property:

```tsx
                style={{ "--stagger-index": String(staggerDelayMs(index)) } as React.CSSProperties}
```

Note the CSS multiplies by `1ms`, so the value passed is already the delay in milliseconds. It is passed as a **string** deliberately: React appends `px` to numeric values for some properties, and a stringified number cannot be caught by that.

- [ ] **Step 8: Run the suite and build**

```bash
npm test -- --maxWorkers=2
npm run build
```

Expected: all passing, clean build.

- [ ] **Step 9: Commit**

```bash
git add src/styles.css src/app/route-transition.tsx src/features/work-items/kanban-board.tsx src/lib/stagger.ts src/lib/stagger.test.ts
git commit -m "feat: sweep light between screens and stagger list entry"
```

---

## Task 4: Count-up on the dashboard

**Files:**
- Create: `src/lib/use-count-up.ts`, `src/lib/use-count-up.test.ts`
- Modify: `src/features/dashboard/dashboard-page.tsx`

**Interfaces:**
- Produces: `export function useCountUp(value: number, durationMs?: number): number`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/use-count-up.test.ts`:

```ts
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useCountUp } from "./use-count-up";

function setReducedMotion(matches: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: query.includes("reduce") ? matches : false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
    onchange: null,
  })) as unknown as typeof window.matchMedia;
}

describe("useCountUp", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("returns the final value immediately under reduced motion", () => {
    // A number ticking up is motion, and CSS cannot reach a number. Without
    // this branch a reduce-preference user watches every stat animate.
    setReducedMotion(true);
    const { result } = renderHook(() => useCountUp(42, 500));

    expect(result.current).toBe(42);
  });

  it("starts at zero and reaches the value", () => {
    setReducedMotion(false);
    const { result } = renderHook(() => useCountUp(50, 500));

    expect(result.current).toBe(0);

    act(() => { vi.advanceTimersByTime(500); });
    expect(result.current).toBe(50);
  });

  it("retargets when the value changes mid-count", () => {
    // A refetch that changes the number must not leave it stranded partway to
    // the old target.
    setReducedMotion(false);
    const { result, rerender } = renderHook(({ v }) => useCountUp(v, 500), {
      initialProps: { v: 50 },
    });

    act(() => { vi.advanceTimersByTime(250); });
    rerender({ v: 80 });
    act(() => { vi.advanceTimersByTime(500); });

    expect(result.current).toBe(80);
  });

  it("handles zero without dividing by it", () => {
    setReducedMotion(false);
    const { result } = renderHook(() => useCountUp(0, 500));

    act(() => { vi.advanceTimersByTime(500); });
    expect(result.current).toBe(0);
  });
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npm test -- --maxWorkers=2 use-count-up`
Expected: FAIL, "Failed to resolve import ./use-count-up".

- [ ] **Step 3: Implement**

Create `src/lib/use-count-up.ts`:

```ts
import { useEffect, useState } from "react";

const DEFAULT_DURATION_MS = 700;
const TICK_MS = 1000 / 30;

/**
 * A number that ticks up to its value.
 *
 * Uses an interval rather than requestAnimationFrame because a counter updates
 * React state on every step, and 30 updates a second is already more than the
 * eye needs from a dashboard stat - rAF would do twice the renders for no
 * visible gain.
 *
 * Carries its own reduced-motion guard: a counting number is motion, and CSS
 * cannot reach a number.
 */
export function useCountUp(value: number, durationMs: number = DEFAULT_DURATION_MS): number {
  const [display, setDisplay] = useState(() => {
    const query = typeof window !== "undefined" ? window.matchMedia?.("(prefers-reduced-motion: reduce)") : null;
    return query?.matches ? value : 0;
  });

  useEffect(() => {
    const query = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (query?.matches) {
      setDisplay(value);
      return;
    }

    const from = display;
    if (from === value) return;

    const startedAt = Date.now();
    const timer = setInterval(() => {
      const progress = Math.min(1, (Date.now() - startedAt) / Math.max(durationMs, 1));
      // Ease-out: fast at first, settling at the end. A linear count reads
      // mechanical.
      const eased = 1 - (1 - progress) ** 3;
      setDisplay(Math.round(from + (value - from) * eased));
      if (progress >= 1) clearInterval(timer);
    }, TICK_MS);

    return () => clearInterval(timer);
    // `display` is deliberately not a dependency: including it would restart
    // the count on every tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, durationMs]);

  return display;
}
```

- [ ] **Step 4: Run the tests**

Run: `npm test -- --maxWorkers=2 use-count-up`
Expected: PASS, 4 tests.

If the "starts at zero" test fails because `Date.now()` does not advance under fake timers, use `vi.useFakeTimers({ shouldAdvanceTime: true })` in `beforeEach` — and say in your report that you did.

- [ ] **Step 5: Wire the dashboard**

In `src/features/dashboard/dashboard-page.tsx`, add:

```tsx
import { useCountUp } from "../../lib/use-count-up";
```

Apply it to the large stat number — the element rendering `{count}` inside `<p className="mt-2 text-3xl font-black text-white">` — and to `missionProgress`, the percentage computed as `Math.round((completedProjects / totalProjects) * 100)`.

Hooks cannot be called inside a `.map`, so if the stat number is rendered in a loop, extract that card into a small component in the same file and call the hook there. **Do not call a hook conditionally or in a loop body.**

Leave every other number alone. Counting up a list length like `grouped.later.length` inside a label reads as a glitch, not a flourish.

- [ ] **Step 6: Run the suite and build**

```bash
npm test -- --maxWorkers=2
npm run build
```

Expected: all passing, clean build. **If an existing dashboard test asserts on a rendered number, it may now see `0` on first render.** Report it rather than modifying the test — that is a real behaviour change worth a decision.

- [ ] **Step 7: Commit**

```bash
git add src/lib/use-count-up.ts src/lib/use-count-up.test.ts src/features/dashboard/dashboard-page.tsx
git commit -m "feat: tick dashboard numbers up instead of snapping them in"
```

---

## Self-review notes

**Spec coverage.** The violet glow on five surface classes → Task 1. The vendored canvas with all six departures → Task 2. Light sweep and staggered lists → Task 3. Count-up → Task 4. The licence record → Task 2 step 7.

**The trap in Task 1, and why it is step-by-step.** All five surface classes already carry a `box-shadow`. The obvious implementation — adding a `box-shadow` declaration — would replace it and silently delete the entire elevation model across ~58 surfaces. Step 3 exists to prove the original values survived, not just that the glow arrived.

**Why the electric border is an overlay.** The spec said wrapping was acceptable for one element. Reading the board confirmed the columns are flex items in a horizontal scroller, where a wrapper would change layout. An absolutely-positioned overlay inside the already-relative section changes nothing and is strictly better.

**Two places the plan says stop rather than guess.** If the column `<section>` is not already `position: relative`, and if a dashboard test asserts on a number that now starts at zero. Both are cases where a plausible-looking fix hides a real change.

**What is not tested, and why.** The canvas drawing itself. jsdom has no 2D rendering worth asserting on, and mocking a context would prove only that the mock works. The reduced-motion guard — the one thing that genuinely protects a user — is tested instead.
