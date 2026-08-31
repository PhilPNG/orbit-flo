# Trello-Style Task Details

**Date:** 2026-07-09 · **Branch:** `codex/project-command-center` · **Status:** Approved

## Problem

Work items hold only flat fields (title, description, status, priority, due date, milestone, blocker). No comments, labels, checklists, or attachments; the detail surface is a cramped edit-form drawer; board cards show nothing about a task's inner state.

## Data layer — migration `supabase/migrations/202607090001_work_item_details.sql`

All tables follow the house pattern: `workspace_id` FK → workspaces cascade, composite FK `(work_item_id, workspace_id)` → `work_items(id, workspace_id)` cascade, `created_by` default `auth.uid()` FK → workspace_members composite, `set_updated_at` triggers where `updated_at` exists, RLS with member checks.

1. **`work_item_comments`**: `id`, `workspace_id`, `work_item_id`, `body text check (char_length(body) between 1 and 4000)`, `created_by`, `created_at`, `updated_at`. Policies: members select/insert; delete only `created_by = auth.uid()`.
2. **`labels`**: `id`, `workspace_id`, `project_id` (+composite FK → projects), `name text check (char_length(name) between 1 and 40)`, `color text not null check (color in ('cyan','blue','violet','emerald','amber','rose'))`, `created_by`, timestamps, `unique (project_id, name)`. Policies: members select/insert/update/delete.
3. **`work_item_labels`**: `work_item_id`, `label_id`, `workspace_id`, `primary key (work_item_id, label_id)`, composite FKs to work_items and labels (`(label_id, workspace_id)` → `labels(id, workspace_id)` — labels gets `unique (id, workspace_id)`), all cascade. Policies: members select/insert/delete.
4. **`work_item_checklist_items`**: `id`, `workspace_id`, `work_item_id`, `title text check (char_length(title) between 1 and 200)`, `is_done boolean default false`, `sort_order integer default 0`, `created_by`, timestamps. Policies: members select/insert/update/delete.
5. **Storage**: `insert into storage.buckets (id, name, public) values ('attachments', 'attachments', false) on conflict (id) do nothing;` plus `storage.objects` policies (select/insert/delete for authenticated users where `bucket_id = 'attachments'` and `(storage.foldername(name))[1]` is a workspace the user belongs to).
6. **`work_item_attachments`**: `id`, `workspace_id`, `work_item_id`, `file_name text`, `storage_path text unique`, `mime_type text`, `size_bytes bigint`, `created_by`, `created_at`. Policies: members select/insert; delete only uploader.

Storage path convention: `{workspace_id}/{work_item_id}/{uuid}-{sanitized_file_name}`. Client-side upload cap: 10 MB. Download via `createSignedUrl(path, 60)`. Deleting an attachment removes the storage object first, then the row.

`database.types.ts` extended by hand for all four tables + no work_items changes.

## Query module — `src/features/work-items/work-item-details.queries.ts`

```
workItemDetailsKeys = {
  meta: (workspaceId, projectId) => ["work-item-meta", workspaceId, projectId],
  details: (workspaceId, workItemId) => ["work-item-details", workspaceId, workItemId],
  labels: (workspaceId, projectId) => ["project-labels", workspaceId, projectId],
}
listComments(client, { workspaceId, workItemId })            // by created_at asc
createComment(client, { workspaceId, workItemId, userId, body })
deleteComment(client, { id, workspaceId })
listProjectLabels(client, { workspaceId, projectId })        // by name asc
createLabel(client, { workspaceId, projectId, userId, name, color })
deleteLabel(client, { id, workspaceId })
assignLabel(client, { workspaceId, workItemId, labelId })
unassignLabel(client, { workspaceId, workItemId, labelId })
listChecklistItems(client, { workspaceId, workItemId })      // sort_order asc, created_at asc
createChecklistItem(client, { workspaceId, workItemId, userId, title, sortOrder })
toggleChecklistItem(client, { id, workspaceId, isDone })
deleteChecklistItem(client, { id, workspaceId })
listAttachments(client, { workspaceId, workItemId })
uploadAttachment(client, { workspaceId, workItemId, userId, file })   // storage upload + row insert
deleteAttachment(client, { id, workspaceId, storagePath })            // storage remove + row delete
getAttachmentUrl(client, storagePath)                                  // signed URL, 60s
getWorkItemMeta(client, { workspaceId, workItemIds })
  // → { labelsByItem: Map<itemId, Label[]>, checklistByItem: Map<itemId, {done,total}>,
  //     commentCountByItem: Map<itemId, number>, attachmentCountByItem: Map<itemId, number> }
  // four .in("work_item_id", ids) selects, counted client-side
```

