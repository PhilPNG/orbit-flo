# UI/UX Overhaul — Phases 1–2 (Foundation + Today Page) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the "Deep Space Observatory" visual foundation (3 surfaces, crafted starfield, 5-verb motion vocabulary) and rebuild the home page as a calm, centered "Today" view.

**Architecture:** Pure presentation-layer overhaul. All Supabase queries, mutations, and React Query keys stay untouched. CSS foundation lands first (new classes + redefined legacy classes so unmigrated pages instantly calm down), then the app shell, then the Today page is recomposed from existing panels plus three small new components (`InlineSuggestions`, `MissionLog`, minimal `QuickCaptureDock`).

**Tech Stack:** React 19, TypeScript strict, Tailwind CSS v4 (via `@tailwindcss/postcss`, custom classes in `@layer components` in `src/styles.css`), vitest + @testing-library/react (jsdom), lucide-react icons.

**Spec:** `docs/superpowers/specs/2026-07-07-ui-ux-overhaul-design.md`. Phases 3–5 (Project Workspace + Inbox, Constellation mind maps, shared component sweep) get their own plan documents after this plan lands.

## Global Constraints

- All work happens in the worktree `C:\src\Personal\ToDo\.worktrees\project-command-center` on branch `codex/project-command-center`. Run all commands from that directory.
- Run tests with `npm test` (vitest run). The full suite must be green at the end of every task.
- No new npm dependencies.
- Never delete a CSS class that a test or component still references; either keep the class or update the referencing file + test in the same task.
- Keep the `@media (prefers-reduced-motion: reduce)` kill-switch block in `src/styles.css` exactly as is.
- Color rule: cyan glow = interactive/active only; violet = ambient accent only.
- No infinite decorative animations except background starfield drift and the single Beacon (`orbit-focus-active`).
- Commit after every task with the message given in the task.

---

### Task 1: CSS foundation — surfaces, calmed legacy classes, motion cleanup

**Files:**
- Modify: `src/styles.css`

**Interfaces:**
- Produces: CSS classes `surface-primary`, `surface-raised`, `surface-whisper` (used by every later task); recalmed `orbit-panel`, `orbit-panel-soft`, `telemetry-chip`; static (non-animated) `daily-orbit-pulse` and `orbit-deadline-pulse`.
- Consumes: nothing.

- [ ] **Step 1: Add the three surface classes**

In `src/styles.css`, inside the `@layer components { ... }` block, immediately before `.orbit-panel {`, add:

```css
  .surface-primary {
    border: 1px solid rgba(148, 163, 184, 0.16);
    background: rgba(8, 15, 34, 0.82);
    box-shadow: 0 18px 48px rgba(2, 8, 23, 0.42);
  }

  .surface-raised {
    border: 1px solid rgba(148, 163, 184, 0.22);
    background: rgba(15, 23, 42, 0.92);
    box-shadow: 0 32px 90px rgba(2, 8, 23, 0.6);
  }

  .surface-whisper {
    border: 1px solid transparent;
    background: rgba(15, 23, 42, 0.38);
  }
```

- [ ] **Step 2: Redefine the legacy panel classes onto the new surfaces**

Replace this block (the whole `.orbit-panel` rule plus its `::before` rule):

```css
  .orbit-panel {
    position: relative;
    border: 1px solid var(--orbit-border);
    background:
      linear-gradient(180deg, rgba(15, 23, 42, 0.88), rgba(2, 8, 23, 0.94)),
      rgba(2, 8, 23, 0.92);
    box-shadow: 0 24px 80px rgba(2, 8, 23, 0.48), inset 0 1px 0 rgba(255, 255, 255, 0.05);
  }

  .orbit-panel::before {
    content: "";
    position: absolute;
    inset: 0;
    pointer-events: none;
    border-radius: inherit;
    background:
      linear-gradient(115deg, transparent 0%, rgba(103, 232, 249, 0.08) 38%, transparent 58%),
      radial-gradient(circle at 18% 0%, rgba(34, 211, 238, 0.12), transparent 34%);
    opacity: 0.7;
  }

  .orbit-panel-soft {
    border: 1px solid rgba(148, 163, 184, 0.16);
    background: rgba(15, 23, 42, 0.58);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
  }
```

with:

```css
  .orbit-panel {
    position: relative;
    border: 1px solid rgba(148, 163, 184, 0.16);
    background: rgba(8, 15, 34, 0.82);
    box-shadow: 0 18px 48px rgba(2, 8, 23, 0.42);
  }

  .orbit-panel-soft {
    border: 1px solid transparent;
    background: rgba(15, 23, 42, 0.38);
  }
```

- [ ] **Step 3: Calm the telemetry chip**

Replace:

```css
  .telemetry-chip {
    border: 1px solid rgba(148, 163, 184, 0.2);
    background:
      linear-gradient(135deg, rgba(15, 23, 42, 0.9), rgba(2, 8, 23, 0.72)),
      radial-gradient(circle at 100% 0%, rgba(34, 211, 238, 0.16), transparent 40%);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
  }
```

with:

```css
  .telemetry-chip {
    border: 1px solid rgba(148, 163, 184, 0.16);
    background: rgba(8, 15, 34, 0.72);
  }
```

- [ ] **Step 4: Demote the mission-label pattern**

Replace:

```css
  .mission-label {
    color: #67e8f9;
    font-size: 0.72rem;
    font-weight: 800;
    letter-spacing: 0.14em;
    text-transform: uppercase;
  }
```

with:

```css
  .mission-label {
    color: #7dd3fc;
    font-size: 0.7rem;
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    opacity: 0.8;
  }
```

- [ ] **Step 5: Make the primary-item and deadline pulses static (no infinite loops)**

Replace:

```css
.daily-orbit-pulse::after {
  content: "";
  position: absolute;
  inset: -1px;
  border-radius: 8px;
  border: 1px solid rgba(34, 211, 238, 0.28);
  opacity: 0.7;
  pointer-events: none;
}
```

with:

```css
.daily-orbit-pulse::after {
  content: "";
  position: absolute;
  inset: -1px;
  border-radius: 8px;
  border: 1px solid rgba(34, 211, 238, 0.35);
  pointer-events: none;
}
```

Then in the `@media (prefers-reduced-motion: no-preference)` block, DELETE these two rules (class rules stay; only the animation hookups go):

```css
  .daily-orbit-pulse::after {
    animation: daily-orbit-pulse 2600ms ease-in-out infinite;
  }
```

```css
  .orbit-deadline-pulse::after {
    animation: daily-orbit-pulse 2600ms ease-in-out infinite;
  }
```

and DELETE the now-unused `@keyframes daily-orbit-pulse { ... }` block inside the same media query.

