# Custom Kanban Columns

**Date:** 2026-07-08 · **Branch:** `codex/project-command-center` · **Status:** Approved

## Problem

Kanban columns are hard-coded to the six `work_item_status` enum values. Users can't rename, remove, add, or reorder columns.

## Design

### Data model — migration `supabase/migrations/202607080001_custom_board_columns.sql`

New table `public.board_columns` (conventions mirror `mind_maps`):

```sql
id uuid primary key default gen_random_uuid(),
workspace_id uuid not null references public.workspaces(id) on delete cascade,
project_id uuid not null,
title text not null check (char_length(title) between 1 and 60),
status_category public.work_item_status not null,
sort_order integer not null default 0,
created_by uuid not null default auth.uid() references auth.users(id) on delete cascade,
created_at timestamptz not null default now(),
updated_at timestamptz not null default now(),
unique (id, workspace_id),
foreign key (project_id, workspace_id) references public.projects(id, workspace_id) on delete cascade,
foreign key (workspace_id, created_by) references public.workspace_members(workspace_id, user_id) on delete cascade
```

- RLS enabled; policies mirror mind_maps: members select/insert/update, owners+admins delete — plus members may delete board columns (column management is a member-level action; use member check for delete too).
- Index: `(workspace_id, project_id, sort_order)`.
- `work_items` gains `column_id uuid null`, `foreign key (column_id, workspace_id) references public.board_columns(id, workspace_id) on delete set null`.
- `updated_at` trigger: `create trigger set_board_columns_updated_at before update on public.board_columns for each row execute function public.set_updated_at();` (function confirmed present in the initial migration).
- `src/lib/supabase/database.types.ts` extended by hand to match (board_columns Row/Insert/Update + work_items.column_id).

### Semantics

- **`status_category`** ties each column to a workflow state. Moving an item into a column sets BOTH `column_id` and `status = column.status_category` (with `completed_at` stamped when the category is `done`, as today). All existing status-driven logic (daily suggestions, project health, calendar `neq done`, inbox) keeps working unmodified.
- **Fallback grouping**: items with `column_id = null` (all pre-existing data; items whose column was deleted without a move target) render in the FIRST column (by sort_order) whose `status_category` equals the item's `status`. If no column matches the status, the item appears in the first column.
- **Seeding**: on board load, if the project has zero columns, the client creates the six defaults in one insert: Docked/backlog, Ready to Launch/ready, Launching/in_progress, Signal Lost/blocked, In Orbit/review, Mission Success/done (sort_order 0–5). Get-or-create pattern like `getOrCreateDailyPlan`.

### Query module — `src/features/work-items/board-columns.queries.ts`

- `listBoardColumns(client, workspaceId, projectId)` → ordered by sort_order.
- `ensureDefaultBoardColumns(client, { workspaceId, projectId, userId })` → list; if empty, bulk-insert defaults and return them.
- `createBoardColumn(client, { workspaceId, projectId, userId, title, statusCategory, sortOrder })`.
- `renameBoardColumn(client, { id, workspaceId, title })`.
- `reorderBoardColumns(client, { workspaceId, projectId, orderedIds })` → per-id sort_order updates.
- `deleteBoardColumn(client, { id, workspaceId, moveItemsTo?: { columnId, statusCategory } })` → if moveItemsTo given, bulk-update `work_items set column_id, status (+completed_at)` where `column_id = id`, then delete the column.
- `moveWorkItemToColumn(client, { id, workspaceId, projectId, columnId, statusCategory })` → updates column_id + status (+completed_at rule).

### Board UI — `kanban-board.tsx` rework (+ `project-workspace-page.tsx` wiring)

- Props become: `columns: BoardColumn[]`, `items`, `isUpdating`, `onOpenItem`, `onMoveItem(id, column)`, `onRenameColumn(id, title)`, `onDeleteColumn(column, moveItemsTo?)`, `onAddColumn(title, statusCategory)`, `onReorderColumns(orderedIds)`.
- **Rename**: clicking a column title swaps it for an inline input (Enter/blur commits, Escape cancels).
- **Remove**: an × button per column header. Empty column → delete immediately. Non-empty → inline confirm panel inside the column: "Move N tasks to:" + select of other columns + Confirm/Cancel.
- **Add**: ghost "+ Add column" tile after the last column: click → inline title input + category select (default Launching/in_progress) + create on Enter.
- **Reorder columns**: column headers are `draggable`; native HTML5 DnD; drop on another column inserts before it; calls `onReorderColumns`.
- **Card drag**: cards draggable with `dataTransfer` id; columns accept drops → `onMoveItem`. The per-card "Move to" select stays (accessible fallback) and now lists column titles.
- Workspace page: `ensureDefaultBoardColumns` query + mutations for each op, invalidating `["board-columns", workspaceId, projectId]` and work-items keys. `updateWorkItemStatus` calls replaced by `moveWorkItemToColumn` on the board path only (Tasks tab & form keep plain status).

### Status labels

`kanban-board.tsx`'s hard-coded `labels` map is only used for default column names (moved to the seeding constant) and the work-item form's status select (unchanged).

## Testing

- `board-columns.queries.test.ts` — seeding when empty, no-op when present; delete with move target updates items first; reorder writes sequential sort_order.
- `kanban-board.test.tsx` — rework to column-driven rendering: fallback grouping by category, rename flow, add flow, delete-with-move flow, column drag reorder callback, card drop calls onMoveItem.
- `project-workspace-page.test.tsx` — board renders seeded defaults (mock returns columns), move flow invalidates.
- Migration reviewed by hand; applied by the user to Supabase (`supabase db push` or SQL editor) — the app tolerates the missing table until then only behind the ensure call's error state (board shows the error EmptyState).

## Non-goals

- WIP limits, per-column colors, cross-project boards, swimlanes.
- No changes to Tasks list view, work-item form, or inbox status selects (they keep writing plain `status`; board fallback-groups those items correctly).
