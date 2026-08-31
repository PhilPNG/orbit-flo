# Custom Kanban Columns Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unlimited project-scoped kanban columns (rename/add/remove/reorder, card drag) backed by a `board_columns` table whose `status_category` keeps all status-driven logic working.

**Architecture:** New migration + hand-extended `database.types.ts`; a `board-columns.queries.ts` module (list/ensure-defaults/create/rename/reorder/delete-with-move/move-item); `kanban-board.tsx` rebuilt column-driven with native HTML5 DnD; `project-workspace-page.tsx` wires queries/mutations. Items with `column_id = null` fall back to the first column matching their `status`.

**Tech Stack:** Supabase (Postgres + RLS), React 19, @tanstack/react-query, vitest.

**Spec:** `docs/superpowers/specs/2026-07-08-custom-kanban-columns-design.md`

## Global Constraints

- Worktree `C:\src\Personal\ToDo\.worktrees\project-command-center`, branch `codex/project-command-center`.
- Moving an item to a column sets `column_id` AND `status = column.status_category`, stamping `completed_at` when category is `done`, clearing it otherwise.
- Default seed (title/category/sort): Docked/backlog/0, Ready to Launch/ready/1, Launching/in_progress/2, Signal Lost/blocked/3, In Orbit/review/4, Mission Success/done/5.
- Tasks tab, work-item form, inbox keep writing plain `status` — untouched.
- User authorized `supabase db push` (Task 5). No new npm dependencies. Commit per task.

---

### Task 1: Migration + types

**Files:**
- Create: `supabase/migrations/202607080001_custom_board_columns.sql`
- Modify: `src/lib/supabase/database.types.ts`

- [ ] **Step 1: Write the migration**:

```sql
create table if not exists public.board_columns (
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
);

create index if not exists board_columns_project_order_idx
  on public.board_columns (workspace_id, project_id, sort_order);

alter table public.work_items
  add column if not exists column_id uuid;

alter table public.work_items
  add constraint work_items_column_fk
  foreign key (column_id, workspace_id)
  references public.board_columns(id, workspace_id)
  on delete set null;

create index if not exists work_items_column_idx on public.work_items (column_id);

create trigger set_board_columns_updated_at
before update on public.board_columns
for each row execute function public.set_updated_at();

alter table public.board_columns enable row level security;

create policy "Members can view board columns"
on public.board_columns for select
using (
  exists (
    select 1 from public.workspace_members m
    where m.workspace_id = board_columns.workspace_id and m.user_id = auth.uid()
  )
);

create policy "Members can create board columns"
on public.board_columns for insert
with check (
  created_by = auth.uid()
  and exists (
    select 1 from public.workspace_members m
    where m.workspace_id = board_columns.workspace_id and m.user_id = auth.uid()
  )
);

create policy "Members can update board columns"
on public.board_columns for update
using (
  exists (
    select 1 from public.workspace_members m
    where m.workspace_id = board_columns.workspace_id and m.user_id = auth.uid()
  )
);

create policy "Members can delete board columns"
on public.board_columns for delete
using (
  exists (
    select 1 from public.workspace_members m
    where m.workspace_id = board_columns.workspace_id and m.user_id = auth.uid()
  )
);
```

Before writing, confirm the enum name with `grep -n "work_item_status" supabase/migrations/202606280001_initial_project_command_center.sql` and the projects/work_items composite-unique keys (`unique (id, workspace_id)` on projects) exist; adjust FK targets only if the grep shows different constraint shapes.

- [ ] **Step 2: Extend `database.types.ts`** — inside `Database["public"]["Tables"]`, add a `board_columns` block (alphabetical placement near the top) with Row/Insert/Update:

```ts
      board_columns: {
        Row: {
          id: string;
          workspace_id: string;
          project_id: string;
          title: string;
          status_category: WorkItemStatus;
          sort_order: number;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          project_id: string;
          title: string;
          status_category: WorkItemStatus;
          sort_order?: number;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          project_id?: string;
          title?: string;
          status_category?: WorkItemStatus;
          sort_order?: number;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
```

