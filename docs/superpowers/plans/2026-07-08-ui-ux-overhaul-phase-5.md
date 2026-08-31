# UI/UX Overhaul — Phase 5 (Shared Component Sweep) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consolidate feedback messages into one `InlineAlert`, refresh `EmptyState`/`Modal` onto the foundation, strip the command palette's HUD noise, and retune the auth orbit scene.

**Architecture:** Pure presentation. `InlineAlert` centralizes the 27 hand-rolled rose/emerald `<p>` boxes (the flight-plan completion toast keeps its Ignite classes and stays custom). `Modal` adopts `surface-raised` + the Settle animation, which the command palette inherits. Auth scene loses two of three floating chips and slows all loops.

**Tech Stack:** React 19, TypeScript strict, Tailwind v4 + `src/styles.css`, vitest + testing-library.

**Spec:** `docs/superpowers/specs/2026-07-07-ui-ux-overhaul-design.md` (Section 3, "Shared components" + "Auth page" in Section 2).

## Global Constraints

- Work in `C:\src\Personal\ToDo\.worktrees\project-command-center` on `codex/project-command-center`.
- `npm test` green after every task (`--maxWorkers=2` under load; fork timeouts are environmental).
- No new dependencies. No query/mutation changes — message CONTENT and conditions stay identical, only the wrapper component changes.
- Keep Ignite classes (`daily-completion-flare`, `orbit-launch-completion`) on the flight-plan toast; keep `daily-capture-dock` on the capture success alert (pass via className).
- Commit after every task.

---

### Task 1: InlineAlert component

**Files:**
- Create: `src/components/inline-alert.tsx`
- Create: `src/components/inline-alert.test.tsx`

**Interfaces:**
- Produces: `InlineAlert({ tone, children, className? })` where `tone: "success" | "error"`. Renders a `<p role="alert">` (error) or `<p role="status">` (success) with the exact class strings used across the app today.

- [ ] **Step 1: Write the failing test**

Create `src/components/inline-alert.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { InlineAlert } from "./inline-alert";

describe("InlineAlert", () => {
  it("renders an error alert", () => {
    render(<InlineAlert tone="error">Docking bay offline</InlineAlert>);

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Docking bay offline");
    expect(alert).toHaveClass("border-rose-300/25", "bg-rose-300/10", "text-rose-100");
  });

  it("renders a success status with extra classes", () => {
    render(
      <InlineAlert className="daily-capture-dock" tone="success">
        Signal docked.
      </InlineAlert>,
    );

    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("Signal docked.");
    expect(status).toHaveClass("daily-capture-dock", "border-emerald-300/25", "bg-emerald-300/10", "text-emerald-100");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/inline-alert.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `src/components/inline-alert.tsx`:

```tsx
import { clsx } from "clsx";
import type { ReactNode } from "react";

const toneClass = {
  success: "border-emerald-300/25 bg-emerald-300/10 text-emerald-100",
  error: "border-rose-300/25 bg-rose-300/10 text-rose-100",
};

