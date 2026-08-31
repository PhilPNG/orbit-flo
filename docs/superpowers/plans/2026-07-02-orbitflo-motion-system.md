# OrbitFlo Motion System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a CSS-first OrbitFlo motion system that makes loading, capture, search, focus, calendar, and maps feel alive without changing the app structure or theme.

**Architecture:** Extend the existing `src/styles.css` orbit primitives, then wire those classes into existing React components. Keep behavior unchanged, test class/accessibility wiring with Vitest and React Testing Library, and verify visual CSS through build plus smoke tests.

**Tech Stack:** React 19, Vite, Tailwind CSS v4, Vitest, React Testing Library, React Flow, `clsx`, existing OrbitFlo CSS tokens.

---

## File Structure

- Modify: `src/styles.css` - shared motion primitives, keyframes, reduced-motion-compatible classes, map and HUD visual classes.
- Modify: `src/components/space-visuals.tsx` - layered starfield accents and richer `SatelliteLoader` markup.
- Create: `src/components/space-visuals.test.tsx` - component tests for loader accessibility and decorative starfield layers.
- Modify: `src/app/routes.tsx` - export and upgrade `RouteFallback` to use `SatelliteLoader`.
- Modify: `src/app/App.test.tsx` - direct route fallback assertion.
- Modify: `src/components/command-palette.tsx` - HUD surface, scanline, and radar decoration inside the existing modal.
- Modify: `src/components/command-palette.test.tsx` - command palette HUD class/accessibility assertions.
- Modify: `src/features/inbox/inbox-page.tsx` - selected capture docking target and detail-panel pulse.
- Modify: `src/features/inbox/inbox-page.test.tsx` - selected capture class assertions.
- Modify: `src/features/daily/quick-capture-dock.tsx` - signal dock class on the capture panel.
- Create: `src/features/daily/quick-capture-dock.test.tsx` - capture dock class and submit behavior test.
- Modify: `src/features/daily/flight-plan.tsx` - launch completion class on existing completion toast.
- Modify: `src/features/daily/flight-plan.test.tsx` - completion flare class assertion.
- Modify: `src/features/calendar/calendar-page.tsx` - deadline pulse classes for overdue and today buckets.
- Create: `src/features/calendar/calendar-page.test.tsx` - direct `DeadlineCard` visual tone tests.
- Modify: `src/features/maps/map-canvas.tsx` - constellation canvas wrapper, node classes, and edge classes.
- Modify: `src/features/maps/map-canvas.test.tsx` - canvas shell and selected-node class assertions.
- Modify: `src/features/daily/focus-session-panel.tsx` - cockpit active glow class while focus is running.
- Modify: `src/features/daily/focus-session-panel.test.tsx` - focus active class assertion.

## Task 1: Shared Motion Primitives And Space Visuals

**Files:**
- Modify: `src/styles.css`
- Modify: `src/components/space-visuals.tsx`
- Create: `src/components/space-visuals.test.tsx`

- [ ] **Step 1: Write failing space visual tests**

Create `src/components/space-visuals.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SatelliteLoader, StarFieldBackground } from "./space-visuals";

describe("space visuals", () => {
  it("labels the satellite loader as a status indicator", () => {
    render(<SatelliteLoader label="Systems online" />);

    expect(screen.getByRole("status", { name: "Systems online" })).toBeTruthy();
    expect(screen.getByTestId("satellite-loader-trail")).toHaveAttribute("aria-hidden", "true");
  });

  it("renders layered starfield depth without exposing decorative layers", () => {
    const { container } = render(
      <div className="relative">
        <StarFieldBackground />
      </div>,
    );

    expect(container.querySelector(".orbit-starfield-far")).toBeTruthy();
    expect(container.querySelector(".orbit-starfield-near")).toBeTruthy();
    expect(container.querySelector(".orbit-debris-field")).toHaveAttribute("aria-hidden", "true");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm.cmd test -- src/components/space-visuals.test.tsx`

Expected: FAIL because `SatelliteLoader` has no `role="status"`, no `satellite-loader-trail` test id, and `StarFieldBackground` does not render `.orbit-starfield-far`, `.orbit-starfield-near`, or `.orbit-debris-field`.

- [ ] **Step 3: Update `StarFieldBackground` and `SatelliteLoader`**

Replace the two functions in `src/components/space-visuals.tsx` with:

