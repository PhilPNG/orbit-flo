# Trello-Style Task Details Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Comments, per-project labels, checklists, and file attachments on work items, presented in a Trello-style card modal with board badges.

**Architecture:** One migration adds four tables + a private storage bucket. One query module (`work-item-details.queries.ts`) owns all CRUD plus a bundled `getWorkItemMeta` for board badges. `WorkItemCardModal` replaces the detail drawer (same `WorkItemDetailValues` save contract, so the workspace's existing update mutation is reused unchanged). `KanbanBoard` gains an optional `meta` prop for badges.

**Tech Stack:** Supabase (Postgres RLS + Storage), React 19, @tanstack/react-query, vitest.

**Spec:** `docs/superpowers/specs/2026-07-09-task-details-design.md` — layout, copy, and policy details there are normative.

## Global Constraints

- Worktree `C:\src\Personal\ToDo\.worktrees\project-command-center`, branch `codex/project-command-center`.
- Label colors exactly: `cyan, blue, violet, emerald, amber, rose`. Attachment path: `{workspace_id}/{work_item_id}/{uuid}-{sanitized_file_name}`; 10 MB client cap; signed URLs 60s.
- Section mutations act immediately; core fields keep the explicit "Save task" button emitting the existing `WorkItemDetailValues`.
- No new npm dependencies. Suite green per task (`--maxWorkers=2` under load; timeouts already widened). Commit per task.
- Migration is applied by the USER in the Supabase SQL editor — never attempt to run it against the live DB.

---

### Task 1: Migration + types

**Files:**
- Create: `supabase/migrations/202607090001_work_item_details.sql`
- Modify: `src/lib/supabase/database.types.ts`

- [ ] **Step 1:** Write the migration implementing spec §Data layer exactly: four tables (`work_item_comments`, `labels` with `unique (id, workspace_id)` and `unique (project_id, name)`, `work_item_labels`, `work_item_checklist_items`), the `attachments` bucket insert, `storage.objects` policies (select/insert/delete for authenticated where `bucket_id = 'attachments' and (storage.foldername(name))[1] in (select workspace_id::text from public.workspace_members where user_id = auth.uid())`), `work_item_attachments`, `set_updated_at` triggers on comments/labels/checklist, RLS policies per spec (member select/insert everywhere; comments+attachments delete restricted to `created_by = auth.uid()`; labels/checklist member update/delete; work_item_labels member delete).
- [ ] **Step 2:** Extend `database.types.ts` with Row/Insert/Update blocks for the four tables (house style: required fields in Insert only where the DB has no default; label `color: LabelColor` typed as a new exported `export type LabelColor = "cyan" | "blue" | "violet" | "emerald" | "amber" | "rose";` near `WorkItemStatus`).
- [ ] **Step 3:** `npm run build` → PASS. Commit `Add work item details migration and types`.

---

### Task 2: Query module (TDD)

**Files:**
- Create: `src/features/work-items/work-item-details.queries.ts`
- Create: `src/features/work-items/work-item-details.test.ts`

**Interfaces (produces — exact):**

```ts
export type WorkItemComment = Tables["work_item_comments"]["Row"];
export type Label = Tables["labels"]["Row"];
export type ChecklistItem = Tables["work_item_checklist_items"]["Row"];
export type Attachment = Tables["work_item_attachments"]["Row"];
export type WorkItemMeta = {
  labelsByItem: Map<string, Label[]>;
  checklistByItem: Map<string, { done: number; total: number }>;
  commentCountByItem: Map<string, number>;
  attachmentCountByItem: Map<string, number>;
};
export const labelColorClasses: Record<LabelColor, string>; // pill classes: e.g. cyan → "border-cyan-300/30 bg-cyan-300/15 text-cyan-100", blue/violet/emerald/amber/rose analogous
export const labelBarClasses: Record<LabelColor, string>;   // badge bars: cyan → "bg-cyan-300", etc.
export const workItemDetailsKeys = {
  meta: (workspaceId: string, projectId: string) => [...],
  details: (workspaceId: string, workItemId: string) => [...],
  labels: (workspaceId: string, projectId: string) => [...],
};
// functions exactly as listed in spec §Query module, incl.
export async function uploadAttachment(client, input: { workspaceId; workItemId; userId; file: File }): Promise<Attachment>
export async function deleteAttachment(client, input: { id; workspaceId; storagePath }): Promise<void>
export async function getAttachmentUrl(client, storagePath: string): Promise<string>
export async function getWorkItemMeta(client, input: { workspaceId: string; workItemIds: string[] }): Promise<WorkItemMeta>
export function sanitizeFileName(name: string): string  // lowercase, spaces→-, strip all but [a-z0-9._-]
```

`uploadAttachment`: throw `new Error("Attachments are limited to 10 MB.")` when `file.size > 10 * 1024 * 1024`; path = `` `${workspaceId}/${workItemId}/${crypto.randomUUID()}-${sanitizeFileName(file.name)}` ``; `client.storage.from("attachments").upload(path, file)` then row insert. `deleteAttachment`: `storage.remove([storagePath])` then row delete. `getAttachmentUrl`: `createSignedUrl(storagePath, 60)` returning `data.signedUrl`. `getWorkItemMeta`: return empty maps when `workItemIds.length === 0`; otherwise four selects `.in("work_item_id", workItemIds)` — labels via `work_item_labels` with `select("work_item_id, labels(*)")` join — counted/grouped client-side.

- [ ] **Step 1:** Test file using the thenable chain-mock pattern from `board-columns.test.ts` (copy the `builder`/`clientWith` helpers; extend `clientWith` with a `storage` stub: `{ from: () => ({ upload: uploadMock, remove: removeMock, createSignedUrl: signedUrlMock }) }`). Cover: `sanitizeFileName("My Report (v2).PDF") === "my-report-v2.pdf"`; `uploadAttachment` rejects >10MB without calling storage; `uploadAttachment` uploads then inserts row whose `storage_path` starts with `ws/wi/`; `deleteAttachment` removes storage then row; `getWorkItemMeta` with two items groups labels and counts checklist done/total; `getWorkItemMeta([])` returns empty maps with zero client calls; `createComment`/`toggleChecklistItem` payload assertions.
- [ ] **Step 2:** FAIL (module not found). **Step 3:** Implement. **Step 4:** PASS. **Step 5:** Commit `Add work item details query module`.

---

### Task 3: WorkItemCardModal (TDD)

**Files:**
- Create: `src/features/work-items/work-item-card-modal.tsx`
- Create: `src/features/work-items/work-item-card-modal.test.tsx`
- Delete: `src/features/work-items/work-item-detail-drawer.tsx`, `src/features/work-items/work-item-detail-drawer.test.tsx` (in Task 4's wiring commit if the page still imports it; otherwise here)

**Interfaces (produces):**

```ts
export type { WorkItemDetailValues } from a local re-declaration identical to the drawer's;
export function WorkItemCardModal(props: {
  item: WorkItem;
  milestones?: Milestone[];
  isSubmitting?: boolean;
  onClose: () => void;
  onSubmit: (values: WorkItemDetailValues) => void;
}): JSX.Element;
```

The modal fetches its own detail data with `useQuery`/`useMutation` (supabase client imported directly, same as pages do), keyed by `workItemDetailsKeys.details`/`.labels`, invalidating `details`, `labels`, and `meta` keys on every section mutation. Layout, copy, and behaviors per spec §UI. Exact accessible names the tests rely on: inputs "Title", "Description", "Status", "Priority", "Deadline", "Milestone", "Blocker"; buttons "Save task", "Comment", "Attach file", "Add checklist item" (the input has label "New checklist item"), "New label name", color radios "Label color {color}", "Add label", checkbox rows named by label name, unassign pill buttons "Remove label {name}", comment delete "Delete comment", attachment "Download {file_name}" / "Delete {file_name}", checklist item checkboxes named by item title, checklist delete "Delete {title}".

- [ ] **Step 1:** Test file: mock `../../lib/supabase/client` and `./work-item-details.queries` (all functions vi.fn; list fns resolve fixtures: 1 comment, 2 checklist items (1 done), 1 attachment, 2 project labels w/ 1 assigned). Wrap render in QueryClientProvider. Cover: sections render fixture content incl. "1/2" checklist progress; typing in "New checklist item" + Enter calls `createChecklistItem` with title; clicking a checklist checkbox calls `toggleChecklistItem` with flipped `isDone`; comment composer + "Comment" button calls `createComment`; checking an unassigned label calls `assignLabel`; new-label form calls `createLabel` with chosen color; "Save task" emits full `WorkItemDetailValues`.
- [ ] **Step 2:** FAIL. **Step 3:** Implement per spec (main column + rail, guidance block carried from drawer, `InlineAlert` for mutation errors, `Modal`-less custom overlay: fixed inset-0 grid place-items-center with `surface-raised orbit-page-enter max-w-3xl max-h-[90vh] overflow-y-auto` panel and a Close button). **Step 4:** PASS. **Step 5:** Commit `Add Trello-style work item card modal`.

---

### Task 4: Board badges + workspace wiring

**Files:**
- Modify: `src/features/work-items/kanban-board.tsx` (+ its test)
- Modify: `src/features/projects/project-workspace-page.tsx` (+ its test)
- Delete: drawer files if not already removed

- [ ] **Step 1 (board, TDD):** Add optional `meta?: WorkItemMeta` prop. Card renders when meta present: label bar row (`<span className={clsx("h-1.5 w-6 rounded-full", labelBarClasses[label.color])} />` per label, max 6, container `aria-label="Labels"`), and a chip row: checklist chip `n/m` with `CheckSquare` icon (`text-emerald-200` when n===m && m>0), `MessageSquare` count, `Paperclip` count — each chip hidden at zero, chips have `aria-label` "Checklist n of m" / "n comments" / "n attachments". Tests: meta fixture renders 2 label bars + "1/2" chip + hides zero-count chips.
- [ ] **Step 2 (wiring):** In the workspace page: `metaQuery` (`workItemDetailsKeys.meta(workspaceId, projectId)`, fn `getWorkItemMeta` with `workItems.map(i => i.id)`, `enabled` when items loaded) passed to `<KanbanBoard meta={metaQuery.data} />`; replace the `WorkItemDetailDrawer` import/render with `WorkItemCardModal` (same props); delete `SubtaskList` import/usage and the `2xl:grid-cols-[minmax(0,1fr)_18rem]` wrapper (board full width); delete `src/features/work-items/subtask-list.tsx`. Update workspace tests: mock `getWorkItemMeta` (empty maps) in the board-columns mock module file addition, drawer-based assertions now target the modal (same field labels, so most survive).
- [ ] **Step 3:** `npx vitest run src/features/work-items src/features/projects` PASS; `npm run build` PASS. Commit `Wire task card modal and board badges`.

---

### Task 5: Verification

- [ ] `npx vitest run --maxWorkers=2` all green; `npm run build` clean; push branch (PR #12). Remind the user to run BOTH pending migrations (`202607080001`, `202607090001`) in the SQL editor. Visual check: board badges + modal need live DB; verified via component tests + a Today/auth screenshot sanity pass only if time allows.

## Self-Review (completed)

Spec coverage: migration/types T1; queries incl. meta + storage T2; modal T3; badges/wiring/stub-removal T4; user-applied migration + push T5. Type consistency: `WorkItemMeta`, key factory, and `labelBarClasses` names match between T2 definitions and T3/T4 consumers; modal keeps the drawer's `WorkItemDetailValues` contract so `updateDetailsMutation` is untouched. No placeholders — component internals are specified by exact accessible names + spec layout, with test contracts fully enumerated.