- [ ] **Step 6: Remove the loading-shell/hud-surface sheen overlay**

Replace:

```css
.orbit-loading-shell::before,
.orbit-hud-surface::before,
.orbit-constellation-canvas::before {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  border-radius: inherit;
  background:
    linear-gradient(115deg, transparent 0%, rgba(103, 232, 249, 0.1) 42%, transparent 64%),
    radial-gradient(circle at 18% 0%, rgba(34, 211, 238, 0.12), transparent 34%);
  opacity: 0.64;
}
```

with:

```css
.orbit-loading-shell::before,
.orbit-hud-surface::before,
.orbit-constellation-canvas::before {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  border-radius: inherit;
  background: radial-gradient(circle at 18% 0%, rgba(34, 211, 238, 0.06), transparent 34%);
}
```

- [ ] **Step 7: Soften panel hover motion**

In the `@media (prefers-reduced-motion: no-preference)` block, replace:

```css
  .orbit-panel:hover {
    transform: translateY(-1px);
    transition:
      transform 180ms ease,
      border-color 180ms ease,
      box-shadow 180ms ease;
    border-color: rgba(34, 211, 238, 0.32);
    box-shadow: 0 26px 90px rgba(2, 8, 23, 0.58), 0 0 42px rgba(34, 211, 238, 0.08);
  }
```

with:

```css
  .orbit-panel:hover {
    transition: border-color 180ms ease;
    border-color: rgba(148, 163, 184, 0.28);
  }
```

- [ ] **Step 8: Warm up default body text**

In `:root`, change `color: #e5e7eb;` — it stays. But find `body` rule; no change needed there. Instead this task's readability change is minimal: no global change (per-page text colors are handled in later tasks). Skip to verification.

- [ ] **Step 9: Verify**

Run: `npm test`
Expected: all tests PASS (class names asserted by tests — `daily-orbit-pulse`, `orbit-deadline-pulse`, `orbit-hud-surface` etc. — still exist; only their look changed).

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 10: Commit**

```bash
git add src/styles.css
git commit -m "Add surface foundation and calm legacy panel styles"
```

---

### Task 2: Signature background — three-layer starfield, nebula, grain

**Files:**
- Modify: `src/styles.css`
- Modify: `src/components/space-visuals.tsx` (only `StarFieldBackground`)
- Modify: `src/components/space-visuals.test.tsx`

**Interfaces:**
- Consumes: nothing new.
- Produces: `StarFieldBackground()` (same export, new internals); CSS classes `orbit-starfield-mid`, `orbit-nebula`, `orbit-grain`, `orbit-star-flare`, `orbit-star-flare-small`.

- [ ] **Step 1: Update the starfield test to the new layers**

In `src/components/space-visuals.test.tsx`, replace the second test with:

```tsx
  it("renders layered starfield depth without exposing decorative layers", () => {
    const { container } = render(
      <div className="relative">
        <StarFieldBackground />
      </div>,
    );

    expect(container.querySelector(".orbit-starfield-far")).toBeTruthy();
    expect(container.querySelector(".orbit-starfield-mid")).toBeTruthy();
    expect(container.querySelector(".orbit-starfield-near")).toBeTruthy();
    expect(container.querySelector(".orbit-nebula")).toBeTruthy();
    expect(container.querySelector(".orbit-grain")).toBeTruthy();
    expect(container.querySelector(".orbit-star-flare")).toHaveAttribute("aria-hidden", "true");
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/space-visuals.test.tsx`
Expected: FAIL — `.orbit-starfield-mid` not found.

- [ ] **Step 3: Rewrite StarFieldBackground**

In `src/components/space-visuals.tsx`, replace the whole `StarFieldBackground` function with:

```tsx
export function StarFieldBackground() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="orbit-nebula absolute inset-x-[-20%] top-[-30%] h-[70%]" />
      <div className="orbit-starfield orbit-starfield-far absolute inset-0 opacity-40" />
      <div className="orbit-starfield orbit-starfield-mid absolute inset-0 opacity-55" />
      <div className="orbit-starfield orbit-starfield-near absolute inset-0 opacity-70" />
      <span aria-hidden="true" className="orbit-star-flare left-[12%] top-[18%]" />
      <span aria-hidden="true" className="orbit-star-flare orbit-star-flare-small right-[22%] top-[38%]" />
      <span aria-hidden="true" className="orbit-star-flare orbit-star-flare-small bottom-[20%] left-[38%]" />
      <div className="orbit-grain absolute inset-0" />
    </div>
  );
}
```

(The `clsx` import stays — other components in the file use it.)

- [ ] **Step 4: Add the new scene CSS and delete the retired effects**

In `src/styles.css`:

**(a)** DELETE these rules entirely: `.orbit-aurora`, `.comet-streak`, `.comet-streak-one`, `.comet-streak-two`, `.comet-streak-three`, `.orbit-parallax-grid`, `.orbit-debris-field`, `.orbit-debris-field-one`, `.orbit-debris-field-two`.

**(b)** DELETE these animation hookups from the `@media (prefers-reduced-motion: no-preference)` block: `.orbit-aurora`, `.orbit-starfield` (the 18s one), `.comet-streak-one`, `.comet-streak-two`, `.comet-streak-three`, `.orbit-debris-field-one`, `.orbit-debris-field-two`.

**(c)** DELETE these keyframes: `@keyframes orbit-stars`, `@keyframes orbit-aurora-drift`, `@keyframes comet-sweep`, `@keyframes orbit-drift`.

**(d)** Replace the `.orbit-starfield-far` / `.orbit-starfield-near` sizing rules with:

```css
.orbit-starfield-far {
  background-size:
    138px 138px,
    196px 196px;
}

.orbit-starfield-mid {
  background-size:
    112px 112px,
    158px 158px;
}

.orbit-starfield-near {
  background-size:
    92px 92px,
    132px 132px;
}
```

**(e)** Add after the starfield sizing rules:

```css
.orbit-nebula {
  background:
    radial-gradient(ellipse at 30% 30%, rgba(37, 99, 235, 0.22), transparent 55%),
    radial-gradient(ellipse at 72% 12%, rgba(124, 58, 237, 0.13), transparent 50%),
    radial-gradient(ellipse at 55% 60%, rgba(34, 211, 238, 0.08), transparent 45%);
  filter: blur(72px);
}

.orbit-grain {
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E");
  opacity: 0.05;
  mix-blend-mode: overlay;
}

.orbit-star-flare {
  position: absolute;
  height: 3px;
  width: 3px;
  border-radius: 999px;
  background: #ffffff;
  box-shadow:
    0 0 8px 1px rgba(255, 255, 255, 0.8),
    0 0 22px 2px rgba(103, 232, 249, 0.35);
}

.orbit-star-flare::before,
.orbit-star-flare::after {
  content: "";
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.7), transparent);
}

.orbit-star-flare::before {
  height: 1px;
  width: 26px;
}

.orbit-star-flare::after {
  width: 1px;
  height: 26px;
  background: linear-gradient(180deg, transparent, rgba(255, 255, 255, 0.7), transparent);
}

.orbit-star-flare-small {
  transform: scale(0.6);
  opacity: 0.7;
}
```

