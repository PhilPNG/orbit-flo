# Workspace & Nav Improvements

**Date:** 2026-07-12 · **Branch:** `codex/project-command-center` · **Status:** Approved

## 1. Staged task creation (`work-item-form.tsx`, `project-workspace-page.tsx`)

`WorkItemFormValues` grows:

```ts
export interface WorkItemFormValues {
  title: string;
  description: string;
  dueDate: string;
  status: WorkItemStatus;
  priority: ProjectPriority;
  labelIds: string[];        // NEW
  checklistItems: string[];  // NEW
  files: File[];             // NEW
}
```

`WorkItemForm` gains a `labels: Label[]` prop (project labels; passed by the workspace page from `listProjectLabels` via the existing `workItemDetailsKeys.labels` query) and three staged sections:
- **Labels**: checkbox row per project label with its color dot (`labelBarClasses`); toggles `labelIds`.
- **Checklist**: input "New checklist item" (Enter adds), staged rows with remove ×.
- **Attachments**: "Attach files" button → hidden `<input type="file" multiple>`; staged rows (name, size, remove ×); reject files >10 MB with an inline message (reuse the 10 MB constant semantics).

Workspace `createWorkItemMutation` becomes: `createWorkItem` → `Promise.all` of `assignLabel` per labelId + sequential `createChecklistItem` (sortOrder = index) + sequential `uploadAttachment` per file → invalidate work-items, meta, and due-calendar keys. Comments are not part of creation.

## 2. Brainstorm in primary nav (`app-shell.tsx`)

Primary: Today, Missions, Maps, Calendar, Inbox, **Brainstorm** (Brain icon). Secondary bottom group: Settings only. `App.test.tsx` nav assertions unchanged (labels all still present).

## 3. Collapsible sidebar (`app-shell.tsx`)

- Toggle button at the top of the aside (`aria-label="Collapse navigation"` / `"Expand navigation"`, icons `PanelLeftClose`/`PanelLeftOpen`).
- Collapsed (desktop `lg:` only): grid becomes `lg:grid-cols-[4.25rem_minmax(0,1fr)]`; nav links render icon-only (label span hidden, `title={item.label}` on the link); logo area shows an `Orbit` icon instead of the lockup; `GlobalQuickAdd` and the command-palette button hidden (Ctrl+K unaffected).
- Persisted in localStorage key `orbitflo:nav-collapsed` (`"1"`/absent), read on mount (module `src/components/nav-collapse.ts` with `loadNavCollapsed(): boolean` / `saveNavCollapsed(value: boolean)` following `daily-home-layout.ts`).
- Mobile/tablet layout (stacked grid nav) ignores the collapsed state.

## 4. Workspace panels (`project-rituals-templates.tsx` split + migration)

### Dismissible panels
- The combined `ProjectRitualsTemplates` splits into `TemplatesPanel` and `ProjectRitualsPanel` (new file `project-rituals-panel.tsx`); the workspace renders them in the same two-column section.
- Each header gains an × (`aria-label="Hide templates"` / `"Hide rituals"`). Hidden state per project in localStorage key `orbitflo:workspace-panels:{projectId}` → `{ templates: boolean; rituals: boolean }` (helper `workspace-panels.ts` with load/save like `daily-home-layout.ts`).
- When at least one is hidden, a slim chip row renders in the section: buttons "Show templates" / "Show rituals".

### Customizable rituals — migration `supabase/migrations/202607120001_project_rituals.sql`
- Table `project_rituals`: `id`, `workspace_id`, `project_id` (+composite FK → projects), `title text check (1..120)`, `is_done boolean default false`, `sort_order integer default 0`, `created_by`, timestamps, house RLS (members select/insert/update/delete), `set_updated_at` trigger, index `(workspace_id, project_id, sort_order)`.
- `projects` gains `rituals_title text` (nullable; UI falls back to "Operating cadence").
- `database.types.ts` extended accordingly (`projects.rituals_title` added to Row/Insert/Update).

### Queries — `src/features/projects/project-rituals.queries.ts`
```
projectRitualsKeys.list(workspaceId, projectId)
listProjectRituals(client, { workspaceId, projectId })
ensureDefaultProjectRituals(client, { workspaceId, projectId, userId })
  // seeds: Weekly review ritual / Backlog cleanup ritual / Milestone check ritual / Release prep ritual
createProjectRitual(client, { workspaceId, projectId, userId, title, sortOrder })
renameProjectRitual(client, { id, workspaceId, title })
toggleProjectRitual(client, { id, workspaceId, isDone })
deleteProjectRitual(client, { id, workspaceId })
updateProjectRitualsTitle(client, { workspaceId, projectId, ritualsTitle })  // updates projects.rituals_title
```

### Panel behavior
- Section title: click → inline input (Enter/blur saves via `updateProjectRitualsTitle`; `aria-label="Rituals section title"`); renders `ritualsTitle ?? "Operating cadence"`. The workspace page fetches the single project row via a new `getProject(client, workspaceId, projectId)` in `projects.queries.ts` (query key `["project", workspaceId, projectId]`) and passes `ritualsTitle={project?.rituals_title ?? null}` plus an `onRenameTitle` callback into the panel.
- Items: checkbox (persisted toggle), click item text → inline edit input (`aria-label="Ritual title"`), hover × delete (`aria-label="Delete {title}"`), add input `aria-label="New ritual"` (Enter). Progress line "n/m rituals checked" kept.
- Templates panel keeps existing content/behavior (only gains the × and the split).

## Testing

- `work-item-form.test.tsx`: staged sections render; submit payload includes labelIds/checklistItems/files.
- `project-workspace-page.test.tsx`: create flow calls assign/create/upload helpers after createWorkItem (mocks), panel dismiss/restore.
- `app-shell` via `App.test.tsx`: collapse toggle hides labels + persists; Brainstorm in primary group (assertion positions don't matter — labels only).
- `project-rituals.queries.test.ts` (seeding, toggle payload) and `project-rituals-panel.test.tsx` (rename title, edit item, add, delete).
- Migration applied by the user in the SQL editor; until then the rituals panel shows its query error via InlineAlert.

## Non-goals

Comments at creation; drag-reorder of ritual items; per-device sync of panel-dismiss/nav-collapse prefs (localStorage is intentional, matching Daily home layout).