```tsx
export function StarFieldBackground() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_14%,rgba(37,99,235,0.28),transparent_26%),radial-gradient(circle_at_86%_8%,rgba(34,211,238,0.18),transparent_24%),radial-gradient(circle_at_72%_82%,rgba(124,58,237,0.16),transparent_30%)]" />
      <div className="orbit-aurora absolute inset-x-[-10%] top-[-18rem] h-[34rem] opacity-70" />
      <div className="orbit-parallax-grid absolute inset-0 opacity-[0.18]" />
      <div className="orbit-starfield orbit-starfield-far absolute inset-0 opacity-45" />
      <div className="orbit-starfield orbit-starfield-near absolute inset-0 opacity-70" />
      <span className="orbit-debris-field orbit-debris-field-one" aria-hidden="true" />
      <span className="orbit-debris-field orbit-debris-field-two" aria-hidden="true" />
      <span className="comet-streak comet-streak-one" />
      <span className="comet-streak comet-streak-two" />
      <span className="comet-streak comet-streak-three" />
      <div className="absolute -right-24 top-24 h-80 w-80 rounded-full border border-cyan-300/10" />
      <div className="absolute -right-10 top-40 h-48 w-48 rounded-full border border-blue-400/10" />
    </div>
  );
}

export function SatelliteLoader({ label = "Entering orbit" }: { label?: string }) {
  return (
    <div aria-label={label} className="satellite-loader-shell inline-flex items-center gap-3 text-sm font-medium text-cyan-100" role="status">
      <span aria-hidden="true" className="relative grid h-10 w-10 place-items-center rounded-full border border-cyan-300/25 bg-slate-950/60">
        <span className="satellite-loader-orbit absolute h-8 w-8 rounded-full border border-cyan-300/35" />
        <span className="satellite-loader-trail absolute h-9 w-9 rounded-full" data-testid="satellite-loader-trail" />
        <span className="satellite-loader-pulse absolute h-5 w-5 rounded-full" />
        <span className="h-2.5 w-2.5 rounded-sm bg-cyan-200 shadow-[0_0_18px_rgba(34,211,238,0.9)]" />
      </span>
      <span aria-hidden="true">{label}</span>
    </div>
  );
}
```

- [ ] **Step 4: Add shared CSS primitives**

In `src/styles.css`, add this static CSS after `.focus-orbit-timer::after`:

```css
.orbit-page-enter {
  animation: orbit-page-enter 420ms ease-out both;
}

.orbit-loading-shell,
.orbit-hud-surface,
.orbit-constellation-canvas {
  position: relative;
  isolation: isolate;
  overflow: hidden;
}

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

.orbit-parallax-grid {
  background-image:
    linear-gradient(rgba(148, 163, 184, 0.18) 1px, transparent 1px),
    linear-gradient(90deg, rgba(148, 163, 184, 0.18) 1px, transparent 1px);
  background-size: 64px 64px;
}

.orbit-starfield-far {
  background-size:
    138px 138px,
    196px 196px;
  filter: blur(0.2px);
}

.orbit-starfield-near {
  background-size:
    92px 92px,
    132px 132px;
}

.orbit-debris-field {
  position: absolute;
  width: 8rem;
  height: 1px;
  border-radius: 999px;
  background: linear-gradient(90deg, transparent, rgba(148, 163, 184, 0.32), transparent);
  opacity: 0.34;
  transform: rotate(-18deg);
}

.orbit-debris-field-one {
  left: 14%;
  top: 32%;
}

.orbit-debris-field-two {
  right: 20%;
  bottom: 22%;
}

.satellite-loader-trail {
  border: 1px solid rgba(124, 58, 237, 0.28);
  box-shadow: 0 0 22px rgba(34, 211, 238, 0.14);
}

.satellite-loader-pulse {
  background: rgba(34, 211, 238, 0.1);
  box-shadow: 0 0 28px rgba(34, 211, 238, 0.32);
}

.orbit-hud-scan,
.orbit-command-radar {
  position: absolute;
  pointer-events: none;
  border-radius: inherit;
}

.orbit-hud-scan {
  inset: 0;
  background: linear-gradient(180deg, transparent, rgba(34, 211, 238, 0.12), transparent);
  opacity: 0;
}

.orbit-command-radar {
  right: 1rem;
  top: 1rem;
  height: 4.5rem;
  width: 4.5rem;
  border: 1px solid rgba(34, 211, 238, 0.16);
  background: conic-gradient(from 180deg, rgba(34, 211, 238, 0.24), transparent 42%, rgba(124, 58, 237, 0.16), transparent 78%);
  opacity: 0.32;
}

.orbit-dock-target {
  box-shadow: 0 0 0 1px rgba(34, 211, 238, 0.2), 0 0 26px rgba(34, 211, 238, 0.1);
}

.orbit-dock-pulse {
  animation: orbit-dock-pulse 260ms ease-out both;
}

.orbit-signal-dock {
  position: relative;
  overflow: hidden;
}

.orbit-signal-dock::after,
.orbit-launch-completion::after,
.orbit-deadline-pulse::after {
  content: "";
  position: absolute;
  pointer-events: none;
  border-radius: inherit;
}

.orbit-signal-dock::after {
  inset: 0;
  background: radial-gradient(circle at 16% 0%, rgba(34, 211, 238, 0.12), transparent 34%);
}

.orbit-launch-completion {
  position: relative;
  overflow: hidden;
}

.orbit-launch-completion::after {
  inset: 0;
  background: linear-gradient(90deg, transparent, rgba(52, 211, 153, 0.16), transparent);
  opacity: 0;
}

.orbit-deadline-pulse {
  position: relative;
}

.orbit-deadline-pulse::after {
  inset: -1px;
  border: 1px solid rgba(34, 211, 238, 0.32);
  opacity: 0.56;
}

.orbit-deadline-pulse-danger::after {
  border-color: rgba(251, 113, 133, 0.42);
}

.orbit-constellation-flow .react-flow__edge-path {
  stroke: rgba(103, 232, 249, 0.58);
}

.orbit-map-node {
  box-shadow: 0 12px 28px rgba(2, 8, 23, 0.3);
}

.orbit-map-node-selected {
  box-shadow: 0 0 0 1px rgba(34, 211, 238, 0.24), 0 0 34px rgba(34, 211, 238, 0.18);
}

.orbit-map-node-converted {
  box-shadow: 0 0 0 1px rgba(124, 58, 237, 0.22), 0 0 30px rgba(124, 58, 237, 0.14);
}

.orbit-map-edge-sequence .react-flow__edge-path {
  stroke-dasharray: 5 5;
}

.orbit-focus-active {
  box-shadow: 0 0 0 1px rgba(34, 211, 238, 0.24), 0 0 44px rgba(34, 211, 238, 0.12);
}
```

