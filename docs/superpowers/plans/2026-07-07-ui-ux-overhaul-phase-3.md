# UI/UX Overhaul — Phase 3 (Project Workspace + Inbox) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Slim the Project Workspace (collapsed brief, one-row header, quiet cards) and rebuild the Inbox as a centered triage stack, per the approved spec.

**Architecture:** Pure presentation changes on the Phase 1–2 foundation (`surface-*` classes, calmed legacy classes). No query/mutation changes. The Project Brief gains a `<details>` collapse; the Inbox reflows from two-column to one centered column with the current capture on top.

**Tech Stack:** React 19, TypeScript strict, Tailwind v4 + `src/styles.css` component classes, vitest + testing-library.

**Spec:** `docs/superpowers/specs/2026-07-07-ui-ux-overhaul-design.md` (Section 2: Project Workspace, Inbox). Phases 4–5 get separate plans.

## Global Constraints

- Work in `C:\src\Personal\ToDo\.worktrees\project-command-center` on branch `codex/project-command-center`; run all commands there.
- `npm test` green at the end of every task; no new dependencies.
- Keep test-asserted markers alive unless the test is updated in the same task: `"Project ID: <id>"` text, `orbit-dock-target`, `orbit-dock-pulse`, heading "Project brief", button "Save project brief".
- Color rule: cyan glow = interactive/active only; violet ambient only. No new gradients/sheens/infinite animations.
- Nothing deleted — features may move behind expanders but stay reachable.
- Commit after every task.

---

### Task 1: Collapsible Project Brief

**Files:**
- Modify: `src/features/projects/project-brief-panel.tsx`
- Create: `src/features/projects/project-brief-panel.test.tsx`

**Interfaces:**
- Consumes: existing `ProjectBriefValues`, `Field`.
- Produces: same `ProjectBriefPanel({ brief, isLoading?, isSaving?, onSave })` export. Collapsed by default; `<summary>` shows a two-line digest; the form lives inside the `<details>`.

- [ ] **Step 1: Write the failing test**

Create `src/features/projects/project-brief-panel.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { Database } from "../../lib/supabase/database.types";
import { ProjectBriefPanel } from "./project-brief-panel";

type ProjectBrief = Database["public"]["Tables"]["project_briefs"]["Row"];

function brief(overrides: Partial<ProjectBrief> = {}): ProjectBrief {
  return {
    id: "brief-1",
    workspace_id: "workspace-1",
    project_id: "project-1",
    goal: "Ship the onboarding revamp",
    audience: "New users",
    success_criteria: "Activation up 10%",
    constraints: "",
    status_summary: "On track",
    next_milestone: "Beta on Friday",
    links: [],
    created_by: "user-1",
    created_at: "2026-07-01T00:00:00.000Z",
    updated_at: "2026-07-01T00:00:00.000Z",
    ...overrides,
  } as ProjectBrief;
}

describe("ProjectBriefPanel", () => {
  it("is collapsed by default with a two-line digest", () => {
    render(<ProjectBriefPanel brief={brief()} onSave={() => undefined} />);

    const details = screen.getByText("Project brief").closest("details");
    expect(details).not.toHaveAttribute("open");
    expect(screen.getByText("Ship the onboarding revamp")).toBeTruthy();
    expect(screen.getByText(/Beta on Friday/)).toBeTruthy();
  });

  it("invites a first brief when empty", () => {
    render(<ProjectBriefPanel brief={null} onSave={() => undefined} />);

    expect(screen.getByText("Add a goal, audience, and success criteria.")).toBeTruthy();
  });

  it("expands to the editable form", async () => {
    const user = userEvent.setup();
    render(<ProjectBriefPanel brief={brief()} onSave={() => undefined} />);

    await user.click(screen.getByText("Project brief"));

    expect(screen.getByText("Project brief").closest("details")).toHaveAttribute("open");
    expect(screen.getByLabelText("Project goal")).toHaveValue("Ship the onboarding revamp");
    expect(screen.getByRole("button", { name: "Save project brief" })).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/projects/project-brief-panel.test.tsx`
Expected: FAIL — no `<details>` ancestor.

- [ ] **Step 3: Restructure the component**

In `src/features/projects/project-brief-panel.tsx`, replace the returned JSX (the whole `return (...)`) with:

```tsx
  const digest = values.goal.trim()
    ? values.goal.trim()
    : "Add a goal, audience, and success criteria.";
  const milestone = values.nextMilestone.trim();

  return (
    <details className="surface-whisper rounded-xl p-4">
      <summary className="flex cursor-pointer items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-cyan-300/25 bg-cyan-300/10 text-cyan-100">
          <FileText size={17} aria-hidden="true" />
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-white">Project brief</span>
          <span className="mt-0.5 block truncate text-sm text-slate-400">{digest}</span>
          {milestone ? (
            <span className="mt-0.5 block truncate text-xs text-slate-500">Next milestone: {milestone}</span>
          ) : null}
        </span>
      </summary>

      <form className="mt-4 grid gap-4 border-t border-slate-400/10 pt-4" onSubmit={handleSubmit}>
        {/* keep the existing six Field blocks and the save button exactly as they are today */}
      </form>
    </details>
  );
```

