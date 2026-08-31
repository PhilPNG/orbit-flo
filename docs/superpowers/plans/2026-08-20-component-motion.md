# Component Motion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the foreground say what is happening — a border that marks the card you are dragging, editing, or focused on — and make screens arrive instead of appearing.

**Architecture:** A CSS class with two modifiers, bound to states that are singular by construction, so the craft rules hold without anyone remembering them. Route transitions are two small changes in one file. Hover polish uses one delegated listener per container rather than one per card.

**Tech Stack:** React 19, TypeScript, Vite, Tailwind v4, Vitest + Testing Library.

## Global Constraints

- Run tests with `npm test -- --maxWorkers=2`.
- End every commit message with: `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`
- **The full suite must stay at 774 passing.** No existing test may be modified. If one breaks, the implementation is wrong, not the test.
- **No new dependency.** Not GSAP, not Motion, not React Bits as a package.
- **Cyan `#22d3ee` (`--orbit-cyan`) is the only interaction colour.** The state border uses it and introduces no new colour.
- **Loops run at a minimum 3-second period** and only on states that are singular by construction. Never on repeated list items.
- **All CSS animation goes inside `@media (prefers-reduced-motion: no-preference)`**, matching how `styles.css` already gates `orbit-page-enter` and every other keyframe. Canvas work needs its own explicit guard.

---

## File Structure

**Modify:** `src/styles.css` — the `.orbit-state-border` class and its two modifiers, the `@property` registration for the border angle, the spotlight and glare rules.

**Create:** `src/lib/use-recently-updated.ts` and `src/lib/use-recently-updated.test.ts` — the one piece of new state machinery, in `src/lib/` beside `quick-add.ts` and `orbit-assets.ts`, which is where this project keeps logic with co-located tests.

**Create:** `src/components/click-spark.tsx` and `src/components/click-spark.test.tsx`.

**Modify:** `src/app/routes.tsx` — keyed settle and delayed fallback.

**Modify:** `src/features/work-items/kanban-board.tsx` — the just-updated binding and the delegated spotlight listener.

**Modify:** `src/components/global-quick-add.tsx` — Click Spark on the send button. Not `modal.tsx`: it renders only a secondary close button and caller-supplied children, so it has no primary action to attach to.

---

## Task 1: State borders

**Files:**
- Modify: `src/styles.css`
- Create: `src/lib/use-recently-updated.ts`, `src/lib/use-recently-updated.test.ts`
- Modify: `src/features/work-items/kanban-board.tsx`

**Interfaces:**
- Produces:
  - `export function pickRecentlyChanged(previous: ReadonlyMap<string, string>, next: ReadonlyMap<string, string>): string[]`
  - `export function useRecentlyUpdated(signature: ReadonlyMap<string, string>, holdMs?: number): ReadonlySet<string>`
  - CSS classes `orbit-state-border`, `orbit-state-border--live`, `orbit-state-border--once`

### Background you need

**The dragging binding needs no JavaScript.** `kanban-board.tsx:380` already applies `kanban-drag-source` when `draggedItemId === item.id`, and **that class currently has no CSS rule at all** — it is a hook waiting to be styled. Do not add new drag state.

The card element is at `kanban-board.tsx:377-386`: an `<article>` with `className={clsx("kanban-card orbit-task-card relative grid cursor-grab gap-3 rounded-md border border-slate-400/10 bg-slate-950/45 p-3", draggedItemId === item.id && "kanban-drag-source")}` and a `data-kanban-card` attribute.

The border effect animates a **registered custom property**. `@property` needs Chrome 85 / Safari 16.4 / Firefox 128. Where it is unsupported the property is not interpolated — CSS flips it at the halfway point, and since 0deg and 360deg render identically the border simply sits still. That is an acceptable, silent degradation to a static cyan arc, and it is why no separate fallback is written.

- [ ] **Step 1: Write the failing tests for the pure function**