export function InlineAlert({
  children,
  className,
  tone,
}: {
  children: ReactNode;
  className?: string;
  tone: "success" | "error";
}) {
  return (
    <p
      className={clsx("rounded-lg border px-3 py-2 text-sm font-semibold", toneClass[tone], className)}
      role={tone === "error" ? "alert" : "status"}
    >
      {children}
    </p>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/inline-alert.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/inline-alert.tsx src/components/inline-alert.test.tsx
git commit -m "Add shared inline alert component"
```

---

### Task 2: Alert sweep — replace hand-rolled boxes

**Files:**
- Modify: `src/features/daily/daily-mission-control-page.tsx` (8 boxes)
- Modify: `src/features/projects/project-workspace-page.tsx` (8 boxes)
- Modify: `src/features/maps/maps-page.tsx` (3 boxes, rose-400 variant)
- Modify: `src/features/inbox/inbox-page.tsx` (2)
- Modify: `src/features/notes/notes-page.tsx` (2)
- Modify: `src/features/calendar/calendar-page.tsx` (1)
- Modify: `src/features/dashboard/dashboard-page.tsx` (1)
- Modify: `src/features/meetings/meeting-notes-panel.tsx` (1)
- Modify: `src/features/projects/launch-checklist-panel.tsx` (1)
- NOT modified: `src/features/daily/flight-plan.tsx` (completion toast keeps Ignite classes)

**Interfaces:**
- Consumes: `InlineAlert` from `../../components/inline-alert` (Task 1).

- [ ] **Step 1: Mechanical replacement**

In each listed file, add the import and apply these transforms (message expressions unchanged):

- `<p className="rounded-lg border border-rose-300/25 bg-rose-300/10 px-3 py-2 text-sm font-semibold text-rose-100">{X}</p>` → `<InlineAlert tone="error">{X}</InlineAlert>`
- `<p className="rounded-md border border-rose-400/30 bg-rose-400/10 px-3 py-2 text-sm text-rose-100">{X}</p>` → `<InlineAlert tone="error">{X}</InlineAlert>` (maps-page variant; the one inside the inspector drawer keeps its `mt-3` via `className="mt-3"`)
- `<p className="daily-capture-dock rounded-lg border border-emerald-300/25 bg-emerald-300/10 px-3 py-2 text-sm font-semibold text-emerald-100">{X}</p>` → `<InlineAlert className="daily-capture-dock" tone="success">{X}</InlineAlert>`
- `<p className="rounded-lg border border-emerald-300/25 bg-emerald-300/10 px-3 py-2 text-sm font-semibold text-emerald-100">{X}</p>` → `<InlineAlert tone="success">{X}</InlineAlert>`
- Multi-line rose boxes with `key={...}` (inbox) keep the key on `<InlineAlert key={...} tone="error">`.
- The workspace's two-line brief error (`<span className="block">…` children) keeps its children as-is inside `<InlineAlert tone="error">`.

Use `grep -n "border-rose-300/25 bg-rose-300/10\|border-rose-400/30 bg-rose-400/10\|border-emerald-300/25 bg-emerald-300/10" src -r` to confirm ZERO remaining matches outside `flight-plan.tsx` and `inline-alert.tsx` when done.

- [ ] **Step 2: Verify**

Run: `npx vitest run src/features 2>&1 | tail -5`
Expected: all PASS (no test asserts the raw box classes outside flight-plan; if one does, it now finds the same classes on InlineAlert's `<p>`).

- [ ] **Step 3: Commit**

```bash
git add -A src
git commit -m "Consolidate feedback messages into InlineAlert"
```

---

### Task 3: EmptyState + Modal refresh

**Files:**
- Modify: `src/components/empty-state.tsx`
- Modify: `src/components/modal.tsx`

**Interfaces:** unchanged exports/props for both.

- [ ] **Step 1: Fix EmptyState's duplicated loading title**

In `src/components/empty-state.tsx`, the loading state currently renders the title twice (SatelliteLoader's visible label + the `<h2>`). Change the loader call from:

```tsx
          <SatelliteLoader label={title} />
```

to:

```tsx
          <SatelliteLoader label="" />
```

and in `src/components/space-visuals.tsx`, make `SatelliteLoader` skip the text span when the label is empty — replace:

```tsx
      <span aria-hidden="true">{label}</span>
```

with:

```tsx
      {label ? <span aria-hidden="true">{label}</span> : null}
```

and change the `aria-label` fallback so the status role keeps a name: replace

```tsx
    <div aria-label={label} className="satellite-loader-shell inline-flex items-center gap-3 text-sm font-medium text-cyan-100" role="status">
```

with:

```tsx
    <div aria-label={label || "Loading"} className="satellite-loader-shell inline-flex items-center gap-3 text-sm font-medium text-cyan-100" role="status">
```

Also swap the wrapper: `EmptyState`'s root `orbit-panel rounded-lg border-dashed p-6` stays, but the inner `orbit-float-card` (infinite float — a leftover loop) is removed: change

```tsx
      <div className="orbit-float-card mx-auto mb-4 grid w-full max-w-40 place-items-center overflow-hidden rounded-lg">
```

to:

```tsx
      <div className="mx-auto mb-4 grid w-full max-w-40 place-items-center overflow-hidden rounded-lg">
```

- [ ] **Step 2: Modal → surface-raised + Settle**

In `src/components/modal.tsx`, change:

```tsx
        className="orbit-panel w-full max-w-lg rounded-lg p-5 shadow-xl"
```

to:

```tsx
        className="surface-raised orbit-page-enter w-full max-w-lg rounded-lg p-5"
```

- [ ] **Step 3: Verify**

Run: `npx vitest run src/components src/app 2>&1 | tail -4`
Expected: PASS. `App.test.tsx` asserts `getByRole("status", { name: "Systems online" })` — RouteFallback passes a non-empty label, unaffected.

- [ ] **Step 4: Commit**

```bash
git add src/components/empty-state.tsx src/components/space-visuals.tsx src/components/modal.tsx
git commit -m "Refresh empty state and modal onto the foundation"
```

---

### Task 4: Command palette — drop the radar and scanline

**Files:**
- Modify: `src/components/command-palette.tsx:151-153`
- Modify: `src/components/command-palette.test.tsx:118-120`
- Modify: `src/styles.css` (delete `.orbit-hud-scan` / `.orbit-command-radar` rules + animation hookups)

- [ ] **Step 1: Update the test**

In `src/components/command-palette.test.tsx`, replace:

```tsx
    expect(dialog.querySelector(".orbit-hud-surface")).toBeTruthy();
    expect(dialog.querySelector(".orbit-hud-scan")).toHaveAttribute("aria-hidden", "true");
    expect(dialog.querySelector(".orbit-command-radar")).toHaveAttribute("aria-hidden", "true");
```

with:

```tsx
    expect(dialog.querySelector(".orbit-hud-surface")).toBeTruthy();
    expect(dialog.querySelector(".orbit-hud-scan")).toBeNull();
    expect(dialog.querySelector(".orbit-command-radar")).toBeNull();
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/command-palette.test.tsx`
Expected: FAIL — scan/radar still present.

- [ ] **Step 3: Remove the decorations**

In `src/components/command-palette.tsx`, delete:

```tsx
            <span aria-hidden="true" className="orbit-hud-scan" />
            <span aria-hidden="true" className="orbit-command-radar" />
```

In `src/styles.css`: delete the `.orbit-hud-scan, .orbit-command-radar { ... }` shared rule, the `.orbit-hud-scan { ... }` and `.orbit-command-radar { ... }` rules, `@keyframes orbit-hud-scan`, and the two animation hookups (`.orbit-hud-scan { animation: orbit-hud-scan ... }`, `.orbit-command-radar { animation: orbit-loader 6s ... }`) inside the motion media query.

- [ ] **Step 4: Verify and commit**

Run: `npx vitest run src/components/command-palette.test.tsx` → PASS.

```bash
git add src/components/command-palette.tsx src/components/command-palette.test.tsx src/styles.css
git commit -m "Drop command palette radar and scanline"
```

---

### Task 5: Auth orbit scene retune

**Files:**
- Modify: `src/components/auth-orbit-scene.tsx`
- Modify: `src/styles.css` (auth animation durations)
- Check: `src/features/auth/auth-page.test.tsx` (update if it counts chips)

- [ ] **Step 1: Reduce floating chips 3 → 1**

In `src/components/auth-orbit-scene.tsx`, replace the `satellites` array with:

```tsx
const satellites = [
  { label: "Plan", className: "auth-orbit-satellite-one", tone: "cyan" },
];
```

- [ ] **Step 2: Slow the loops**

In `src/styles.css` inside the motion media query, change durations:
- `.auth-orbit-glow` → `animation: auth-orbit-breathe 8s ease-in-out infinite;`
- `.auth-orbit-ring-wide` → `32s`, `.auth-orbit-ring-mid` → `26s`, `.auth-orbit-ring-tight` → `20s`
- `.auth-orbit-core` → `animation: auth-orbit-core-pulse 7s ease-in-out infinite;`
- `.auth-orbit-path-one` → `14s`, `.auth-orbit-path-two` → `11s`
- `.auth-orbit-card, .auth-orbit-metric` → `animation: orbit-float 9s ease-in-out infinite;`

Delete the now-dead `.auth-orbit-satellite-two` / `.auth-orbit-satellite-three` animation-delay rules and their position rules (`.auth-orbit-satellite-two`, `.auth-orbit-satellite-three`) outside the media query.

- [ ] **Step 3: Verify**

Run: `npx vitest run src/features/auth src/components 2>&1 | tail -4`
Expected: PASS. If `auth-page.test.tsx` asserts "Build"/"Review" chips, delete those assertions (chips intentionally removed; spec: 3 → 1).

- [ ] **Step 4: Commit**

```bash
git add src/components/auth-orbit-scene.tsx src/styles.css src/features/auth/auth-page.test.tsx
git commit -m "Retune auth orbit scene to slower, sparser motion"
```

---

### Task 6: Verification pass

- [ ] **Step 1:** `npm test` (or `npx vitest run --maxWorkers=2`) — all green.
- [ ] **Step 2:** `npm run build` — exit 0.
- [ ] **Step 3:** Fake-session Playwright screenshots: auth page + Today page; confirm single floating chip, slower scene, modal/palette on `surface-raised` (open palette via Ctrl+K if feasible; otherwise unit tests cover it).
- [ ] **Step 4:** Commit any polish as `Polish shared components after visual verification`.

## Self-Review (completed)

- **Spec coverage:** InlineAlert ✔ (T1–T2), EmptyState loader/empty refresh ✔ (T3 — constellation illustration already exists via `SpaceEmptyIllustration`; the fix is the duplicate title + float loop), Modal surface-raised + Settle ✔ (T3), palette keeps HUD personality minus radar/scan ✔ (T4), auth chips 3→1 + slower ✔ (T5).
- **Type consistency:** `InlineAlert` props consistent across T1/T2.
- **Placeholders:** T2 is a mechanical transform spec with exact before/after patterns and a grep exit-check.