The comment above is shorthand for this plan only — in the real file, keep the existing `<Field label="Project goal">…` through `Save project brief` button markup unchanged inside the new `<form>` wrapper.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/features/projects/project-brief-panel.test.tsx src/features/projects/project-workspace-page.test.tsx`
Expected: PASS. (The workspace-page tests interact with the Save button; jsdom exposes closed-`<details>` content, so they keep working. If any interaction fails on the collapsed state, add `await user.click(screen.getByText("Project brief"));` before it.)

- [ ] **Step 5: Commit**

```bash
git add src/features/projects/project-brief-panel.tsx src/features/projects/project-brief-panel.test.tsx
git commit -m "Collapse project brief to an expandable digest"
```

---

### Task 2: Workspace header + quiet tabs

**Files:**
- Modify: `src/features/projects/project-workspace-page.tsx:443-499`

**Interfaces:**
- Consumes: nothing new.
- Produces: one-row header; tab styling aligned with MissionLog's underline tabs. The literal text `Project ID: {projectId}` stays (tests assert it).

- [ ] **Step 1: Consolidate the header to one row**

Replace:

```tsx
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="mission-label">Orbital task flow</p>
          <h1 className="mt-2 text-3xl font-black text-white">Mission workspace</h1>
          <p className="mt-2 break-all text-sm text-slate-400">Project ID: {projectId}</p>
        </div>
        <button
          className="orbit-button"
          onClick={openCreateModal}
          type="button"
        >
          <Plus size={16} />
          Launch task
        </button>
      </div>
```

with:

```tsx
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-3xl font-bold text-white">Mission workspace</h1>
          <p className="mt-1 break-all text-xs text-slate-500">Project ID: {projectId}</p>
        </div>
        <button
          className="orbit-button shrink-0"
          onClick={openCreateModal}
          type="button"
        >
          <Plus size={16} />
          Launch task
        </button>
      </div>
```

- [ ] **Step 2: Quiet the tab row**

Replace the tab button className logic:

```tsx
            className={
              activeTab === tab
                ? "border-b-2 border-cyan-300 px-3 py-2 text-sm font-semibold text-white"
                : "px-3 py-2 text-sm font-medium text-slate-400 hover:text-slate-100"
            }
```

with:

```tsx
            className={
              activeTab === tab
                ? "-mb-px border-b-2 border-cyan-300 px-3 py-2 text-sm font-medium text-white"
                : "-mb-px border-b-2 border-transparent px-3 py-2 text-sm font-medium text-slate-400 hover:text-slate-200"
            }
```

- [ ] **Step 3: Verify**

Run: `npx vitest run src/features/projects/project-workspace-page.test.tsx`
Expected: PASS (the `Project ID:` text and headings are unchanged).

- [ ] **Step 4: Commit**

```bash
git add src/features/projects/project-workspace-page.tsx
git commit -m "Consolidate workspace header and quiet the tabs"
```

---

### Task 3: Quiet kanban cards

**Files:**
- Modify: `src/features/work-items/kanban-board.tsx:50-76`

**Interfaces:**
- Consumes/produces: unchanged `KanbanBoard` props. Visual only.

- [ ] **Step 1: Remove per-column and per-card decoration**

In `src/features/work-items/kanban-board.tsx`:

**(a)** Delete the decorative column circle:

```tsx
            <span
              aria-hidden="true"
              className="absolute -right-12 top-8 h-24 w-24 rounded-full border border-cyan-300/10"
            />
```

**(b)** Replace the card article opener and delete its gradient accent bar:

```tsx
              <article className="orbit-task-card relative grid gap-3 rounded-md border border-slate-400/15 bg-slate-950/70 p-3" key={item.id}>
                <span
                  aria-hidden="true"
                  className="absolute left-0 top-3 h-8 w-0.5 rounded-full bg-gradient-to-b from-cyan-300 to-violet-400"
                />
```

with:

```tsx
              <article className="orbit-task-card relative grid gap-3 rounded-md border border-slate-400/10 bg-slate-950/45 p-3" key={item.id}>
```

**(c)** Quiet the column count badge — replace:

```tsx
              <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-2 py-0.5 text-xs font-semibold text-cyan-100">
                {columnItems.length}
              </span>
```

with:

```tsx
              <span className="rounded-full border border-slate-400/15 px-2 py-0.5 text-xs font-semibold text-slate-300">
                {columnItems.length}
              </span>