Create `src/lib/use-recently-updated.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { pickRecentlyChanged } from "./use-recently-updated";

const map = (entries: Array<[string, string]>) => new Map(entries);

describe("pickRecentlyChanged", () => {
  it("returns nothing when no signature changed", () => {
    const before = map([["a", "1"], ["b", "1"]]);
    expect(pickRecentlyChanged(before, map([["a", "1"], ["b", "1"]]))).toEqual([]);
  });

  it("returns an id whose signature changed", () => {
    expect(pickRecentlyChanged(map([["a", "1"]]), map([["a", "2"]]))).toEqual(["a"]);
  });

  it("ignores ids it has never seen before", () => {
    // The load-flash guard, and the most important case here. On first render
    // the previous map is empty; treating new ids as "updated" would flash
    // every card on the board at once - exactly the failure this design exists
    // to avoid.
    expect(pickRecentlyChanged(new Map(), map([["a", "1"], ["b", "1"]]))).toEqual([]);
  });

  it("ignores ids that disappeared", () => {
    expect(pickRecentlyChanged(map([["a", "1"]]), new Map())).toEqual([]);
  });

  it("returns every changed id, not just the first", () => {
    const before = map([["a", "1"], ["b", "1"], ["c", "1"]]);
    const after = map([["a", "2"], ["b", "1"], ["c", "9"]]);
    expect(pickRecentlyChanged(before, after).sort()).toEqual(["a", "c"]);
  });
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npm test -- --maxWorkers=2 use-recently-updated`
Expected: FAIL, "Failed to resolve import ./use-recently-updated".

- [ ] **Step 3: Implement the hook**

Create `src/lib/use-recently-updated.ts`:

```ts
import { useEffect, useRef, useState } from "react";

const DEFAULT_HOLD_MS = 1200;

/**
 * Ids whose signature differs between two snapshots.
 *
 * An id absent from `previous` is deliberately NOT reported. On first render
 * the previous snapshot is empty, so treating new ids as updated would flag
 * every card on the board at once. The cost of that choice is that a
 * newly-created card does not flash; the alternative is that all forty do.
 */
export function pickRecentlyChanged(
  previous: ReadonlyMap<string, string>,
  next: ReadonlyMap<string, string>,
): string[] {
  const changed: string[] = [];
  next.forEach((value, id) => {
    const before = previous.get(id);
    if (before !== undefined && before !== value) changed.push(id);
  });
  return changed;
}

/**
 * Which ids changed recently, for the one-pass "just updated" border.
 *
 * The effect runs on every render with no dependency array, on purpose. A
 * `Map` built inline by the caller has a new identity every render, so a
 * dependency on it would fire constantly — and asking callers to memoise is
 * the same footgun that made GalaxyCanvas take no props. Running every render
 * is safe because a render in which nothing changed does no work: the ref is
 * already up to date, `pickRecentlyChanged` returns empty, and the effect
 * returns before touching state.
 */
export function useRecentlyUpdated(
  signature: ReadonlyMap<string, string>,
  holdMs: number = DEFAULT_HOLD_MS,
): ReadonlySet<string> {
  const previousRef = useRef<ReadonlyMap<string, string>>(new Map());
  const timersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const [flagged, setFlagged] = useState<ReadonlySet<string>>(new Set());

  useEffect(() => {
    const changed = pickRecentlyChanged(previousRef.current, signature);
    previousRef.current = signature;
    if (changed.length === 0) return;

    setFlagged((current) => {
      const next = new Set(current);
      changed.forEach((id) => next.add(id));
      return next;
    });

    const timers = timersRef.current;
    changed.forEach((id) => {
      // An id that changes twice in quick succession restarts its hold. Without
      // this the first timer would clear the border while the second change is
      // still fresh.
      const running = timers.get(id);
      if (running) clearTimeout(running);

      timers.set(
        id,
        setTimeout(() => {
          timers.delete(id);
          setFlagged((current) => {
            if (!current.has(id)) return current;
            const next = new Set(current);
            next.delete(id);
            return next;
          });
        }, holdMs),
      );
    });
  });

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach((timer) => clearTimeout(timer));
      timers.clear();
    };
  }, []);

  return flagged;
}
```

- [ ] **Step 4: Run the pure-function tests**

Run: `npm test -- --maxWorkers=2 use-recently-updated`
Expected: PASS, 5 tests.

- [ ] **Step 5: Add the hook's timer test**

Append to `src/lib/use-recently-updated.test.ts`:

```ts
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, vi } from "vitest";
import { useRecentlyUpdated } from "./use-recently-updated";

describe("useRecentlyUpdated", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("flags a changed id and clears it after the hold", () => {
    const { result, rerender } = renderHook(({ sig }) => useRecentlyUpdated(sig, 1000), {
      initialProps: { sig: map([["a", "1"]]) },
    });

    expect([...result.current]).toEqual([]);

    rerender({ sig: map([["a", "2"]]) });
    expect([...result.current]).toEqual(["a"]);

    act(() => { vi.advanceTimersByTime(1000); });
    expect([...result.current]).toEqual([]);
  });

  it("restarts the hold when an id changes again", () => {
    // Without the clearTimeout in the implementation, the first timer would
    // fire 400ms after the second change and clear a border that is still
    // fresh.
    const { result, rerender } = renderHook(({ sig }) => useRecentlyUpdated(sig, 1000), {
      initialProps: { sig: map([["a", "1"]]) },
    });

    rerender({ sig: map([["a", "2"]]) });
    act(() => { vi.advanceTimersByTime(600); });
    rerender({ sig: map([["a", "3"]]) });

    act(() => { vi.advanceTimersByTime(600); });
    expect([...result.current]).toEqual(["a"]);

    act(() => { vi.advanceTimersByTime(400); });
    expect([...result.current]).toEqual([]);
  });
});
```

Move the `import` lines to the top of the file with the existing ones rather than leaving them mid-file.

- [ ] **Step 6: Run the hook tests**

Run: `npm test -- --maxWorkers=2 use-recently-updated`
Expected: PASS, 7 tests.

- [ ] **Step 7: Add the border CSS**

In `src/styles.css`, add near the other component classes (before the `@media (prefers-reduced-motion: no-preference)` block):

```css
/* A travelling arc of the interaction colour, drawn in the element's own
   border box via a masked conic gradient so it needs no extra DOM.
   The angle is a registered property because unregistered custom properties
   do not interpolate. Where @property is unsupported (Firefox < 128) the
   angle flips at the halfway point instead of animating, and since 0deg and
   360deg render identically the arc simply sits still - a static cyan edge,
   which is a fine thing to degrade to. */
@property --orbit-border-angle {
  syntax: "<angle>";
  inherits: false;
  initial-value: 0deg;
}

.orbit-state-border {
  position: relative;
}

.orbit-state-border::after {
  border-radius: inherit;
  content: "";
  inset: -1px;
  mask:
    linear-gradient(#000 0 0) content-box,
    linear-gradient(#000 0 0);
  mask-composite: exclude;
  -webkit-mask:
    linear-gradient(#000 0 0) content-box,
    linear-gradient(#000 0 0);
  -webkit-mask-composite: xor;
  /* Invisible until a state asks for it. Without this every card on the board
     would carry a static cyan arc at rest - the forty-cards problem arriving
     by the back door, which is the exact thing this design exists to avoid. */
  opacity: 0;
  padding: 1px;
  pointer-events: none;
  position: absolute;
  transition: opacity 180ms ease-out;
  background: conic-gradient(
    from var(--orbit-border-angle),
    transparent 0deg,
    var(--orbit-cyan) 38deg,
    transparent 116deg
  );
}

/* The four states that reveal the arc. kanban-board.tsx already applies
   kanban-drag-source from its existing draggedItemId state; it simply had no
   rule until now. */
.orbit-state-border--live::after,
.orbit-state-border--once::after,
.kanban-drag-source::after,
.orbit-state-border:focus-visible::after {
  opacity: 1;
}

/* The arc replaces the default ring, which would otherwise sit on top of it. */
.orbit-state-border:focus-visible {
  outline: none;
}
```

Then add these inside the existing `@media (prefers-reduced-motion: no-preference)` block, beside the `.orbit-page-enter` rule:

```css
  /* 3.2s, above the 3s floor the design language sets for loops. Anything
     faster reads as arcade rather than ambient. */
  .orbit-state-border--live::after,
  .kanban-drag-source::after,
  .orbit-state-border:focus-visible::after {
    animation: orbit-border-travel 3.2s linear infinite;
  }

  .orbit-state-border--once::after {
    animation: orbit-border-travel 1.2s ease-out 1;
  }
```

And add the keyframe beside the other `@keyframes` blocks:

```css
@keyframes orbit-border-travel {
  to {
    --orbit-border-angle: 360deg;
  }
}
```

Note `.kanban-drag-source` needs the `::after` from `.orbit-state-border`, so the card must carry both classes — Step 8 does that.

- [ ] **Step 8: Wire the kanban card**

