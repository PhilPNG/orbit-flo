# Workspace & Nav Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Staged task creation (labels/checklist/attachments), Brainstorm in primary nav, collapsible sidebar rail, dismissible workspace panels, and database-backed customizable project rituals.

**Architecture:** One small migration (`project_rituals` + `projects.rituals_title`). New query module `project-rituals.queries.ts` (get-or-seed pattern). `ProjectRitualsTemplates` splits into `TemplatesPanel` + `ProjectRitualsPanel`, both dismissible via a localStorage helper. `WorkItemForm` stages extras; the workspace create mutation chains the detail helpers after insert. App shell handles the nav regroup + collapse with a localStorage helper.

**Tech Stack:** Supabase, React 19, @tanstack/react-query, vitest.

**Spec (normative for copy/labels/behavior):** `docs/superpowers/specs/2026-07-12-workspace-nav-improvements-design.md`

## Global Constraints

- Worktree `C:\src\Personal\ToDo\.worktrees\project-command-center`, branch `codex/project-command-center`.
- localStorage keys exactly: `orbitflo:nav-collapsed`, `orbitflo:workspace-panels:{projectId}`.
- Ritual seeds exactly: "Weekly review ritual", "Backlog cleanup ritual", "Milestone check ritual", "Release prep ritual".
- Migration applied by the USER (SQL editor); never run against live DB. No new npm deps. Suite green per task. Commit per task.

---

### Task 1: Migration + types + `getProject`

**Files:** Create `supabase/migrations/202607120001_project_rituals.sql`; modify `src/lib/supabase/database.types.ts`, `src/features/projects/projects.queries.ts`.

- [ ] Migration: `project_rituals` table per spec §4 (house pattern: composite FK `(project_id, workspace_id)` → projects, `created_by` → workspace_members composite, `set_updated_at` trigger, index `(workspace_id, project_id, sort_order)`, RLS member select/insert/update/delete — mirror the `work_item_checklist_items` policies from `202607090001`); plus `alter table public.projects add column if not exists rituals_title text;`.
- [ ] Types: add `project_rituals` block (Row/Insert/Update, house style) and `rituals_title: string | null` to `projects` Row (+ optional in Insert/Update).
- [ ] `projects.queries.ts`: append

```ts
export async function getProject(client: Client, workspaceId: string, projectId: string) {
  const { data, error } = await client
    .from("projects")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("id", projectId)
    .single();

  if (error) throw error;
  return data;
}
```