**(f)** Inside the `@media (prefers-reduced-motion: no-preference)` block, add the slow drift (this is the "Drift" verb — minutes, not seconds):

```css
  .orbit-starfield-far {
    animation: orbit-stars-drift 420s linear infinite;
  }

  .orbit-starfield-mid {
    animation: orbit-stars-drift 280s linear infinite reverse;
  }

  .orbit-starfield-near {
    animation: orbit-stars-drift 160s linear infinite;
  }
```

**(g)** Add at the bottom of the file, with the other top-level keyframes:

```css
@keyframes orbit-stars-drift {
  to {
    background-position:
      92px 92px,
      132px 132px;
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/components/space-visuals.test.tsx`
Expected: PASS.

Run: `npm test`
Expected: all PASS. If any other test references `.orbit-debris-field`, `.comet-streak`, `.orbit-aurora`, or `.orbit-parallax-grid`, update that assertion to check `.orbit-grain` instead (there is exactly one known: `space-visuals.test.tsx`, already updated).

- [ ] **Step 6: Commit**

```bash
git add src/styles.css src/components/space-visuals.tsx src/components/space-visuals.test.tsx
git commit -m "Replace ambient effect pile with crafted starfield scene"
```

---

### Task 3: App shell — regrouped nav, single icon set, "Today"

**Files:**
- Modify: `src/components/app-shell.tsx`
- Modify: `src/app/App.test.tsx`

**Interfaces:**
- Consumes: `routePrefetchers` from `src/app/route-loaders` (unchanged), `OrbitFloLogo`, `GlobalQuickAdd`, `CommandPalette`, `StarFieldBackground` (unchanged exports).
- Produces: same `AppShell({ children })` export; nav label "Mission Control" becomes "Today".

- [ ] **Step 1: Update App.test.tsx expectations**

In `src/app/App.test.tsx`:

**(a)** Replace:

```tsx
    expect(screen.getByRole("link", { name: "Mission Control" })).toBeTruthy();
```

with:

```tsx
    expect(screen.getByRole("link", { name: "Today" })).toBeTruthy();
```

**(b)** DELETE the PNG icon assertion:

```tsx
    expect(screen.getByRole("link", { name: "Mission Control" }).querySelector("img")).toHaveAttribute(
      "src",
      "/assets/icons/mission-control.png",
    );
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/app/App.test.tsx`
Expected: FAIL — no link named "Today".

- [ ] **Step 3: Rewrite the app shell**

Replace the full contents of `src/components/app-shell.tsx` with:

```tsx
import { Brain, CalendarDays, Inbox, Network, Orbit, Rocket, Settings } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { routePrefetchers } from "../app/route-loaders";
import { CommandPalette } from "./command-palette";
import { GlobalQuickAdd } from "./global-quick-add";
import { OrbitFloLogo } from "./orbit-flo-logo";
import { StarFieldBackground } from "./space-visuals";

type NavItem = { to: string; label: string; Icon: LucideIcon };

const primaryNavItems: NavItem[] = [
  { to: "/", label: "Today", Icon: Orbit },
  { to: "/projects", label: "Missions", Icon: Rocket },
  { to: "/maps", label: "Maps", Icon: Network },
  { to: "/calendar", label: "Calendar", Icon: CalendarDays },
  { to: "/inbox", label: "Inbox", Icon: Inbox },
];

const secondaryNavItems: NavItem[] = [
  { to: "/notes", label: "Brainstorm", Icon: Brain },
  { to: "/settings", label: "Settings", Icon: Settings },
];

function ShellNavLink({ item }: { item: NavItem }) {
  return (
    <NavLink
      className={({ isActive }) =>
        `group flex min-w-0 items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition ${
          isActive ? "bg-cyan-300/10 text-white" : "text-slate-400 hover:bg-white/5 hover:text-slate-100"
        }`
      }
      onFocus={() => {
        void routePrefetchers[item.to]?.();
      }}
      onMouseEnter={() => {
        void routePrefetchers[item.to]?.();
      }}
      to={item.to}
    >
      {({ isActive }) => (
        <>
          <item.Icon
            aria-hidden="true"
            className={`h-4.5 w-4.5 shrink-0 ${isActive ? "text-cyan-200" : "text-slate-500 group-hover:text-slate-300"}`}
          />
          <span className="truncate">{item.label}</span>
        </>
      )}
    </NavLink>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#020817] text-slate-100 lg:grid lg:grid-cols-[14.5rem_minmax(0,1fr)]">
      <StarFieldBackground />
      <aside className="relative z-10 flex flex-col border-b border-slate-400/15 bg-slate-950/80 px-4 py-4 backdrop-blur-xl lg:border-b-0 lg:border-r lg:py-5">
        <OrbitFloLogo className="max-w-[11.5rem]" />
        <nav className="mt-4 grid grid-cols-2 gap-1 sm:grid-cols-5 lg:mt-7 lg:grid-cols-1">
          {primaryNavItems.map((item) => (
            <ShellNavLink item={item} key={item.to} />
          ))}
        </nav>
        <nav className="mt-2 grid grid-cols-2 gap-1 border-t border-slate-400/10 pt-2 lg:mt-auto lg:grid-cols-1">
          {secondaryNavItems.map((item) => (
            <ShellNavLink item={item} key={item.to} />
          ))}
        </nav>
        <GlobalQuickAdd />
        <CommandPalette />
      </aside>
      <main className="relative z-10 min-w-0 p-4 sm:p-6 lg:p-8">
        <div className="mx-auto w-full max-w-7xl">{children}</div>
      </main>
    </div>
  );
}
```