In `src/features/work-items/kanban-board.tsx`, add the import:

```tsx
import { useRecentlyUpdated } from "../../lib/use-recently-updated";
```

Inside the component, after the existing `items` are available, build the signature and call the hook:

```tsx
  // updated_at is the field every mutation touches, so it is the signature of
  // "this card changed". Built inline on purpose: the hook compares content
  // rather than identity, so it does not need memoising.
  const recentlyUpdated = useRecentlyUpdated(
    new Map(items.map((item) => [item.id, item.updated_at ?? ""])),
  );
```

Then extend the card's `clsx` at line 378-381 to:

```tsx
                className={clsx(
                  "kanban-card orbit-task-card orbit-state-border relative grid cursor-grab gap-3 rounded-md border border-slate-400/10 bg-slate-950/45 p-3",
                  draggedItemId === item.id && "kanban-drag-source",
                  recentlyUpdated.has(item.id) && "orbit-state-border--once",
                )}
```

If `items` elements have no `updated_at` field, use whichever timestamp field the type does have and say so in your report — do not invent one.

- [ ] **Step 9: Run the suite and build**

```bash
npm test -- --maxWorkers=2
npm run build
```

Expected: 774 existing plus 7 new, all passing, clean build.

- [ ] **Step 10: Commit**

```bash
git add src/styles.css src/lib/use-recently-updated.ts src/lib/use-recently-updated.test.ts src/features/work-items/kanban-board.tsx
git commit -m "feat: mark the card you are dragging, editing, or focused on"
```

---

## Task 2: Route transitions

**Files:**
- Modify: `src/app/routes.tsx`

**Interfaces:**
- Consumes: the existing `orbit-page-enter` class in `src/styles.css`.

### Background you need

`src/app/routes.tsx:45-58` currently reads:

```tsx
export function RouteFallback() {
  return (
    <div className="orbit-loading-shell rounded-lg border border-white/10 bg-slate-950/60 px-4 py-5">
      <div className="relative z-10 grid gap-2">
        <SatelliteLoader label="Systems online" />
        <p className="text-xs font-semibold text-slate-400">Synchronizing workspace telemetry.</p>
      </div>
    </div>
  );
}

function LazyRoute({ children }: { children: ReactNode }) {
  return <Suspense fallback={<RouteFallback />}>{children}</Suspense>;
}
```

`RouteFallback` is **exported and used elsewhere** — leave it exactly as it is and wrap it, rather than changing it.

`orbit-page-enter` already exists in `src/styles.css` (a `will-change` rule at ~line 910, and its animation inside the `no-preference` media block at ~line 1498). Nothing new is needed in CSS.

`<main>` in `app-shell.tsx:177-179` renders `<div className="mx-auto w-full max-w-7xl">{children}</div>` — a plain block container, so an extra wrapper div inside it is layout-safe.

- [ ] **Step 1: Write the failing tests**

Create `src/app/delayed-fallback.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DelayedFallback, FALLBACK_DELAY_MS } from "./routes";

describe("DelayedFallback", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("renders nothing before the delay", () => {
    // The point of the whole change: a cached route resolves inside this
    // window, so the user never sees a spinner flash.
    render(<DelayedFallback />);

    act(() => { vi.advanceTimersByTime(FALLBACK_DELAY_MS - 1); });
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("renders the loader once the delay has passed", () => {
    // The other half. A fallback that never appears is as wrong as one that
    // always does - a genuinely slow route must still show progress.
    render(<DelayedFallback />);

    act(() => { vi.advanceTimersByTime(FALLBACK_DELAY_MS); });
    expect(screen.getByRole("status")).toBeTruthy();
  });
});
```

`SatelliteLoader` renders `role="status"`, which is what these assertions hook onto.

- [ ] **Step 2: Run them and watch them fail**

Run: `npm test -- --maxWorkers=2 delayed-fallback`
Expected: FAIL — `DelayedFallback` and `FALLBACK_DELAY_MS` are not exported from `./routes`.

- [ ] **Step 3: Implement**

In `src/app/routes.tsx`, change the imports:

```tsx
import { BrowserRouter, Outlet, Route, Routes, useLocation } from "react-router-dom";
import { lazy, Suspense, useEffect, useState, type ReactNode } from "react";
```

Add below the existing `RouteFallback` (leave `RouteFallback` unchanged):