Inside the existing `@media (prefers-reduced-motion: no-preference)` block in `src/styles.css`, add:

```css
  .orbit-hud-scan {
    animation: orbit-hud-scan 1800ms ease-out infinite;
  }

  .orbit-command-radar {
    animation: orbit-loader 6s linear infinite;
  }

  .orbit-debris-field-one {
    animation: orbit-drift 18s ease-in-out infinite alternate;
  }

  .orbit-debris-field-two {
    animation: orbit-drift 22s 800ms ease-in-out infinite alternate-reverse;
  }

  .satellite-loader-trail {
    animation: orbit-loader-reverse 2.6s linear infinite;
  }

  .satellite-loader-pulse {
    animation: orbit-loader-pulse 1600ms ease-in-out infinite;
  }

  .orbit-launch-completion::after {
    animation: orbit-completion-sweep 900ms ease-out;
  }

  .orbit-deadline-pulse::after {
    animation: daily-orbit-pulse 2600ms ease-in-out infinite;
  }

  .orbit-focus-active {
    animation: orbit-focus-breathe 2400ms ease-in-out infinite;
  }
```

Add these keyframes near the other global keyframes:

```css
@keyframes orbit-page-enter {
  from {
    opacity: 0;
    transform: translateY(0.45rem);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes orbit-hud-scan {
  0% {
    opacity: 0;
    transform: translateY(-80%);
  }

  28% {
    opacity: 0.72;
  }

  100% {
    opacity: 0;
    transform: translateY(80%);
  }
}

@keyframes orbit-dock-pulse {
  from {
    opacity: 0.74;
    transform: translateY(0.35rem) scale(0.99);
  }

  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@keyframes orbit-drift {
  from {
    transform: translate3d(-0.6rem, -0.2rem, 0) rotate(-18deg);
  }

  to {
    transform: translate3d(0.8rem, 0.45rem, 0) rotate(-18deg);
  }
}

@keyframes orbit-loader-pulse {
  0%,
  100% {
    opacity: 0.34;
    transform: scale(0.78);
  }

  50% {
    opacity: 0.82;
    transform: scale(1.14);
  }
}

@keyframes orbit-completion-sweep {
  0% {
    opacity: 0;
    transform: translateX(-80%);
  }

  35% {
    opacity: 0.9;
  }

  100% {
    opacity: 0;
    transform: translateX(80%);
  }
}

@keyframes orbit-focus-breathe {
  0%,
  100% {
    box-shadow: 0 0 0 1px rgba(34, 211, 238, 0.22), 0 0 34px rgba(34, 211, 238, 0.1);
  }

  50% {
    box-shadow: 0 0 0 1px rgba(103, 232, 249, 0.32), 0 0 58px rgba(34, 211, 238, 0.16);
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm.cmd test -- src/components/space-visuals.test.tsx`