(If the file references enum types as `Database["public"]["Enums"]["work_item_status"]` instead of a `WorkItemStatus` alias inside table blocks, match the file's local style.) Then add `column_id: string | null;` to `work_items.Row`, and `column_id?: string | null;` to its Insert and Update.

- [ ] **Step 3:** `npm run build` → PASS (types compile). Commit `Add board columns migration and types`.

---

### Task 2: board-columns.queries.ts (TDD)

**Files:**
- Create: `src/features/work-items/board-columns.queries.ts`
- Create: `src/features/work-items/board-columns.test.ts`

**Interfaces (produces):**

```ts
export type BoardColumn = Database["public"]["Tables"]["board_columns"]["Row"];
export const defaultBoardColumns: ReadonlyArray<{ title: string; statusCategory: WorkItemStatus }>;
listBoardColumns(client, workspaceId: string, projectId: string): Promise<BoardColumn[]>
ensureDefaultBoardColumns(client, input: { workspaceId; projectId; userId }): Promise<BoardColumn[]>
createBoardColumn(client, input: { workspaceId; projectId; userId; title; statusCategory; sortOrder }): Promise<BoardColumn>
renameBoardColumn(client, input: { id; workspaceId; title }): Promise<BoardColumn>
reorderBoardColumns(client, input: { workspaceId; projectId; orderedIds: string[] }): Promise<void>
deleteBoardColumn(client, input: { id; workspaceId; moveItemsTo?: { columnId: string; statusCategory: WorkItemStatus } }): Promise<void>
moveWorkItemToColumn(client, input: { id; workspaceId; projectId; columnId; statusCategory }): Promise<WorkItem>
```

- [ ] **Step 1: Failing tests** — `board-columns.test.ts` with a chainable mock (thenable builder so `await` works mid-chain):

```ts
import { describe, expect, it, vi } from "vitest";
import {
  defaultBoardColumns,
  deleteBoardColumn,
  ensureDefaultBoardColumns,
  moveWorkItemToColumn,
  reorderBoardColumns,
} from "./board-columns.queries";

type Result = { data: unknown; error: unknown };

function builder(result: Result) {
  const chain: Record<string, unknown> = {};
  const handler = vi.fn(() => chain);
  for (const method of ["select", "insert", "update", "delete", "eq", "order", "single"]) {
    chain[method] = handler;
  }
  (chain as { then: unknown }).then = (resolve: (value: Result) => void) => resolve(result);
  return { chain, handler };
}

function clientWith(results: Result[]) {
  let call = 0;
  const builders = results.map((result) => builder(result));
  const from = vi.fn(() => builders[Math.min(call++, builders.length - 1)].chain);
  return { client: { from } as never, from, builders };
}

describe("ensureDefaultBoardColumns", () => {
  it("returns existing columns without inserting", async () => {
    const existing = [{ id: "col-1" }];
    const { client, from } = clientWith([{ data: existing, error: null }]);

    const result = await ensureDefaultBoardColumns(client, {
      workspaceId: "ws",
      projectId: "p",
      userId: "u",
    });

    expect(result).toBe(existing);
    expect(from).toHaveBeenCalledTimes(1);
  });

  it("seeds the six defaults when the project has none", async () => {
    const seeded = defaultBoardColumns.map((column, index) => ({ id: `col-${index}`, title: column.title }));
    const { client, from } = clientWith([
      { data: [], error: null },
      { data: seeded, error: null },
    ]);

    const result = await ensureDefaultBoardColumns(client, {
      workspaceId: "ws",
      projectId: "p",
      userId: "u",
    });

    expect(from).toHaveBeenCalledTimes(2);
    expect(result).toHaveLength(6);
    expect(defaultBoardColumns.map((column) => column.statusCategory)).toEqual([
      "backlog",
      "ready",
      "in_progress",
      "blocked",
      "review",
      "done",
    ]);
  });
});

describe("deleteBoardColumn", () => {
  it("moves items before deleting when a target is given", async () => {
    const { client, from } = clientWith([
      { data: null, error: null },
      { data: null, error: null },
    ]);

    await deleteBoardColumn(client, {
      id: "col-1",
      workspaceId: "ws",
      moveItemsTo: { columnId: "col-2", statusCategory: "done" },
    });

    expect(from).toHaveBeenNthCalledWith(1, "work_items");
    expect(from).toHaveBeenNthCalledWith(2, "board_columns");
  });

  it("deletes directly without a move target", async () => {
    const { client, from } = clientWith([{ data: null, error: null }]);

    await deleteBoardColumn(client, { id: "col-1", workspaceId: "ws" });

    expect(from).toHaveBeenCalledTimes(1);
    expect(from).toHaveBeenCalledWith("board_columns");
  });
});

describe("reorderBoardColumns", () => {
  it("writes sequential sort orders", async () => {
    const { client, from } = clientWith([
      { data: null, error: null },
      { data: null, error: null },
      { data: null, error: null },
    ]);

    await reorderBoardColumns(client, { workspaceId: "ws", projectId: "p", orderedIds: ["b", "a", "c"] });

    expect(from).toHaveBeenCalledTimes(3);
  });
});

describe("moveWorkItemToColumn", () => {
  it("sets column, status, and completion stamp for done", async () => {
    const { client, builders } = clientWith([{ data: { id: "wi" }, error: null }]);

    await moveWorkItemToColumn(client, {
      id: "wi",
      workspaceId: "ws",
      projectId: "p",
      columnId: "col-2",
      statusCategory: "done",
    });

    const updateArg = builders[0].handler.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(updateArg.column_id).toBe("col-2");
    expect(updateArg.status).toBe("done");
    expect(updateArg.completed_at).toBeTruthy();
  });
});
```

- [ ] **Step 2:** Run → FAIL (module not found).

- [ ] **Step 3: Implement** — `board-columns.queries.ts`:

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, WorkItemStatus } from "../../lib/supabase/database.types";