```tsx
/** Long enough that a cached chunk resolves first, short enough that a genuinely
 *  slow route still reports progress promptly. */
export const FALLBACK_DELAY_MS = 150;

/**
 * The loader, withheld briefly.
 *
 * Most navigations in this app resolve almost immediately because the chunk is
 * already cached, and showing a spinner for three frames reads as jank rather
 * than as feedback. This renders nothing until the route has actually been slow
 * enough to warrant saying so.
 */
export function DelayedFallback() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), FALLBACK_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);

  return visible ? <RouteFallback /> : null;
}
```

Then replace `LazyRoute`:

```tsx
function LazyRoute({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();

  return (
    <Suspense fallback={<DelayedFallback />}>
      {/* Keyed on pathname so each screen remounts and replays the existing
          settle. The class is already defined in styles.css and already gated
          on prefers-reduced-motion. */}
      <div className="orbit-page-enter" key={pathname}>
        {children}
      </div>
    </Suspense>
  );
}
```

- [ ] **Step 4: Run the tests**

Run: `npm test -- --maxWorkers=2 delayed-fallback`
Expected: PASS, 2 tests.

- [ ] **Step 5: Run the suite and build**

```bash
npm test -- --maxWorkers=2
npm run build
```

Expected: all passing. **Watch for tests that assert on the loader appearing during navigation** — if any existing test breaks here, it is because the loader is now delayed, and that is a real behaviour change worth reporting rather than papering over. Report it; do not modify the test.

- [ ] **Step 6: Commit**

```bash
git add src/app/routes.tsx src/app/delayed-fallback.test.tsx
git commit -m "feat: let screens settle in and stop the spinner flashing"
```

---

## Task 3: Hover and click polish

**Files:**
- Modify: `src/styles.css`
- Create: `src/components/click-spark.tsx`, `src/components/click-spark.test.tsx`
- Modify: `src/features/work-items/kanban-board.tsx`
- Modify: `src/components/global-quick-add.tsx`

**Interfaces:**
- Produces: `export function ClickSpark({ children }: { children: ReactNode }): JSX.Element`
- Consumes: the `data-kanban-card` attribute already on the kanban card element.

### Background you need

The kanban card at `kanban-board.tsx:377` already carries `data-kanban-card`, which is what the delegated listener resolves with `closest()`.

**One listener per container, not one per card.** With forty cards, per-card `pointermove` handlers mean forty listeners each doing a layout read. The container-level listener resolves the hovered card once.

Click Spark draws to a canvas, which CSS cannot reach, so it needs its own `matchMedia` guard — unlike everything else here, which inherits the global reduced-motion rule.

- [ ] **Step 1: Add the spotlight and glare CSS**

In `src/styles.css`, beside the `.orbit-state-border` rules:

```css
/* A highlight that follows the pointer inside a card. The coordinates are set
   by one delegated listener per container - see kanban-board.tsx - rather than
   a listener per card. Defaults put it off-card so a card that has never been
   hovered shows nothing. */
.orbit-spotlight {
  --spot-x: -100%;
  --spot-y: -100%;
  position: relative;
}

.orbit-spotlight::before {
  background: radial-gradient(
    18rem circle at var(--spot-x) var(--spot-y),
    color-mix(in srgb, var(--orbit-cyan) 7%, transparent),
    transparent 60%
  );
  border-radius: inherit;
  content: "";
  inset: 0;
  opacity: 0;
  pointer-events: none;
  position: absolute;
  transition: opacity 220ms ease-out;
}

.orbit-spotlight:hover::before {
  opacity: 1;
}

/* A sheen crossing the surface on hover. Pure CSS, no JavaScript. */
.orbit-glare {
  overflow: hidden;
  position: relative;
}

.orbit-glare::after {
  background: linear-gradient(
    105deg,
    transparent 40%,
    color-mix(in srgb, #ffffff 8%, transparent) 50%,
    transparent 60%
  );
  content: "";
  inset: 0;
  pointer-events: none;
  position: absolute;
  transform: translateX(-100%);
}
```

And inside the existing `@media (prefers-reduced-motion: no-preference)` block:

```css
  .orbit-glare:hover::after {
    transition: transform 620ms ease-out;
    transform: translateX(100%);
  }
```

- [ ] **Step 2: Write the failing Click Spark tests**