Expected: PASS with 1 test file and 2 tests passing.

- [ ] **Step 6: Commit shared motion primitives**

Run:

```bash
git add src/styles.css src/components/space-visuals.tsx src/components/space-visuals.test.tsx
git commit -m "Add OrbitFlo shared motion primitives"
```

Expected: commit succeeds with only those three files staged.

## Task 2: Themed Route Loading Shell

**Files:**
- Modify: `src/app/routes.tsx`
- Modify: `src/app/App.test.tsx`

- [ ] **Step 1: Write failing route fallback test**

In `src/app/App.test.tsx`, change the import to:

```tsx
import { App } from "./App";
import { RouteFallback } from "./routes";
```

Add this test inside the `describe("App", () => { ... })` block:

```tsx
  it("renders a themed route loading shell", () => {
    render(<RouteFallback />);

    expect(screen.getByRole("status", { name: "Systems online" })).toBeTruthy();
    expect(screen.getByText("Synchronizing workspace telemetry.")).toBeTruthy();
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm.cmd test -- src/app/App.test.tsx`

Expected: FAIL because `RouteFallback` is not exported and the fallback text still says `Loading workspace...`.

- [ ] **Step 3: Implement themed route fallback**

In `src/app/routes.tsx`, add this import:

```tsx
import { SatelliteLoader } from "../components/space-visuals";
```

Replace the existing `RouteFallback` with:

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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm.cmd test -- src/app/App.test.tsx`

Expected: PASS with all `App` tests passing.

- [ ] **Step 5: Commit route loading shell**

Run:

```bash
git add src/app/routes.tsx src/app/App.test.tsx
git commit -m "Add themed route loading shell"
```

Expected: commit succeeds with only route fallback files staged.

## Task 3: Command Palette HUD

**Files:**
- Modify: `src/components/command-palette.tsx`
- Modify: `src/components/command-palette.test.tsx`

- [ ] **Step 1: Write failing command palette HUD test**

Add this test to `src/components/command-palette.test.tsx`:

```tsx
  it("renders the command palette as an orbital HUD", async () => {
    const user = userEvent.setup();

    renderCommandPalette();

    await user.click(screen.getByRole("button", { name: "Open command palette" }));
    const dialog = screen.getByRole("dialog", { name: "Command palette" });

    expect(dialog.querySelector(".orbit-hud-surface")).toBeTruthy();
    expect(dialog.querySelector(".orbit-hud-scan")).toHaveAttribute("aria-hidden", "true");
    expect(dialog.querySelector(".orbit-command-radar")).toHaveAttribute("aria-hidden", "true");
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm.cmd test -- src/components/command-palette.test.tsx`

Expected: FAIL because the modal content does not yet render `.orbit-hud-surface`, `.orbit-hud-scan`, or `.orbit-command-radar`.

- [ ] **Step 3: Add HUD structure to the modal content**

In `src/components/command-palette.tsx`, replace:

```tsx
          <div className="grid gap-4">
```

with:

```tsx
          <div className="orbit-hud-surface grid gap-4 rounded-lg">
            <span aria-hidden="true" className="orbit-hud-scan" />
            <span aria-hidden="true" className="orbit-command-radar" />
            <div className="relative z-10 grid gap-4">
```

Then add the missing closing `</div>` immediately before the closing `</div>` that ends the modal content wrapper:

```tsx
            {successMessage ? <p className="text-xs font-semibold text-emerald-200">{successMessage}</p> : null}
            {captureMutation.isError ? <p className="text-xs font-semibold text-rose-200">{captureError}</p> : null}
            </div>
          </div>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm.cmd test -- src/components/command-palette.test.tsx`

Expected: PASS with command palette filtering, capture, and HUD tests passing.

- [ ] **Step 5: Commit command palette HUD**

Run:

```bash
git add src/components/command-palette.tsx src/components/command-palette.test.tsx
git commit -m "Add orbital command palette HUD"
```

Expected: commit succeeds with only command palette files staged.

## Task 4: Inbox Docking And Daily Launch Details

**Files:**
- Modify: `src/features/inbox/inbox-page.tsx`
- Modify: `src/features/inbox/inbox-page.test.tsx`
- Modify: `src/features/daily/quick-capture-dock.tsx`
- Create: `src/features/daily/quick-capture-dock.test.tsx`
- Modify: `src/features/daily/flight-plan.tsx`
- Modify: `src/features/daily/flight-plan.test.tsx`

- [ ] **Step 1: Write failing inbox docking test**

Add this test to `src/features/inbox/inbox-page.test.tsx`:

```tsx
  it("marks the selected capture as docked into the detail panel", async () => {
    renderInboxPage();

    const selectedButton = await screen.findByRole("button", { name: /Inbox task\s+task/i });
    expect(selectedButton).toHaveClass("orbit-dock-target");

    const detailPanel = screen.getByRole("heading", { name: "Inbox task" }).closest(".orbit-panel");
    expect(detailPanel).toHaveClass("orbit-dock-pulse");
  });
```

- [ ] **Step 2: Write failing quick capture dock test**

Create `src/features/daily/quick-capture-dock.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { QuickCaptureDock } from "./quick-capture-dock";

describe("QuickCaptureDock", () => {
  it("renders as an orbital signal dock", () => {
    render(<QuickCaptureDock isSubmitting={false} onSubmit={() => undefined} resetSignal={0} />);

    expect(screen.getByText("Quick Capture").closest("section")).toHaveClass("orbit-signal-dock");
  });

  it("submits trimmed capture values", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<QuickCaptureDock isSubmitting={false} onSubmit={onSubmit} resetSignal={0} />);

    await user.type(screen.getByLabelText("Capture title"), "  Capture launch note  ");
    await user.type(screen.getByLabelText("Signal notes"), "  Follow up after review.  ");
    await user.click(screen.getByRole("button", { name: "Dock signal" }));

    expect(onSubmit).toHaveBeenCalledWith({
      type: "task",
      title: "Capture launch note",
      body: "Follow up after review.",
    });
  });
});
```

- [ ] **Step 3: Add failing launch completion class assertion**

In the `announces a recent completion` test in `src/features/daily/flight-plan.test.tsx`, add:

```tsx
    const completionToast = screen.getByText("Launch polish completed. Momentum updated.").closest("div");
    expect(completionToast).toHaveClass("daily-completion-flare", "orbit-launch-completion");