Note: `h-4.5 w-4.5` requires Tailwind arbitrary support; if the build complains, use `h-[1.125rem] w-[1.125rem]`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/app/App.test.tsx`
Expected: PASS (7 tests).

Run: `npm test`
Expected: all PASS. If `GlobalQuickAdd` renders at a position that now sits below the `lg:mt-auto` nav, that is intended (quick add + palette live at the sidebar bottom).

- [ ] **Step 5: Commit**

```bash
git add src/components/app-shell.tsx src/app/App.test.tsx
git commit -m "Regroup shell navigation around Today with one icon set"
```

---

### Task 4: `buildTodayGreeting` — the one-glance context sentence

**Files:**
- Modify: `src/features/daily/daily-plan.utils.ts`
- Create (or extend if it exists): `src/features/daily/daily-plan.utils.test.ts`

**Interfaces:**
- Consumes: `calculateDailyPlanSummary(items)` from the same file.
- Produces: `buildTodayGreeting(items: Pick<DailyPlanItem, "state">[], suggestedCount?: number): string` — Task 8 renders this in the Today header.

- [ ] **Step 1: Write the failing tests**

If `src/features/daily/daily-plan.utils.test.ts` exists, append this describe block; otherwise create the file with:

```ts
import { describe, expect, it } from "vitest";
import { buildTodayGreeting } from "./daily-plan.utils";

type PlanState = { state: "planned" | "completed" | "skipped" };