type Client = SupabaseClient<Database>;
export type BoardColumn = Database["public"]["Tables"]["board_columns"]["Row"];
type WorkItem = Database["public"]["Tables"]["work_items"]["Row"];

export const defaultBoardColumns = [
  { title: "Docked", statusCategory: "backlog" },
  { title: "Ready to Launch", statusCategory: "ready" },
  { title: "Launching", statusCategory: "in_progress" },
  { title: "Signal Lost", statusCategory: "blocked" },
  { title: "In Orbit", statusCategory: "review" },
  { title: "Mission Success", statusCategory: "done" },
] as const satisfies ReadonlyArray<{ title: string; statusCategory: WorkItemStatus }>;

export const boardColumnsKeys = {
  list: (workspaceId: string, projectId: string) => ["board-columns", workspaceId, projectId] as const,
};

export async function listBoardColumns(client: Client, workspaceId: string, projectId: string) {
  const { data, error } = await client
    .from("board_columns")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("project_id", projectId)
    .order("sort_order", { ascending: true });

  if (error) throw error;
  return data;
}

export async function ensureDefaultBoardColumns(
  client: Client,
  input: { workspaceId: string; projectId: string; userId: string },
) {
  const existing = await listBoardColumns(client, input.workspaceId, input.projectId);
  if (existing.length > 0) return existing;

  const { data, error } = await client
    .from("board_columns")
    .insert(
      defaultBoardColumns.map((column, index) => ({
        workspace_id: input.workspaceId,
        project_id: input.projectId,
        created_by: input.userId,
        title: column.title,
        status_category: column.statusCategory,
        sort_order: index,
      })),
    )
    .select("*")
    .order("sort_order", { ascending: true });

  if (error) throw error;
  return data;
}