Create `src/components/click-spark.test.tsx`:

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ClickSpark } from "./click-spark";

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

describe("ClickSpark", () => {
  afterEach(() => vi.restoreAllMocks());

  it("renders its children", () => {
    setReducedMotion(false);
    render(<ClickSpark><button type="button">Launch</button></ClickSpark>);

    expect(screen.getByRole("button", { name: "Launch" })).toBeTruthy();
  });

  it("draws nothing when the user prefers reduced motion", () => {
    // Canvas is the one thing the global CSS reduced-motion rule cannot reach,
    // so this guard is the only thing standing between a reduce-preference user
    // and an animation. It gets its own test for that reason.
    setReducedMotion(true);
    const { container } = render(
      <ClickSpark><button type="button">Launch</button></ClickSpark>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Launch" }));
    expect(container.querySelector("canvas")).toBeNull();
  });

  it("mounts a canvas when motion is allowed", () => {
    setReducedMotion(false);
    const { container } = render(
      <ClickSpark><button type="button">Launch</button></ClickSpark>,
    );

    expect(container.querySelector("canvas")).not.toBeNull();
  });
});
```

- [ ] **Step 3: Run them and watch them fail**

Run: `npm test -- --maxWorkers=2 click-spark`
Expected: FAIL, "Failed to resolve import ./click-spark".

- [ ] **Step 4: Implement Click Spark**

Create `src/components/click-spark.tsx`:

```tsx
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

const SPARK_COUNT = 8;
const SPARK_LIFE_MS = 380;
const SPARK_RADIUS = 16;

type Spark = { x: number; y: number; angle: number; bornAt: number };

/**
 * A short burst at the click point.
 *
 * This is the only effect in this pass that draws to a canvas, which is why it
 * carries its own reduced-motion guard: the global CSS rule in styles.css
 * neutralises `animation` and `transition`, and reaches nothing here.
 *
 * Deliberately NOT used on the kanban board or the mind map. Both are
 * drag-and-pan surfaces where per-pointer work competes with the interaction
 * people actually came for.
 */
export function ClickSpark({ children }: { children: ReactNode }) {
  const hostRef = useRef<HTMLSpanElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sparksRef = useRef<Spark[]>([]);
  const frameRef = useRef(0);
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

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    const now = performance.now();
    sparksRef.current = sparksRef.current.filter((s) => now - s.bornAt < SPARK_LIFE_MS);
    context.clearRect(0, 0, canvas.width, canvas.height);

    sparksRef.current.forEach((spark) => {
      const life = (now - spark.bornAt) / SPARK_LIFE_MS;
      const distance = SPARK_RADIUS * life;
      context.globalAlpha = 1 - life;
      context.strokeStyle = "#22d3ee";
      context.lineWidth = 1.5;
      context.beginPath();
      context.moveTo(spark.x + Math.cos(spark.angle) * distance, spark.y + Math.sin(spark.angle) * distance);
      context.lineTo(
        spark.x + Math.cos(spark.angle) * (distance + 5),
        spark.y + Math.sin(spark.angle) * (distance + 5),
      );
      context.stroke();
    });

    frameRef.current = sparksRef.current.length > 0 ? requestAnimationFrame(draw) : 0;
  }, []);

  const handleClick = useCallback(
    (event: React.MouseEvent<HTMLSpanElement>) => {
      if (!allowed) return;
      const host = hostRef.current;
      const canvas = canvasRef.current;
      if (!host || !canvas) return;

      const rect = host.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;

      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      const bornAt = performance.now();
      for (let i = 0; i < SPARK_COUNT; i += 1) {
        sparksRef.current.push({ x, y, angle: (i / SPARK_COUNT) * Math.PI * 2, bornAt });
      }

      if (frameRef.current === 0) frameRef.current = requestAnimationFrame(draw);
    },
    [allowed, draw],
  );

  useEffect(() => () => {
    if (frameRef.current !== 0) cancelAnimationFrame(frameRef.current);
  }, []);

  return (
    <span className="relative inline-block" onClick={handleClick} ref={hostRef}>
      {children}
      {allowed ? (
        <canvas
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 h-full w-full"
          ref={canvasRef}
        />
      ) : null}
    </span>
  );
}
```

- [ ] **Step 5: Run the tests**

Run: `npm test -- --maxWorkers=2 click-spark`
Expected: PASS, 3 tests.

- [ ] **Step 6: Wire the spotlight and glare**

In `src/features/work-items/kanban-board.tsx`, add the spotlight class to the card's `clsx` (which after Task 1 already contains `orbit-state-border`):

```tsx
                  "kanban-card orbit-task-card orbit-state-border orbit-spotlight relative grid cursor-grab gap-3 rounded-md border border-slate-400/10 bg-slate-950/45 p-3",