```

- [ ] **Step 4: Run tests to verify they fail**

Run: `npm.cmd test -- src/features/inbox/inbox-page.test.tsx src/features/daily/quick-capture-dock.test.tsx src/features/daily/flight-plan.test.tsx`

Expected: FAIL because the new classes are not wired into the inbox, quick capture dock, and completion toast.

- [ ] **Step 5: Wire inbox docking classes**

In `src/features/inbox/inbox-page.tsx`, update the selected capture button class:

```tsx
                      className={`w-full rounded-md border px-3 py-2 text-left transition ${
                        isSelected
                          ? "orbit-dock-target border-cyan-300/45 bg-cyan-300/10"
                          : "border-slate-400/15 bg-slate-950/20 hover:border-cyan-300/35 hover:bg-slate-900/60"
                      }`}
```

Update the detail panel wrapper:

```tsx
            <div className="orbit-panel orbit-dock-pulse rounded-lg p-5" key={selectedCapture.id}>
```

- [ ] **Step 6: Wire daily capture and completion classes**

In `src/features/daily/quick-capture-dock.tsx`, replace:

```tsx
    <QuietPanel>
```

with:

```tsx
    <QuietPanel className="orbit-signal-dock">
```

In `src/features/daily/flight-plan.tsx`, replace the completion toast class with:

```tsx
    <div className="daily-completion-flare orbit-launch-completion mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-emerald-300/25 bg-emerald-300/10 px-3 py-2 text-sm font-semibold text-emerald-100">
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `npm.cmd test -- src/features/inbox/inbox-page.test.tsx src/features/daily/quick-capture-dock.test.tsx src/features/daily/flight-plan.test.tsx`

Expected: PASS with inbox, quick capture dock, and flight plan tests passing.

- [ ] **Step 8: Commit inbox and daily motion**

Run:

```bash
git add src/features/inbox/inbox-page.tsx src/features/inbox/inbox-page.test.tsx src/features/daily/quick-capture-dock.tsx src/features/daily/quick-capture-dock.test.tsx src/features/daily/flight-plan.tsx src/features/daily/flight-plan.test.tsx
git commit -m "Add inbox docking and daily launch motion"
```

Expected: commit succeeds with only inbox and daily files staged.

## Task 5: Calendar Deadline Pulses And Map Constellation Styling

**Files:**
- Modify: `src/features/calendar/calendar-page.tsx`
- Create: `src/features/calendar/calendar-page.test.tsx`
- Modify: `src/features/maps/map-canvas.tsx`
- Modify: `src/features/maps/map-canvas.test.tsx`