- [ ] `npm run build` PASS (fix any fixture fallout: project factories in tests gain `rituals_title: null` if the Row requires it — make it required in Row, so update `projects.test.ts`/`projects-page` fixtures via the same insert-after-line codemod approach used for `column_id`, matching on `repository_url` or the projects factory's last required field; verify with build). Commit `Add project rituals migration and types`.

---

### Task 2: `project-rituals.queries.ts` (TDD)

**Files:** Create `src/features/projects/project-rituals.queries.ts` + `src/features/projects/project-rituals.test.ts`.

**Interfaces (produces):** exactly the spec §4 list; `ProjectRitual = Tables["project_rituals"]["Row"]`; `defaultProjectRituals: readonly string[]`; `projectRitualsKeys.list(workspaceId, projectId)`.

- [ ] Tests (thenable chain-mock pattern from `board-columns.test.ts`): `ensureDefaultProjectRituals` returns existing without insert / seeds the four defaults with sort_order 0–3; `toggleProjectRitual` update payload `{ is_done }`; `updateProjectRitualsTitle` targets `projects` table with `{ rituals_title }`.
- [ ] FAIL → implement (each fn mirrors board-columns style; `updateProjectRitualsTitle` = `client.from("projects").update({ rituals_title }).eq("workspace_id", ...).eq("id", projectId)`) → PASS → commit `Add project rituals queries with default seeding`.

---

### Task 3: Panels — split, dismiss, customizable rituals

**Files:** Create `src/features/projects/project-rituals-panel.tsx` (+ test), `src/features/projects/workspace-panels.ts`; modify `src/features/projects/project-rituals-templates.tsx` (becomes `TemplatesPanel` only, keeps `TemplateWorkItem` export), `src/features/projects/project-workspace-page.tsx` (+ test).

**Interfaces:**

```ts
// workspace-panels.ts (pattern: daily-home-layout.ts)
export type WorkspacePanels = { templates: boolean; rituals: boolean };
export function loadWorkspacePanels(projectId: string): WorkspacePanels; // default both true
export function saveWorkspacePanels(projectId: string, panels: WorkspacePanels): void;

// ProjectRitualsPanel props
{ workspaceId: string; projectId: string; userId: string; ritualsTitle: string | null;
  onRenameTitle: (title: string) => void; onHide: () => void }
// TemplatesPanel props = old ProjectRitualsTemplates props + onHide: () => void
```

`ProjectRitualsPanel` owns its data: `useQuery(projectRitualsKeys.list, ensureDefaultProjectRituals)` + mutations (create/rename/toggle/delete) invalidating its key. Exact aria labels (spec §4): section title button → input `aria-label="Rituals section title"`; item text button → input `aria-label="Ritual title"`; delete `aria-label="Delete {title}"`; add input `aria-label="New ritual"` (Enter); hide `aria-label="Hide rituals"`. Templates ×: `aria-label="Hide templates"`.

- [ ] Panel tests: renders seeded rituals + "2/4 rituals checked" from fixture; toggling calls `toggleProjectRitual`; add via Enter calls `createProjectRitual` with sortOrder = count; rename item commits on Enter; rename section title calls `onRenameTitle`; × calls `onHide`.
- [ ] Workspace wiring: `projectQuery` (`["project", workspaceId, projectId]`, `getProject`); panels state from `loadWorkspacePanels(projectId)` in `useState` keyed by project (re-init on projectId change via `useEffect`); render section: TemplatesPanel (if shown), ProjectRitualsPanel (if shown), chip row with "Show templates"/"Show rituals" buttons when hidden; `renameRitualsTitleMutation` → `updateProjectRitualsTitle` + invalidate project key. Workspace tests: mock `getProject` + `ensureDefaultProjectRituals`; hide/show flow asserts localStorage round-trip.
- [ ] All project tests PASS → commit `Make workspace panels dismissible with custom rituals`.

---

### Task 4: Staged task creation

**Files:** Modify `src/features/work-items/work-item-form.tsx` (+ test), `src/features/projects/project-workspace-page.tsx` (+ test).

- [ ] `WorkItemFormValues` gains `labelIds: string[]`, `checklistItems: string[]`, `files: File[]`. Form gains `labels?: Label[]` prop and three sections (spec §1): label checkboxes (aria label = label name, color dot via `labelBarClasses`), checklist stager (input `aria-label="New checklist item"`, Enter adds, row remove `aria-label="Remove {title}"`), attachments stager (button "Attach files", hidden multi file input `aria-label="Attach files"`, staged row remove `aria-label="Remove {file name}"`, >10MB files rejected with inline message "Attachments are limited to 10 MB.").
- [ ] Form tests: submit includes staged `labelIds`/`checklistItems`/`files`; oversized file not staged and message shown.
- [ ] Workspace `createWorkItemMutation.mutationFn` chains after `createWorkItem`: `Promise.all(values.labelIds.map(labelId => assignLabel(...)))`, then `for` over `checklistItems` → `createChecklistItem` (sortOrder = index), then `for` over `files` → `uploadAttachment`; onSuccess additionally invalidates `workItemDetailsKeys.meta`. Pass `labels={projectLabelsQuery.data ?? []}` (new `useQuery` on `workItemDetailsKeys.labels` + `listProjectLabels`, placed with the other top-level hooks — NOT after the guard returns). Workspace test: staged create calls the three helpers in order.
- [ ] PASS + build → commit `Stage labels, checklist, and files in task creation`.

---

### Task 5: Nav — Brainstorm primary + collapsible rail

**Files:** Create `src/components/nav-collapse.ts`; modify `src/components/app-shell.tsx`, `src/app/App.test.tsx`.

- [ ] `nav-collapse.ts`: `loadNavCollapsed(): boolean` (`localStorage.getItem("orbitflo:nav-collapsed") === "1"`, try/catch false), `saveNavCollapsed(value: boolean)` (set "1" / remove).
- [ ] App shell: move Brainstorm into `primaryNavItems` (after Inbox); secondary = Settings only. Add `const [isCollapsed, setIsCollapsed] = useState(loadNavCollapsed);` + toggle button at top of aside (`aria-label` "Collapse navigation"/"Expand navigation", `PanelLeftClose`/`PanelLeftOpen`, `hidden lg:grid` so it exists only on desktop); on toggle, save. Collapsed rendering: root grid `lg:grid-cols-[4.25rem_minmax(0,1fr)]`; `ShellNavLink` gains `collapsed` prop → hides the label span (`hidden` when collapsed at lg... simplest: don't render the span; add `title={item.label}`); logo area renders `<Orbit className="h-6 w-6 text-cyan-200" aria-label="Orbit Flo" role="img" />` instead of `OrbitFloLogo`; `GlobalQuickAdd` + `CommandPalette` render only when not collapsed. Mobile grids unchanged (collapse state only alters lg column width + label visibility; since mobile nav uses the same links, only apply label-hiding when collapsed — acceptable at sm sizes because the toggle is desktop-only and state defaults false).
- [ ] `App.test.tsx`: existing assertions still pass (labels present when expanded, logo query — collapsed default false ✔). Add test: click "Collapse navigation" → link labels hidden (e.g., `queryByText("Missions")` null) and `localStorage["orbitflo:nav-collapsed"] === "1"`; click "Expand navigation" restores.
- [ ] PASS → commit `Promote Brainstorm and add collapsible nav rail`.

---

### Task 6: Verification

- [ ] `npx vitest run --maxWorkers=2` green; `npm run build` clean; fake-session screenshots: workspace (panels + × + create modal with staged sections), collapsed nav; push branch; remind user to run `202607120001_project_rituals.sql`.

## Self-Review (completed)

Spec §1→T4, §2/§3→T5, §4→T1–T3; getProject→T1. Names consistent (`projectRitualsKeys`, `WorkspacePanels`, aria labels quoted once each). No placeholders — component details bound by exact aria labels + spec.