export async function createBoardColumn(
  client: Client,
  input: {
    workspaceId: string;
    projectId: string;
    userId: string;
    title: string;
    statusCategory: WorkItemStatus;
    sortOrder: number;
  },
) {
  const { data, error } = await client
    .from("board_columns")
    .insert({
      workspace_id: input.workspaceId,
      project_id: input.projectId,
      created_by: input.userId,
      title: input.title,
      status_category: input.statusCategory,
      sort_order: input.sortOrder,
    })
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

export async function renameBoardColumn(client: Client, input: { id: string; workspaceId: string; title: string }) {
  const { data, error } = await client
    .from("board_columns")
    .update({ title: input.title })
    .eq("id", input.id)
    .eq("workspace_id", input.workspaceId)
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

export async function reorderBoardColumns(
  client: Client,
  input: { workspaceId: string; projectId: string; orderedIds: string[] },
) {
  for (const [index, id] of input.orderedIds.entries()) {
    const { error } = await client
      .from("board_columns")
      .update({ sort_order: index })
      .eq("id", id)
      .eq("workspace_id", input.workspaceId)
      .eq("project_id", input.projectId);

    if (error) throw error;
  }
}

export async function deleteBoardColumn(
  client: Client,
  input: {
    id: string;
    workspaceId: string;
    moveItemsTo?: { columnId: string; statusCategory: WorkItemStatus };
  },
) {
  if (input.moveItemsTo) {
    const { error: moveError } = await client
      .from("work_items")
      .update({
        column_id: input.moveItemsTo.columnId,
        status: input.moveItemsTo.statusCategory,
        completed_at: input.moveItemsTo.statusCategory === "done" ? new Date().toISOString() : null,
      })
      .eq("column_id", input.id)
      .eq("workspace_id", input.workspaceId);

    if (moveError) throw moveError;
  }

  const { error } = await client
    .from("board_columns")
    .delete()
    .eq("id", input.id)
    .eq("workspace_id", input.workspaceId);

  if (error) throw error;
}

export async function moveWorkItemToColumn(
  client: Client,
  input: {
    id: string;
    workspaceId: string;
    projectId: string;
    columnId: string;
    statusCategory: WorkItemStatus;
  },
): Promise<WorkItem> {
  const { data, error } = await client
    .from("work_items")
    .update({
      column_id: input.columnId,
      status: input.statusCategory,
      completed_at: input.statusCategory === "done" ? new Date().toISOString() : null,
    })
    .eq("id", input.id)
    .eq("workspace_id", input.workspaceId)
    .eq("project_id", input.projectId)
    .select("*")
    .single();

  if (error) throw error;
  return data;
}
```

(If `WorkItemStatus` isn't exported from `database.types.ts`, use `Database["public"]["Enums"]["work_item_status"]` — check the top of the file.)

- [ ] **Step 4:** Tests PASS. Commit `Add board column queries with default seeding`.

---

### Task 3: Column-driven kanban board (TDD)

**Files:**
- Modify: `src/features/work-items/kanban-board.tsx` (full rework)
- Modify: `src/features/work-items/kanban-board.test.tsx` (rewrite)

**Interfaces (produces):**

```ts
export function KanbanBoard(props: {
  columns: BoardColumn[];
  items: WorkItem[];
  isUpdating?: boolean;
  onOpenItem?: (id: string) => void;
  onMoveItem: (id: string, column: BoardColumn) => void;
  onRenameColumn: (id: string, title: string) => void;
  onDeleteColumn: (column: BoardColumn, moveItemsTo?: BoardColumn) => void;
  onAddColumn: (title: string, statusCategory: WorkItemStatus) => void;
  onReorderColumns: (orderedIds: string[]) => void;
}): JSX.Element;
export function groupItemsByColumn(columns: BoardColumn[], items: WorkItem[]): Map<string, WorkItem[]>;
```

`groupItemsByColumn`: item goes to its `column_id` when that column exists; otherwise to the first column whose `status_category === item.status`; otherwise to `columns[0]`.

- [ ] **Step 1: Rewrite the test file** with column fixtures (two columns "Todo"/backlog + "Done"/done), covering:
  1. fallback grouping — item with `column_id: null, status: "done"` renders in Done; item with valid `column_id` renders there; unmatched status lands in first column;
  2. rename — click title → input appears → type + Enter → `onRenameColumn("col-1", "New name")`;
  3. add — click "+ Add column" → type title, Enter → `onAddColumn("QA", "in_progress")`;
  4. delete empty column → `onDeleteColumn(column, undefined)` immediately; delete non-empty → move-select appears, choose target, confirm → `onDeleteColumn(column, target)`;
  5. column drag → `fireEvent.dragStart` header col-2, `fireEvent.drop` on col-1 header → `onReorderColumns(["col-2", "col-1"])`;
  6. card drop → `fireEvent.drop` on a column with card id in dataTransfer → `onMoveItem("wi-1", doneColumn)`;
  7. "Move to" select lists column titles and fires `onMoveItem`.

Write the concrete test code following the existing file's `workItem()` fixture pattern; each interaction test uses `vi.fn()` callbacks and asserts exact arguments.

- [ ] **Step 2:** Run → FAIL (props mismatch).

- [ ] **Step 3: Implement the rework** — grouped rendering by `groupItemsByColumn`; column header = draggable div with inline-rename state (`renamingColumnId`), × button with `deleteCandidate` state for the move-select confirm; ghost add tile (`isAdding` state with title input + category select over `workItemStatuses`); card `draggable` with `event.dataTransfer.setData("text/plain", item.id)`; column body `onDragOver preventDefault` + `onDrop` reading the id — if the payload matches a column id (prefix `column:`), reorder instead. Use payload prefixes: `column:<id>` for header drags, plain item id for cards. Priority pill/due-date/completed pill markup carried over from the current card. Keep classes `orbit-task-card` etc.

- [ ] **Step 4:** Board tests PASS. Commit `Rebuild kanban board with custom columns`.

---

### Task 4: Workspace wiring

**Files:**
- Modify: `src/features/projects/project-workspace-page.tsx`
- Modify: `src/features/projects/project-workspace-page.test.tsx`

- [ ] **Step 1:** Add `boardColumnsQuery` (`ensureDefaultBoardColumns`, key `boardColumnsKeys.list(workspaceId, projectId)`, enabled with Board tab active or always) and mutations: `moveItemMutation` (moveWorkItemToColumn), `renameColumnMutation`, `addColumnMutation` (sortOrder = columns.length), `deleteColumnMutation`, `reorderColumnsMutation` — each invalidating the columns key (and work-items key for move/delete). Pass everything into `<KanbanBoard>` replacing `onStatusChange`; drop the old `updateStatusMutation` usage on the Board path (keep the mutation if the detail drawer uses it — check `WorkItemDetailDrawer` usage before deleting).
- [ ] **Step 2:** Update `project-workspace-page.test.tsx`: mock `./../work-items/board-columns.queries` (ensureDefaultBoardColumns → six defaults with ids), adjust board assertions (column titles come from mock), move-flow test asserts `moveWorkItemToColumn` called.
- [ ] **Step 3:** `npx vitest run src/features/projects src/features/work-items` → PASS. Commit `Wire custom board columns into the workspace`.

---

### Task 5: Apply migration + verify

- [ ] **Step 1:** `supabase db push` from the worktree (user authorized). If the CLI isn't linked, run `supabase link --project-ref <ref from VITE_SUPABASE_URL>` first; if CLI/auth unavailable, STOP and hand the SQL to the user to run in the Supabase SQL editor.
- [ ] **Step 2:** `npx vitest run --maxWorkers=2` green; `npm run build` clean.
- [ ] **Step 3:** Fake-session screenshot can't exercise live DB; instead verify against the real backend with the dev server if a session exists, else rely on the integration tests + a screenshot of the board with mocked columns via tests. Report what was and wasn't visually verified.
- [ ] **Step 4:** Push branch (PR #12 update).

## Self-Review (completed)

Spec coverage ✔ (migration T1, queries T2, board UI T3, wiring T4, db push T5). Type consistency: `BoardColumn` from queries module reused in board props; move semantics identical in `deleteBoardColumn`/`moveWorkItemToColumn`. Task 3 Step 1 defines behaviors precisely but delegates fixture code to the implementer with the existing pattern named — acceptable given the full interface contract above it.