`LabelColor = "cyan" | "blue" | "violet" | "emerald" | "amber" | "rose"` exported with a `labelColorClasses` map (pill background/border/text classes per color, on-palette).

## UI

### `WorkItemCardModal` (new `src/features/work-items/work-item-card-modal.tsx`; `work-item-detail-drawer.tsx` deleted)

Large centered modal on the fixed overlay (`surface-raised orbit-page-enter`, `max-w-3xl`, scrollable), grid `md:grid-cols-[minmax(0,1fr)_15rem]`:

- **Main column**: title input; label pill row (colored pills, click × on pill to unassign); description textarea; **Checklist** — header with progress bar + "n/m" (emerald at 100%), items with checkbox + hover delete, add-item input (Enter); **Attachments** — "Attach file" button (hidden input), rows: file name, human size, Download (signed URL opened in new tab), delete (uploader only visually — server enforces); **Comments** — list (author "You", relative-ish date, delete button), composer textarea + Comment button.
- **Side rail**: Status, Priority, Deadline, Milestone, Blocker fields (existing behavior, explicit **Save task** button, same `WorkItemDetailValues` contract so the workspace mutation is unchanged) plus **Labels** manager: each project label as checkbox row (colored dot + name), "New label" inline form (name input + 6 color swatch radio buttons + Add).
- Section mutations (comments/checklist/labels/attachments) fire immediately and invalidate `details`/`meta`/`labels` keys. Errors via `InlineAlert`.
- The old drawer's "Context snapshot / Next action" guidance block is carried over at the top of the rail.

### Board badges (`kanban-board.tsx`)

New optional prop `meta?: WorkItemMeta` (the `getWorkItemMeta` result). Card renders, when present: a row of small label bars (h-1.5 rounded, one per label, max 6), and a chip row — `CheckSquare n/m` (emerald when complete), `MessageSquare n`, `Paperclip n` (chips hidden at zero). Existing priority/due/completed pills unchanged.

### Workspace wiring (`project-workspace-page.tsx`)

- `metaQuery` on `workItemDetailsKeys.meta`, `queryFn: getWorkItemMeta` with the loaded item ids, enabled when items exist; passed to `KanbanBoard`.
- Selected item renders `WorkItemCardModal` (replacing the drawer import) with the same `updateDetailsMutation`.
- **`SubtaskList` stub deleted** (component + usage + its placeholder copy); the board takes full width (drop the `2xl:grid-cols-[minmax(0,1fr)_18rem]` split).

## Testing

- `work-item-details.test.ts`: comment create/delete args; label assign/unassign; checklist toggle payload; `getWorkItemMeta` bundles counts and label lists; uploadAttachment inserts row with sanitized path (storage client mocked).
- `work-item-card-modal.test.tsx`: renders sections; add checklist item; toggle; add comment; assign label via checkbox; create label; save core fields emits `WorkItemDetailValues`.
- `kanban-board.test.tsx`: badges render from meta (label bars count, checklist chip text, hidden-at-zero).
- `project-workspace-page.test.tsx`: modal opens on card click (drawer assertions updated), meta mocked.
- Migration applied by the user (SQL editor) — same flow as board columns; until applied, detail sections surface their query errors via InlineAlert while core editing keeps working.

## Non-goals

Assignees/watchers, activity log, comment editing, multiple checklists, attachment previews/thumbnails, drag-reorder of checklist items.