- [ ] **Step 1: Write failing calendar deadline tests**

Create `src/features/calendar/calendar-page.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Database } from "../../lib/supabase/database.types";
import { DeadlineCard } from "./calendar-page";

type Project = Database["public"]["Tables"]["projects"]["Row"];
type WorkItem = Database["public"]["Tables"]["work_items"]["Row"];

function project(overrides: Partial<Project> = {}): Project {
  return {
    id: "project-1",
    workspace_id: "workspace-1",
    name: "OrbitFlo",
    description: null,
    status: "active",
    priority: "medium",
    health: "good",
    color: null,
    repository_url: null,
    created_by: "user-1",
    created_at: "2026-06-29T00:00:00.000Z",
    updated_at: "2026-06-29T00:00:00.000Z",
    ...overrides,
  };
}

function workItem(overrides: Partial<WorkItem> = {}): WorkItem {
  return {
    id: "work-item-1",
    workspace_id: "workspace-1",
    project_id: "project-1",
    milestone_id: null,
    title: "Deadline task",
    description: null,
    status: "ready",
    priority: "high",
    due_date: "2026-07-02",
    estimate_points: null,
    sort_order: 0,
    blocked_reason: null,
    created_by: "user-1",
    created_at: "2026-06-29T00:00:00.000Z",
    updated_at: "2026-06-29T00:00:00.000Z",
    completed_at: null,
    ...overrides,
  };
}

describe("DeadlineCard", () => {
  it("marks urgent deadline cards with danger pulse styling", () => {
    render(<DeadlineCard item={workItem()} motionTone="urgent" onOpenItem={vi.fn()} projectsById={new Map([["project-1", project()]])} />);

    expect(screen.getByRole("button", { name: /Deadline task/i })).toHaveClass("orbit-deadline-pulse", "orbit-deadline-pulse-danger");
  });

  it("marks today's deadline cards with orbital pulse styling", () => {
    render(<DeadlineCard item={workItem({ title: "Today task" })} motionTone="today" onOpenItem={vi.fn()} projectsById={new Map([["project-1", project()]])} />);

    expect(screen.getByRole("button", { name: /Today task/i })).toHaveClass("orbit-deadline-pulse");
    expect(screen.getByRole("button", { name: /Today task/i })).not.toHaveClass("orbit-deadline-pulse-danger");
  });
});
```

- [ ] **Step 2: Add failing map canvas assertions**

In the React Flow mock type in `src/features/maps/map-canvas.test.tsx`, change the `nodes` type to include `className?: string`:

```tsx
    nodes: Array<{ id: string; className?: string; data: { label: string }; position: { x: number; y: number } }>;
```

In the mocked node button, add `className={node.className}`:

```tsx
        <button className={node.className} key={node.id} type="button" onClick={() => onNodeClick?.({}, { id: node.id })}>
          {node.data.label} ({node.position.x}, {node.position.y})
        </button>
```

Add these tests to `src/features/maps/map-canvas.test.tsx`:

```tsx
  it("wraps the map in a constellation canvas shell", () => {
    render(<MapCanvas graph={graph} selectedNodeId={null} view="mind_map" onChange={() => undefined} onSelectNode={() => undefined} />);

    expect(screen.getByLabelText("Visual planning canvas")).toHaveClass("orbit-constellation-canvas");
  });

  it("marks the selected map node with orbital styling", () => {
    render(<MapCanvas graph={graph} selectedNodeId="node-1" view="mind_map" onChange={() => undefined} onSelectNode={() => undefined} />);

    expect(screen.getByRole("button", { name: "Feature idea (0, 0)" })).toHaveClass("orbit-map-node", "orbit-map-node-selected");
  });
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm.cmd test -- src/features/calendar/calendar-page.test.tsx src/features/maps/map-canvas.test.tsx`

Expected: FAIL because `DeadlineCard` is not exported, deadline motion classes are not supported, and `MapCanvas` has no constellation wrapper or node classes.

- [ ] **Step 4: Wire calendar deadline tone classes**

In `src/features/calendar/calendar-page.tsx`, add:

```tsx
import { clsx } from "clsx";
```

Add this type near the `WorkItem` type:

```tsx
type DeadlineMotionTone = "normal" | "today" | "urgent";
```

Replace `function DeadlineCard` with:

```tsx
export function DeadlineCard({
  item,
  motionTone = "normal",
  onOpenItem,
  projectsById,
}: {
  item: WorkItem;
  motionTone?: DeadlineMotionTone;
  onOpenItem: (id: string) => void;
  projectsById: Map<string, Project>;
}) {
  return (
    <button
      className={clsx(
        "orbit-task-card grid gap-2 rounded-md border border-slate-400/15 bg-slate-950/68 p-3 text-left transition hover:border-cyan-300/35",
        motionTone === "today" && "orbit-deadline-pulse",
        motionTone === "urgent" && "orbit-deadline-pulse orbit-deadline-pulse-danger",
      )}
      onClick={() => onOpenItem(item.id)}
      type="button"
    >
      <div className="min-w-0">
        <p className="truncate text-xs font-semibold text-cyan-100">{projectName(projectsById, item)}</p>
        <h3 className="mt-1 break-words text-sm font-semibold text-white">{item.title}</h3>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <StatusPill tone={priorityTone(item.priority)}>{item.priority}</StatusPill>
        <StatusPill tone="neutral">{item.status.replaceAll("_", " ")}</StatusPill>
      </div>
    </button>
  );
}
```

Add this helper near `formatDueDate`:

```tsx
function deadlineMotionToneForBucket(label: string): DeadlineMotionTone {
  if (label === "Overdue") return "urgent";
  if (label === "Today") return "today";
  return "normal";
}
```

Inside the bucket render, replace the `DeadlineCard` call with:

```tsx
                      <DeadlineCard
                        item={item}
                        motionTone={deadlineMotionToneForBucket(label as string)}
                        onOpenItem={setSelectedWorkItemId}
                        projectsById={projectsById}
                      />
```

- [ ] **Step 5: Wire map constellation classes**

In `src/features/maps/map-canvas.tsx`, add:

```tsx
import { clsx } from "clsx";
```

In `toFlowNode`, add `className` to the returned node:

```tsx
    className: clsx(
      "orbit-map-node",
      node.id === selectedNodeId && "orbit-map-node-selected",
      node.status === "converted" && "orbit-map-node-converted",
    ),
```

In `toFlowEdge`, add `className` to the returned edge:

```tsx
    className: edge.edgeType === "sequence" ? "orbit-map-edge-sequence" : "orbit-map-edge",
```

Replace the canvas wrapper:

```tsx
      <div className="min-h-[480px] overflow-hidden rounded-lg border border-white/10 bg-slate-950/60">
```

with:

```tsx
      <div aria-label="Visual planning canvas" className="orbit-constellation-canvas min-h-[480px] overflow-hidden rounded-lg border border-white/10 bg-slate-950/60">
```

Add `className="orbit-constellation-flow"` to the `ReactFlow` component:

```tsx
        <ReactFlow
          className="orbit-constellation-flow"
          nodes={nodes}
          edges={edges}
          fitView
          onConnect={handleConnect}
          onEdgesChange={handleEdgesChange}
          onNodeClick={handleNodeClick}
          onNodesChange={handleNodesChange}
          onPaneClick={handlePaneClick}
        >
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npm.cmd test -- src/features/calendar/calendar-page.test.tsx src/features/maps/map-canvas.test.tsx`

Expected: PASS with calendar and map canvas tests passing.

- [ ] **Step 7: Commit calendar and maps motion**

Run:

```bash
git add src/features/calendar/calendar-page.tsx src/features/calendar/calendar-page.test.tsx src/features/maps/map-canvas.tsx src/features/maps/map-canvas.test.tsx
git commit -m "Add calendar and map orbital motion cues"
```

Expected: commit succeeds with only calendar and map files staged.

## Task 6: Focus Cockpit Active State

**Files:**
- Modify: `src/features/daily/focus-session-panel.tsx`
- Modify: `src/features/daily/focus-session-panel.test.tsx`

- [ ] **Step 1: Write failing focus active test**

Add this test to `src/features/daily/focus-session-panel.test.tsx`:

```tsx
  it("adds cockpit glow while a focus session is running", async () => {
    const user = userEvent.setup();

    render(<FocusSessionPanel items={[planItem()]} />);

    const cockpit = screen.getByLabelText("Drop task into Focus Cockpit");
    expect(cockpit).not.toHaveClass("orbit-focus-active");

    await user.click(screen.getByRole("button", { name: "Launch focus session" }));

    expect(cockpit).toHaveClass("orbit-focus-active");
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm.cmd test -- src/features/daily/focus-session-panel.test.tsx`

Expected: FAIL because the focus cockpit section does not add `orbit-focus-active` while running.

- [ ] **Step 3: Wire focus active class**

In `src/features/daily/focus-session-panel.tsx`, add:

```tsx
import { clsx } from "clsx";
```

Replace the section class:

```tsx
      className="orbit-panel overflow-hidden rounded-lg p-4"
```