```

Then add one delegated listener on the columns container. The scrolling container is at line ~224, `className="flex w-full items-start gap-3 overflow-x-auto pb-2"`. Give it a handler:

```tsx
  // One listener for the whole board rather than one per card. With forty
  // cards, per-card handlers would mean forty layout reads per pointer move.
  const handleBoardPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const card = (event.target as HTMLElement).closest<HTMLElement>("[data-kanban-card]");
    if (!card) return;
    const rect = card.getBoundingClientRect();
    card.style.setProperty("--spot-x", `${event.clientX - rect.left}px`);
    card.style.setProperty("--spot-y", `${event.clientY - rect.top}px`);
  };
```

and attach it with `onPointerMove={handleBoardPointerMove}` on that container div.

- [ ] **Step 7: Wire Click Spark to the quick-add send button**

**Not the modal.** `src/components/modal.tsx` renders only a secondary close
button and `{children}` — it has no primary action of its own, and wrapping its
children would put a canvas over arbitrary caller content. There is also no
`orbit-button-primary` class anywhere in `src/`, so there is no shared primary
button to target.

The concrete primary action to use is the quick-add send button at
`src/components/global-quick-add.tsx:85` — a `type="submit"` button containing a
`Send` icon. It is used constantly, it is a real commit-something action, and it
is nowhere near the kanban board or the mind map.

Wrap **only that button**:

```tsx
<ClickSpark>
  {/* the existing <button type="submit"> ... </button>, unchanged */}
</ClickSpark>
```

Add `import { ClickSpark } from "./click-spark";` to that file.

Check afterwards that the button still submits its form — `ClickSpark` renders a
`<span>` wrapper, which does not break form association, but the existing
quick-add test must still pass. If it does not, report it rather than changing
the test.

- [ ] **Step 8: Run the suite and build**

```bash
npm test -- --maxWorkers=2
npm run build
```

Expected: all passing, clean build.

- [ ] **Step 9: Commit**

```bash
git add src/styles.css src/components/click-spark.tsx src/components/click-spark.test.tsx src/features/work-items/kanban-board.tsx src/components/global-quick-add.tsx
git commit -m "feat: add pointer spotlight, hover glare, and click sparks"
```

---

## Self-review notes

**Spec coverage.** The `.orbit-state-border` class and its two modifiers, the three bindings, and `useRecentlyUpdated` → Task 1. Keyed settle and delayed fallback → Task 2. Spotlight, glare and Click Spark with its guard → Task 3. The craft rules are satisfied structurally: dragging and focus are singular by definition and `--once` is not a loop.

**Where the dragging binding went.** Nowhere — `kanban-drag-source` was already applied from existing state and simply had no CSS. Task 1 styles it. That is the whole change, and it is worth noticing that the most-requested effect needed no new state at all.

**Why the effect in `useRecentlyUpdated` has no dependency array.** A `Map` built inline has a fresh identity every render, so depending on it would fire constantly, and requiring callers to memoise is the footgun that made `GalaxyCanvas` take no props. Running every render is safe because a render with no change does no work and touches no state.

**The load-flash guard is the important test.** `pickRecentlyChanged` ignoring unseen ids is what stops every card flashing on first paint — which would be the forty-shimmering-cards failure the whole design exists to avoid, arriving by the back door.

**One correction found by self-review.** The first draft painted `.orbit-state-border::after` unconditionally, which would have given every card a static cyan arc at rest — the forty-cards problem arriving by the back door, in the very plan written to prevent it. The arc is now `opacity: 0` until a state reveals it.

**Two things checked rather than assumed.** `updated_at` does exist on work items (`work-items.queries.ts:35` orders by it), so Task 1's signature field is real. And `modal.tsx` has no primary action, which is why Task 3 targets the quick-add send button instead — that branch of the plan was written before checking and has been corrected rather than left as a guess for the implementer.