describe("buildTodayGreeting", () => {
  it("invites a first objective on an empty day", () => {
    expect(buildTodayGreeting([], 0)).toBe("A clear sky. Add an objective to begin.");
  });

  it("points at waiting suggestions on an empty day", () => {
    expect(buildTodayGreeting([], 3)).toBe("A clear sky. 3 suggestions waiting when you're ready.");
  });

  it("uses singular forms", () => {
    expect(buildTodayGreeting([], 1)).toBe("A clear sky. 1 suggestion waiting when you're ready.");
    const items: PlanState[] = [{ state: "planned" }];
    expect(buildTodayGreeting(items, 0)).toBe("1 objective in orbit");
  });

  it("summarizes an active day", () => {
    const items: PlanState[] = [
      { state: "planned" },
      { state: "planned" },
      { state: "completed" },
    ];
    expect(buildTodayGreeting(items, 2)).toBe("3 objectives in orbit · 1 complete · 2 suggestions waiting");
  });

  it("omits zero parts", () => {
    const items: PlanState[] = [{ state: "planned" }, { state: "planned" }];
    expect(buildTodayGreeting(items, 0)).toBe("2 objectives in orbit");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/daily/daily-plan.utils.test.ts`
Expected: FAIL — `buildTodayGreeting` is not exported.

- [ ] **Step 3: Implement**

Append to `src/features/daily/daily-plan.utils.ts`:

```ts
export function buildTodayGreeting(items: Pick<DailyPlanItem, "state">[], suggestedCount = 0) {
  const summary = calculateDailyPlanSummary(items);

  if (summary.total === 0) {
    if (suggestedCount > 0) {
      return `A clear sky. ${suggestedCount} suggestion${suggestedCount === 1 ? "" : "s"} waiting when you're ready.`;
    }
    return "A clear sky. Add an objective to begin.";
  }

  const parts = [`${summary.total} objective${summary.total === 1 ? "" : "s"} in orbit`];
  if (summary.completed > 0) parts.push(`${summary.completed} complete`);
  if (suggestedCount > 0) parts.push(`${suggestedCount} suggestion${suggestedCount === 1 ? "" : "s"} waiting`);

  return parts.join(" · ");
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/features/daily/daily-plan.utils.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/daily/daily-plan.utils.ts src/features/daily/daily-plan.utils.test.ts
git commit -m "Add today greeting sentence builder"
```

---

### Task 5: Minimal quick capture — one input, Enter to dock, expandable details

**Files:**
- Modify: `src/features/daily/quick-capture-dock.tsx`
- Modify: `src/features/daily/quick-capture-dock.test.tsx` (full rewrite)

**Interfaces:**
- Consumes: `CaptureType` from `src/lib/supabase/database.types`; `Field` from `src/components/field`.
- Produces: `QuickCaptureDock({ isSubmitting, onSubmit, resetSignal })` and `QuickCaptureDockValues` — **exact same props and export names as today**, so the page keeps working unchanged.

- [ ] **Step 1: Rewrite the test file**

Replace the full contents of `src/features/daily/quick-capture-dock.test.tsx` with:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { QuickCaptureDock } from "./quick-capture-dock";

describe("QuickCaptureDock", () => {
  it("submits a capture from the single input with Enter", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<QuickCaptureDock isSubmitting={false} onSubmit={onSubmit} resetSignal={0} />);

    await user.type(screen.getByPlaceholderText("Capture a thought — Enter to dock it"), "Call mission control{Enter}");

    expect(onSubmit).toHaveBeenCalledWith({ type: "task", title: "Call mission control", body: "" });
  });

  it("does not submit an empty title", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<QuickCaptureDock isSubmitting={false} onSubmit={onSubmit} resetSignal={0} />);

    await user.type(screen.getByPlaceholderText("Capture a thought — Enter to dock it"), "   {Enter}");

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("reveals type and notes behind the details toggle", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<QuickCaptureDock isSubmitting={false} onSubmit={onSubmit} resetSignal={0} />);

    expect(screen.queryByLabelText("Type")).toBeNull();

    await user.click(screen.getByRole("button", { name: "More capture options" }));
    await user.selectOptions(screen.getByLabelText("Type"), "idea");
    await user.type(screen.getByLabelText("Signal notes"), "Long-form context");
    await user.type(screen.getByPlaceholderText("Capture a thought — Enter to dock it"), "Big idea{Enter}");

    expect(onSubmit).toHaveBeenCalledWith({ type: "idea", title: "Big idea", body: "Long-form context" });
  });

  it("clears the fields when the reset signal changes", () => {
    const { rerender } = render(
      <QuickCaptureDock isSubmitting={false} onSubmit={() => undefined} resetSignal={0} />,
    );

    const input = screen.getByPlaceholderText<HTMLInputElement>("Capture a thought — Enter to dock it");
    input.value = "typed";

    rerender(<QuickCaptureDock isSubmitting={false} onSubmit={() => undefined} resetSignal={1} />);

    expect(screen.getByPlaceholderText<HTMLInputElement>("Capture a thought — Enter to dock it").value).toBe("");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/features/daily/quick-capture-dock.test.tsx`
Expected: FAIL — placeholder not found.

- [ ] **Step 3: Rewrite the component**

Replace the full contents of `src/features/daily/quick-capture-dock.tsx` with:

```tsx
import { clsx } from "clsx";
import { ChevronDown, Send } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { Field } from "../../components/field";
import type { CaptureType } from "../../lib/supabase/database.types";

const captureTypes = ["task", "note", "idea", "blocker"] as const satisfies readonly CaptureType[];

export interface QuickCaptureDockValues {
  type: CaptureType;
  title: string;
  body: string;
}

export function QuickCaptureDock({
  isSubmitting,
  onSubmit,
  resetSignal,
}: {
  isSubmitting: boolean;
  onSubmit: (values: QuickCaptureDockValues) => void;
  resetSignal: number;
}) {
  const [type, setType] = useState<CaptureType>("task");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    if (resetSignal === 0) return;

    setTitle("");
    setBody("");
  }, [resetSignal]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedTitle = title.trim();

    if (!trimmedTitle) return;

    onSubmit({
      type,
      title: trimmedTitle,
      body: body.trim(),
    });
  }

  return (
    <form
      aria-label="Quick capture"
      className="surface-whisper orbit-signal-dock relative overflow-hidden rounded-xl p-2"
      onSubmit={handleSubmit}
    >
      <div className="flex items-center gap-2">
        <input
          className="orbit-input flex-1 border-transparent bg-transparent"
          disabled={isSubmitting}
          name="title"
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Capture a thought — Enter to dock it"
          type="text"
          value={title}
        />
        <button
          aria-expanded={showDetails}
          aria-label="More capture options"
          className="orbit-button-secondary grid h-9 w-9 shrink-0 place-items-center p-0"
          onClick={() => setShowDetails((current) => !current)}
          type="button"
        >
          <ChevronDown
            aria-hidden="true"
            className={clsx("h-4 w-4 transition-transform", showDetails && "rotate-180")}
          />
        </button>
        <button
          aria-label="Dock signal"
          className="orbit-button grid h-9 w-9 shrink-0 place-items-center p-0"
          disabled={isSubmitting || !title.trim()}
          type="submit"
        >
          <Send aria-hidden="true" className="h-4 w-4" />
        </button>
      </div>

      {showDetails ? (
        <div className="mt-2 grid gap-2 border-t border-slate-400/10 px-1 pt-3">
          <Field label="Type">
            <select
              className="orbit-input capitalize"
              disabled={isSubmitting}
              name="type"
              onChange={(event) => setType(event.target.value as CaptureType)}
              value={type}
            >
              {captureTypes.map((captureType) => (
                <option key={captureType} value={captureType}>
                  {captureType}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Signal notes">
            <textarea
              className="orbit-input min-h-20"
              disabled={isSubmitting}
              name="body"
              onChange={(event) => setBody(event.target.value)}
              value={body}
            />
          </Field>
        </div>
      ) : null}
    </form>
  );
}
```

Note: `autoFocus` is intentionally dropped — the Today page's focus belongs to the flight plan, not the capture box.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/features/daily/quick-capture-dock.test.tsx`
Expected: PASS (4 tests).

Run: `npm test`
Expected: all PASS. If `daily-mission-control-page.test.tsx` fails because it typed into the old "Capture title" labeled field, update that interaction to use `getByPlaceholderText("Capture a thought — Enter to dock it")` and remove interactions with the removed always-visible Type/notes fields (they now live behind "More capture options").

- [ ] **Step 5: Commit**

```bash
git add src/features/daily/quick-capture-dock.tsx src/features/daily/quick-capture-dock.test.tsx
git commit -m "Slim quick capture to a single dockable input"
```

---

### Task 6: InlineSuggestions — "+ N suggestions" expander

**Files:**
- Create: `src/features/daily/inline-suggestions.tsx`
- Create: `src/features/daily/inline-suggestions.test.tsx`

**Interfaces:**
- Consumes: `SuggestedFlightPlan` (unchanged), `getSuggestedDailyWorkItems` from `daily-plan.utils`, `DailyPlanItemWithWorkItem` from `daily-plan.queries`.
- Produces: `InlineSuggestions({ availableWorkItems, dailyPlanItems, isAdding, onAdd, todayKey })` — same prop shape as `SuggestedFlightPlan`; renders `null` when there are no suggestions.

- [ ] **Step 1: Write the failing test**

Create `src/features/daily/inline-suggestions.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Database } from "../../lib/supabase/database.types";
import { InlineSuggestions } from "./inline-suggestions";

type WorkItem = Database["public"]["Tables"]["work_items"]["Row"];

function workItem(overrides: Partial<WorkItem> = {}): WorkItem {
  return {
    id: "work-item-1",
    workspace_id: "workspace-1",
    project_id: "project-1",
    milestone_id: null,
    title: "Work item",
    description: null,
    status: "ready",
    priority: "medium",
    due_date: null,
    estimate_points: null,
    sort_order: 0,
    blocked_reason: null,
    created_by: "user-1",
    created_at: "2026-07-07T00:00:00.000Z",
    updated_at: "2026-07-07T00:00:00.000Z",
    ...overrides,
  } as WorkItem;
}

describe("InlineSuggestions", () => {
  it("renders nothing when there are no suggestions", () => {
    const { container } = render(
      <InlineSuggestions
        availableWorkItems={[]}
        dailyPlanItems={[]}
        isAdding={false}
        onAdd={() => undefined}
        todayKey="2026-07-07"
      />,
    );

    expect(container.firstChild).toBeNull();
  });

  it("expands from a count hint to the full suggestion list", async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn();

    render(
      <InlineSuggestions
        availableWorkItems={[workItem({ id: "a", title: "Fix heat shield" }), workItem({ id: "b", title: "Chart course" })]}
        dailyPlanItems={[]}
        isAdding={false}
        onAdd={onAdd}
        todayKey="2026-07-07"
      />,
    );

    const toggle = screen.getByRole("button", { name: "2 suggestions for today" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Fix heat shield")).toBeNull();

    await user.click(toggle);

    expect(screen.getByRole("button", { name: "Hide suggestions" })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Fix heat shield")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Add Fix heat shield to today" }));
    expect(onAdd).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/daily/inline-suggestions.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `src/features/daily/inline-suggestions.tsx`:

```tsx
import { Sparkles } from "lucide-react";
import { useState } from "react";
import type { Database } from "../../lib/supabase/database.types";
import type { DailyPlanItemWithWorkItem } from "./daily-plan.queries";
import { getSuggestedDailyWorkItems } from "./daily-plan.utils";
import { SuggestedFlightPlan } from "./suggested-flight-plan";

type WorkItem = Database["public"]["Tables"]["work_items"]["Row"];

export function InlineSuggestions({
  availableWorkItems,
  dailyPlanItems,
  isAdding,
  onAdd,
  todayKey,
}: {
  availableWorkItems: WorkItem[];
  dailyPlanItems: DailyPlanItemWithWorkItem[];
  isAdding: boolean;
  onAdd: (workItem: WorkItem, index: number) => void;
  todayKey: string;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const count = getSuggestedDailyWorkItems(availableWorkItems, dailyPlanItems, todayKey).length;

  if (count === 0) return null;

  return (
    <div>
      <button
        aria-expanded={isExpanded}
        className="inline-flex items-center gap-2 rounded-md px-2 py-1 text-sm font-medium text-slate-400 transition hover:text-cyan-100"
        onClick={() => setIsExpanded((current) => !current)}
        type="button"
      >
        <Sparkles aria-hidden="true" className="h-3.5 w-3.5" />
        {isExpanded ? "Hide suggestions" : `${count} suggestion${count === 1 ? "" : "s"} for today`}
      </button>
      {isExpanded ? (
        <div className="mt-2">
          <SuggestedFlightPlan
            availableWorkItems={availableWorkItems}
            dailyPlanItems={dailyPlanItems}
            isAdding={isAdding}
            onAdd={onAdd}
            todayKey={todayKey}
          />
        </div>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/features/daily/inline-suggestions.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/daily/inline-suggestions.tsx src/features/daily/inline-suggestions.test.tsx
git commit -m "Add inline suggestions expander for the Today page"
```

---

### Task 7: MissionLog — one quiet disclosure with tabs

**Files:**
- Create: `src/features/daily/mission-log.tsx`
- Create: `src/features/daily/mission-log.test.tsx`

**Interfaces:**
- Consumes: nothing project-specific (pure layout component).
- Produces: `MissionLog({ defaultOpen?, panels })` where `panels: Record<MissionLogTab, ReactNode>` and `export type MissionLogTab = "Focus" | "Review" | "Timeline" | "Shutdown" | "Reflection"`. Task 8 slots the five existing panels in.

- [ ] **Step 1: Write the failing test**

Create `src/features/daily/mission-log.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { MissionLog } from "./mission-log";

const panels = {
  Focus: <div>Focus panel</div>,
  Review: <div>Review panel</div>,
  Timeline: <div>Timeline panel</div>,
  Shutdown: <div>Shutdown panel</div>,
  Reflection: <div>Reflection panel</div>,
};

describe("MissionLog", () => {
  it("is collapsed by default", () => {
    render(<MissionLog panels={panels} />);

    expect(screen.getByText("Mission log")).toBeTruthy();
    expect(screen.getByText("Mission log").closest("details")).not.toHaveAttribute("open");
  });

  it("shows the Focus tab first and switches tabs", async () => {
    const user = userEvent.setup();
    render(<MissionLog defaultOpen panels={panels} />);

    expect(screen.getByText("Focus panel")).toBeTruthy();
    expect(screen.queryByText("Shutdown panel")).toBeNull();
    expect(screen.getByRole("tab", { name: "Focus" })).toHaveAttribute("aria-selected", "true");

    await user.click(screen.getByRole("tab", { name: "Shutdown" }));

    expect(screen.getByText("Shutdown panel")).toBeTruthy();
    expect(screen.queryByText("Focus panel")).toBeNull();
    expect(screen.getByRole("tab", { name: "Shutdown" })).toHaveAttribute("aria-selected", "true");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/daily/mission-log.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `src/features/daily/mission-log.tsx`:

```tsx
import { clsx } from "clsx";
import { useState, type ReactNode } from "react";

const missionLogTabs = ["Focus", "Review", "Timeline", "Shutdown", "Reflection"] as const;

export type MissionLogTab = (typeof missionLogTabs)[number];

export function MissionLog({
  defaultOpen = false,
  panels,
}: {
  defaultOpen?: boolean;
  panels: Record<MissionLogTab, ReactNode>;
}) {
  const [activeTab, setActiveTab] = useState<MissionLogTab>("Focus");

  return (
    <details className="surface-whisper rounded-xl p-4" open={defaultOpen}>
      <summary className="cursor-pointer text-sm font-semibold text-slate-300 transition hover:text-white">
        Mission log
      </summary>
      <div className="mt-4">
        <div className="flex flex-wrap gap-1 border-b border-slate-400/10" role="tablist">
          {missionLogTabs.map((tab) => (
            <button
              aria-selected={activeTab === tab}
              className={clsx(
                "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition",
                activeTab === tab
                  ? "border-cyan-300 text-white"
                  : "border-transparent text-slate-400 hover:text-slate-200",
              )}
              key={tab}
              onClick={() => setActiveTab(tab)}
              role="tab"
              type="button"
            >
              {tab}
            </button>
          ))}
        </div>
        <div className="mt-4 grid gap-5">{panels[activeTab]}</div>
      </div>
    </details>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/features/daily/mission-log.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/daily/mission-log.tsx src/features/daily/mission-log.test.tsx
git commit -m "Add mission log disclosure with tabbed panels"
```

---

### Task 8: FlightPlan visual pass — roomy rows, hover actions

**Files:**
- Modify: `src/features/daily/flight-plan.tsx`
- Modify: `src/features/daily/flight-plan.test.tsx` (only if assertions break; the three existing tests assert copy and the `daily-completion-flare`/`orbit-launch-completion` classes, which all stay)

**Interfaces:**
- Consumes: same as today (`DailyPlanItemWithWorkItem`, `StatusPill`, `EmptyState`, `QuietPanel`).
- Produces: same `FlightPlan` export and props — visual changes only.

- [ ] **Step 1: Apply the visual changes**

In `src/features/daily/flight-plan.tsx`:

**(a)** Remove the `mission-label` line from both the empty and filled returns — delete both occurrences of:

```tsx
      <p className="mission-label">Today's Flight Plan</p>
```

**(b)** Replace the section header line:

```tsx
      <SectionHeader action={<StatusPill tone="good">{items.length}</StatusPill>} title="Primary objectives" />
```

with:

```tsx
      <SectionHeader action={<StatusPill tone="good">{items.length}</StatusPill>} title="Flight plan" />
```

**(c)** Make rows roomier and actions hover-revealed. Replace the `<li key={item.id}>` body:

```tsx
            <li key={item.id}>
              <DataRow
                action={
```

with:

```tsx
            <li className="group" key={item.id}>
              <DataRow
                className={clsx(
                  "py-4 [&>div>p]:text-base",
                  item.is_primary && "daily-orbit-pulse",
                )}
                action={
```

and DELETE the old `className={item.is_primary ? "daily-orbit-pulse" : undefined}` prop further down (className is now passed above). Add the import at the top of the file:

```tsx
import { clsx } from "clsx";
```

**(d)** On the two action buttons (complete and skip), change their shared styling class from:

```tsx
                      className="orbit-button-secondary grid h-9 w-9 place-items-center p-0"
```

to (both buttons):

```tsx
                      className="orbit-button-secondary grid h-9 w-9 place-items-center p-0 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
```

(Actions stay always-visible on touch widths; on `sm+` they appear on hover/focus.)

- [ ] **Step 2: Run tests to verify they pass**

Run: `npx vitest run src/features/daily/flight-plan.test.tsx`
Expected: PASS (3 tests — none assert the removed label or the old header title; if one asserts "Primary objectives", update it to "Flight plan").

Run: `npm test`
Expected: all PASS. If `daily-mission-control-page.test.tsx` asserts the text "Primary objectives" or "Today's Flight Plan", update those assertions to "Flight plan".

- [ ] **Step 3: Commit**

```bash
git add src/features/daily/flight-plan.tsx src/features/daily/flight-plan.test.tsx
git commit -m "Give flight plan rows breathing room and hover actions"
```

---

### Task 9: Today page — centered column, human header, mission log

**Files:**
- Modify: `src/features/daily/daily-mission-control-page.tsx`
- Modify: `src/features/daily/daily-mission-control-page.test.tsx`

**Interfaces:**
- Consumes: `buildTodayGreeting` (Task 4), `QuickCaptureDock` (Task 5), `InlineSuggestions` (Task 6), `MissionLog` (Task 7), plus all existing panels and queries unchanged.
- Produces: the restructured page. All queries, mutations, and handlers keep their current names and logic — only imports and the returned JSX change.

- [ ] **Step 1: Update imports**

In `src/features/daily/daily-mission-control-page.tsx`:

**(a)** Replace the minimal-layout import line:

```tsx
import { DisclosureSection, PageHeader, QuietPanel, SectionHeader } from "../../components/minimal-layout";
```

with nothing (delete it — the page no longer uses those four).

**(b)** Replace the utils import:

```tsx
import { formatPlanDate, getSuggestedDailyWorkItems } from "./daily-plan.utils";
```

with:

```tsx
import { buildTodayGreeting, formatPlanDate, getSuggestedDailyWorkItems } from "./daily-plan.utils";
```

**(c)** Replace the `SuggestedFlightPlan` import with:

```tsx
import { InlineSuggestions } from "./inline-suggestions";
import { MissionLog } from "./mission-log";
```

(Keep every other import: FlightPlan, FocusSessionPanel, MissionMomentum, QuickCaptureDock, DailyReviewPanel, DailyShutdownPanel, PrivateReflectionPanel, TodayTimeline, CalendarPlanningBlocks, EmptyState, etc.)

- [ ] **Step 2: Replace the returned JSX**

Keep everything from the top of the component through the `addSuggestedWorkItem` function definition exactly as is (all queries/mutations/guard returns). Then replace the final `return ( <section className="grid gap-5"> ... </section> );` block entirely with:

```tsx
  return (
    <section className="orbit-page-enter mx-auto grid w-full max-w-[44rem] gap-6">
      <header>
        <p className="text-xs font-medium text-slate-400">
          <time dateTime={planDate}>{planDate}</time>
        </p>
        <h1 className="mt-1 text-3xl font-bold text-white">Today</h1>
        <p className="mt-2 text-sm leading-6 text-slate-300">
          {buildTodayGreeting(missionControl?.dailyPlanItems ?? [], suggestedWorkItems.length)}
        </p>
      </header>

      {missionControlQuery.isPending ? (
        <EmptyState
          isLoading
          title="Preparing today's orbit"
          message="Loading your plan, captures, and current mission signals."
        />
      ) : null}

      {missionControlQuery.isError ? (
        <EmptyState
          title="Could not load Daily Mission Control"
          message={missionControlQuery.error.message}
        />
      ) : null}

      {!missionControlQuery.isPending && !missionControlQuery.isError && missionControl ? (
        <>
          <FlightPlan
            completedItemTitle={completedItemTitle}
            isUpdating={completeMutation.isPending || skipMutation.isPending}
            items={missionControl.dailyPlanItems}
            onComplete={(id) => {
              const item = missionControl.dailyPlanItems.find((dailyItem) => dailyItem.id === id);
              completeMutation.mutate({ id, title: item?.workItem?.title ?? "Objective" });
            }}
            onDropWorkItemId={(workItemId) => {
              const index = suggestedWorkItems.findIndex((item) => item.id === workItemId);
              addSuggestedWorkItem(workItemId, Math.max(index, 0));
            }}
            onPullSuggested={() => {
              const [firstSuggestion] = suggestedWorkItems;
              if (firstSuggestion) addSuggestedWorkItem(firstSuggestion.id, 0);
            }}
            onSkip={(id) => skipMutation.mutate(id)}
            onUndoComplete={() => undoCompleteMutation.mutate()}
            suggestedCount={suggestedWorkItems.length}
          />

          {homeLayout.suggestions ? (
            <InlineSuggestions
              availableWorkItems={missionControl.availableWorkItems}
              dailyPlanItems={missionControl.dailyPlanItems}
              isAdding={addSuggestedItemMutation.isPending}
              onAdd={(workItem, index) => addSuggestedWorkItem(workItem.id, index)}
              todayKey={planDate}
            />
          ) : null}

          {addSuggestedItemMutation.isError ? (
            <p className="rounded-lg border border-rose-300/25 bg-rose-300/10 px-3 py-2 text-sm font-semibold text-rose-100">
              {addSuggestedItemMutation.error.message}
            </p>
          ) : null}

          {homeLayout.quickCapture ? (
            <QuickCaptureDock
              isSubmitting={captureMutation.isPending}
              onSubmit={(values) => {
                setCaptureSuccessMessage("");
                captureMutation.mutate(values);
              }}
              resetSignal={quickCaptureResetSignal}
            />
          ) : null}

          {captureSuccessMessage ? (
            <p className="daily-capture-dock rounded-lg border border-emerald-300/25 bg-emerald-300/10 px-3 py-2 text-sm font-semibold text-emerald-100">
              {captureSuccessMessage}
            </p>
          ) : null}

          {captureMutation.isError ? (
            <p className="rounded-lg border border-rose-300/25 bg-rose-300/10 px-3 py-2 text-sm font-semibold text-rose-100">
              {captureMutation.error.message}
            </p>
          ) : null}

          <MissionLog
            panels={{
              Focus: (
                <FocusSessionPanel
                  isUpdating={completeMutation.isPending}
                  items={missionControl.dailyPlanItems}
                  onComplete={(id) => {
                    const item = missionControl.dailyPlanItems.find((dailyItem) => dailyItem.id === id);
                    completeMutation.mutate({ id, title: item?.workItem?.title ?? "Objective" });
                  }}
                  onDropWorkItem={(workItemId) => {
                    const index = suggestedWorkItems.findIndex((item) => item.id === workItemId);
                    addSuggestedWorkItem(workItemId, Math.max(index, 0));
                  }}
                  onSaveSessionNote={(input) => saveSessionNoteMutation.mutate(input)}
                />
              ),
              Review: (
                <>
                  {homeLayout.momentum ? <MissionMomentum items={missionControl.dailyPlanItems} /> : null}
                  {homeLayout.review ? (
                    <DailyReviewPanel captures={missionControl.captures} items={missionControl.dailyPlanItems} />
                  ) : null}
                </>
              ),
              Timeline: (
                <>
                  <TodayTimeline captures={missionControl.captures} items={missionControl.dailyPlanItems} />
                  <CalendarPlanningBlocks
                    onPlanWorkItem={(workItemId, _blockId, index) => addSuggestedWorkItem(workItemId, index)}
                  />
                </>
              ),
              Shutdown: (
                <>
                  <DailyShutdownPanel
                    isDisabled={shutdownQuery.isError}
                    isLoading={shutdownQuery.isPending}
                    isSaving={saveShutdownMutation.isPending}
                    onSave={(values) => saveShutdownMutation.mutate(values)}
                    shutdown={shutdownQuery.data ?? null}
                  />
                  {shutdownQuery.isError ? (
                    <p className="rounded-lg border border-rose-300/25 bg-rose-300/10 px-3 py-2 text-sm font-semibold text-rose-100">
                      {shutdownQuery.error.message}
                    </p>
                  ) : null}
                  {saveShutdownMutation.isError ? (
                    <p className="rounded-lg border border-rose-300/25 bg-rose-300/10 px-3 py-2 text-sm font-semibold text-rose-100">
                      {saveShutdownMutation.error.message}
                    </p>
                  ) : null}
                </>
              ),
              Reflection: (
                <>
                  <PrivateReflectionPanel
                    isDisabled={privateReflectionsQuery.isPending || privateReflectionsQuery.isError}
                    isSaving={createPrivateReflectionMutation.isPending}
                    onCreate={(values) => createPrivateReflectionMutation.mutateAsync(values)}
                    reflections={privateReflectionsQuery.data ?? []}
                  />
                  {privateReflectionsQuery.isError ? (
                    <p className="rounded-lg border border-rose-300/25 bg-rose-300/10 px-3 py-2 text-sm font-semibold text-rose-100">
                      {privateReflectionsQuery.error.message}
                    </p>
                  ) : null}
                  {createPrivateReflectionMutation.isError ? (
                    <p className="rounded-lg border border-rose-300/25 bg-rose-300/10 px-3 py-2 text-sm font-semibold text-rose-100">
                      {createPrivateReflectionMutation.error.message}
                    </p>
                  ) : null}
                  {saveSessionNoteMutation.isError ? (
                    <p className="rounded-lg border border-rose-300/25 bg-rose-300/10 px-3 py-2 text-sm font-semibold text-rose-100">
                      {saveSessionNoteMutation.error.message}
                    </p>
                  ) : null}
                </>
              ),
            }}
          />
        </>
      ) : null}
    </section>
  );
```

Notes on what intentionally disappeared (feature-equivalent homes):
- `PageHeader` + "Add top task" button → FlightPlan's empty state already has "Add top suggested task", and InlineSuggestions covers the non-empty case.
- The post-completion "Next task" QuietPanel → InlineSuggestions covers it.
- `SectionHeader "Today"` / `"Capture"` copy → replaced by the human header sentence.
- MissionMomentum panel → Review tab (still gated by `homeLayout.momentum`).
- The `DisclosureSection defaultOpen summary="Later"` wrapper → `MissionLog` (collapsed by default per spec).

- [ ] **Step 3: Update the page test**

Run: `npx vitest run src/features/daily/daily-mission-control-page.test.tsx`
Expected: FAILURES on assertions tied to the old structure. Apply these updates (and only these kinds):

- Assertions on the page heading: `screen.getByRole("heading", { name: "Daily Mission Control" })` → `screen.getByRole("heading", { name: "Today" })`.
- Capture interactions: type into `screen.getByPlaceholderText("Capture a thought — Enter to dock it")` and submit with `{Enter}`; to set a capture type first `await user.click(screen.getByRole("button", { name: "More capture options" }))`.
- Content that now lives inside MissionLog tabs (shutdown, reflection, timeline, review, focus assertions): first open the log and select the tab, e.g.

```tsx
await user.click(screen.getByText("Mission log"));
await user.click(screen.getByRole("tab", { name: "Shutdown" }));
```

- Suggested-plan assertions: expand first via `await user.click(screen.getByRole("button", { name: /suggestions? for today/ }))`.
- Do NOT delete test cases; every behavior still exists, only behind a disclosure/tab/expander.

- [ ] **Step 4: Run the full suite**

Run: `npm test`
Expected: all PASS.

Run: `npm run build`
Expected: build succeeds (confirms the removed minimal-layout imports left no dangling references).

- [ ] **Step 5: Commit**

```bash
git add src/features/daily/daily-mission-control-page.tsx src/features/daily/daily-mission-control-page.test.tsx
git commit -m "Rebuild home as centered Today page with mission log"
```

---

### Task 10: Verification pass — suite, build, screenshots

**Files:**
- None created (screenshots go to the session scratchpad, not the repo).

- [ ] **Step 1: Full test suite**

Run: `npm test`
Expected: all tests PASS. Paste the summary line into the task report.

- [ ] **Step 2: Production build**

Run: `npm run build`
Expected: exit 0.

- [ ] **Step 3: Visual verification**

Start the dev server (`npm run dev`, or via the preview tooling if available) against the worktree, sign in with the dev credentials from `.env.local`, and capture screenshots of:
1. Today page — desktop (1280×800) and mobile (375×812)
2. Any second page (e.g., Calendar) to confirm the shared background/panels calmed down

Check specifically: no comets/radar/scan animations anywhere; starfield drifts imperceptibly; Today page is a single centered column; Mission log opens with working tabs. Report any visual defect rather than silently patching unrelated files.

- [ ] **Step 4: Final commit (only if fixes were needed)**

```bash
git add -A
git commit -m "Polish Today page after visual verification"
```

---

## Self-Review (completed)

- **Spec coverage (Phases 1–2):** surfaces ✔ (Task 1), background ✔ (Task 2), motion verbs ✔ (Drift Task 2; Settle already exists and is applied to the page root in Task 9; Ignite = existing `daily-completion-flare` kept; Dock = existing `daily-capture-dock`/`orbit-dock-pulse` kept; Beacon = existing `orbit-focus-active` kept; infinite loops removed Tasks 1–2), shell ✔ (Task 3), Today layout ✔ (Tasks 4–9), typography/spacing partially — enforced via the new components; full app-wide sweep lands with Phases 3–5 plans.
- **Type consistency:** `buildTodayGreeting(items, suggestedCount)` matches Task 9 usage; `MissionLogTab` keys match the `panels` object literal; `InlineSuggestions` props mirror `SuggestedFlightPlan`.
- **Placeholders:** none; every step has exact code or exact commands.