with:

```tsx
      className={clsx("orbit-panel overflow-hidden rounded-lg p-4", focusState === "running" && "orbit-focus-active")}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm.cmd test -- src/features/daily/focus-session-panel.test.tsx`

Expected: PASS with all focus session tests passing.

- [ ] **Step 5: Commit focus cockpit active state**

Run:

```bash
git add src/features/daily/focus-session-panel.tsx src/features/daily/focus-session-panel.test.tsx
git commit -m "Add focus cockpit active motion"
```

Expected: commit succeeds with only focus session files staged.

## Task 7: Verification And Final Pass

**Files:**
- Read: all modified files from Tasks 1-6

- [ ] **Step 1: Run focused tests for touched areas**

Run:

```bash
npm.cmd test -- src/components/space-visuals.test.tsx src/app/App.test.tsx src/components/command-palette.test.tsx src/features/inbox/inbox-page.test.tsx src/features/daily/quick-capture-dock.test.tsx src/features/daily/flight-plan.test.tsx src/features/calendar/calendar-page.test.tsx src/features/maps/map-canvas.test.tsx src/features/daily/focus-session-panel.test.tsx
```

Expected: PASS with all listed test files passing.

- [ ] **Step 2: Run the full unit suite**

Run: `npm.cmd test`

Expected: PASS with the full Vitest suite passing.

- [ ] **Step 3: Run production build**

Run: `npm.cmd run build`

Expected: PASS with TypeScript build and Vite production build completing.

- [ ] **Step 4: Run E2E smoke test**

Run: `npm.cmd run e2e`

Expected: PASS with the existing browser smoke test completing.

- [ ] **Step 5: Inspect final diff**

Run: `git status --short`

Expected: only files intentionally modified by this plan are present, plus pre-existing unrelated work that was already dirty before this plan started.

Run: `git diff -- src/styles.css src/components/space-visuals.tsx src/components/space-visuals.test.tsx src/app/routes.tsx src/app/App.test.tsx src/components/command-palette.tsx src/components/command-palette.test.tsx src/features/inbox/inbox-page.tsx src/features/inbox/inbox-page.test.tsx src/features/daily/quick-capture-dock.tsx src/features/daily/quick-capture-dock.test.tsx src/features/daily/flight-plan.tsx src/features/daily/flight-plan.test.tsx src/features/calendar/calendar-page.tsx src/features/calendar/calendar-page.test.tsx src/features/maps/map-canvas.tsx src/features/maps/map-canvas.test.tsx src/features/daily/focus-session-panel.tsx src/features/daily/focus-session-panel.test.tsx`

Expected: diff shows only shared motion primitives, decorative class wiring, and tests for accessibility/class contracts. It does not contain SQL, Supabase schema changes, route restructuring, or theme color replacement.

- [ ] **Step 6: Final commit**

If Tasks 1-6 were committed individually, skip this step.

If Tasks 1-6 were executed without individual commits, run:

```bash
git add src/styles.css src/components/space-visuals.tsx src/components/space-visuals.test.tsx src/app/routes.tsx src/app/App.test.tsx src/components/command-palette.tsx src/components/command-palette.test.tsx src/features/inbox/inbox-page.tsx src/features/inbox/inbox-page.test.tsx src/features/daily/quick-capture-dock.tsx src/features/daily/quick-capture-dock.test.tsx src/features/daily/flight-plan.tsx src/features/daily/flight-plan.test.tsx src/features/calendar/calendar-page.tsx src/features/calendar/calendar-page.test.tsx src/features/maps/map-canvas.tsx src/features/maps/map-canvas.test.tsx src/features/daily/focus-session-panel.tsx src/features/daily/focus-session-panel.test.tsx
git commit -m "Add OrbitFlo motion system"
```

Expected: commit succeeds with only files touched by this plan staged.

## Self-Review

- Spec coverage: shared motion primitives are covered in Task 1; route loading in Task 2; command palette HUD in Task 3; inbox and daily touches in Task 4; calendar and maps in Task 5; focus cockpit in Task 6; verification in Task 7.
- Accessibility: decorative elements use `aria-hidden`; `SatelliteLoader` gets a named `role="status"`; command palette dialog semantics stay inside the existing `Modal`.
- Reduced motion: new animations are placed inside `prefers-reduced-motion: no-preference`, and the existing reduce media query disables animation and transition duration globally.
- Data model: no SQL, Supabase schema, query contract, or persisted data shape changes.
- Theme guardrail: CSS uses existing OrbitFlo token colors and does not replace palette, navigation, layout, or brand assets.