```

- [ ] **Step 2: Verify**

Run: `npx vitest run src/features/work-items/kanban-board.test.tsx src/features/projects/project-workspace-page.test.tsx`
Expected: PASS (no test asserts the removed decoration).

- [ ] **Step 3: Commit**

```bash
git add src/features/work-items/kanban-board.tsx
git commit -m "Flatten kanban cards to quiet surfaces"
```

---

### Task 4: Inbox triage stack

**Files:**
- Modify: `src/features/inbox/inbox-page.tsx:186-267` (header + layout shell; the detail panel and triage forms move unchanged)
- Modify: `src/features/inbox/inbox-page.test.tsx` (only if a changed marker breaks; `orbit-dock-target` / `orbit-dock-pulse` are kept)

**Interfaces:**
- Consumes: existing state/mutations unchanged.
- Produces: centered single-column layout — slim header, selected capture card on `orbit-panel` first, queue as a compact `surface-whisper` list below it.

- [ ] **Step 1: Slim the header**

Replace the hero panel:

```tsx
      <div className="orbit-panel overflow-hidden rounded-lg p-5 sm:p-6">
        <p className="mission-label">Universal Inbox</p>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-black text-white sm:text-4xl">Process incoming signals.</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
              Convert quick captures into tasks or notes, assign them to projects, or archive what no longer needs action.
            </p>
          </div>
          <span className="w-fit rounded-full border border-cyan-300/25 bg-cyan-300/10 px-4 py-2 text-xs font-semibold text-cyan-100">
            {captures.length} open
          </span>
        </div>
      </div>
```

with:

```tsx
      <header className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-white">Inbox</h1>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            Process one signal at a time — convert, assign, or archive.
          </p>
        </div>
        <span className="w-fit shrink-0 rounded-full border border-cyan-300/25 bg-cyan-300/10 px-3 py-1.5 text-xs font-semibold text-cyan-100">
          {captures.length} open
        </span>
      </header>
```

- [ ] **Step 2: Reflow to a centered stack**

**(a)** Change the page root from `<section className="grid gap-5">` to:

```tsx
    <section className="orbit-page-enter mx-auto grid w-full max-w-[44rem] gap-5">
```

**(b)** Replace the two-column shell. Change:

```tsx
        <div className="grid gap-4 lg:grid-cols-[minmax(14rem,20rem)_minmax(0,1fr)]">
```

to:

```tsx
        <div className="grid gap-4">
```

**(c)** Move the selected-capture panel ABOVE the queue: cut the entire `{selectedCapture ? ( <div className="orbit-panel orbit-dock-pulse ...> ... ) : null}` block and paste it as the FIRST child of that grid (before the queue `<div className="orbit-panel rounded-lg p-3">`). Do not change anything inside the block.

**(d)** Compact the queue into a whisper list — replace its wrapper and item styling:

```tsx
          <div className="orbit-panel rounded-lg p-3">
            <div className="relative flex items-center justify-between gap-3 px-1 pb-3">
              <p className="mission-label">Queue</p>
```

with:

```tsx
          <div className="surface-whisper rounded-xl p-3">
            <div className="relative flex items-center justify-between gap-3 px-1 pb-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Up next</p>
```

and in each queue button, drop the boxed icon: delete

```tsx
                        <span className="mt-1 grid h-6 w-6 shrink-0 place-items-center rounded-md border border-cyan-300/20 bg-cyan-300/10 text-cyan-100">
                          <Inbox size={14} aria-hidden="true" />
                        </span>
```

and change the unselected button classes from `border-slate-400/15 bg-slate-950/20 hover:border-cyan-300/35 hover:bg-slate-900/60` to `border-transparent bg-transparent hover:border-cyan-300/25 hover:bg-slate-900/50`. Keep the selected classes (`orbit-dock-target border-cyan-300/45 bg-cyan-300/10`) exactly — the test asserts `orbit-dock-target`.

- [ ] **Step 3: Verify**

Run: `npx vitest run src/features/inbox/inbox-page.test.tsx`
Expected: PASS. If a test asserts the removed hero copy ("Process incoming signals."), update it to `screen.getByRole("heading", { name: "Inbox" })`. If the `Inbox` lucide import becomes unused, remove it from the import line.

- [ ] **Step 4: Commit**

```bash
git add src/features/inbox/inbox-page.tsx src/features/inbox/inbox-page.test.tsx
git commit -m "Reflow inbox into a centered triage stack"
```

---

### Task 5: Verification pass

- [ ] **Step 1:** `npm test` — expect all green (~248+).
- [ ] **Step 2:** `npm run build` — expect exit 0.
- [ ] **Step 3:** Screenshot `/inbox` and `/projects/<any-id>` with the fake-session Playwright approach used in Phase 1–2 (empty-state variants are fine — the layout and surfaces are what's being checked). Confirm: inbox is a centered stack; workspace header is one row; brief is a collapsed digest; kanban columns have no decorative circles/gradient bars.
- [ ] **Step 4:** Commit any polish as `Polish workspace and inbox after visual verification`.

## Self-Review (completed)

- **Spec coverage:** brief collapse ✔ (T1), one-row header ✔ (T2), quiet underline tabs ✔ (T2), flat quiet cards with hover lift ✔ (T3 — hover lift already lives on `.orbit-task-card` in styles.css), inbox stack ✔ (T4).
- **Placeholders:** Step 3 of Task 1 contains one explicit "keep existing markup" instruction with exact boundaries — acceptable since the markup is unchanged and present in the file.
- **Type consistency:** no new types; all props unchanged.
