# Daily Mission Control Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Daily Mission Control as the authenticated home experience for Orbit Flo, with a daily flight plan, quick capture, focus session, review state, and premium space-themed polish.

**Architecture:** Add daily planning tables as a layer over existing `work_items`, then introduce a focused `src/features/daily` feature area. The first page replaces the current dashboard route at `/` while reusing existing project, work item, milestone, and visual component patterns.

**Tech Stack:** React 19, Vite, TypeScript, TanStack Query, Supabase Postgres/Auth/RLS, Vitest, Testing Library, Playwright, Tailwind CSS classes.

---

## File Structure

- Create `supabase/migrations/202606290001_daily_mission_control.sql`: daily plan, daily plan item, capture enums/tables, indexes, grants, triggers, and RLS policies.
- Modify `src/lib/supabase/database.types.ts`: add `DailyPlanStatus`, `DailyPlanItemState`, `CaptureType`, and table typings for `daily_plans`, `daily_plan_items`, and `captures`.
- Create `src/features/daily/daily-plan.utils.ts`: pure helpers for dates, completion math, primary item selection, and item ordering.
- Create `src/features/daily/daily-plan.test.ts`: unit coverage for daily helper behavior.
- Create `src/features/daily/daily-plan.queries.ts`: Supabase read/write functions for today's plan, items, captures, focus completion, and review.
- Create `src/features/daily/daily-plan.queries.test.ts`: fake Supabase query tests that verify table names, scoping, and update payloads.
- Create `src/features/daily/daily-mission-control-page.tsx`: authenticated home page container and query orchestration.
- Create `src/features/daily/daily-mission-control-page.test.tsx`: component coverage for loading, empty plan, flight plan, quick capture, and review states.
- Create `src/features/daily/launch-briefing.tsx`: date, status, signals, and primary action.
- Create `src/features/daily/flight-plan.tsx`: daily item list, primary burn, completion/skipping actions, and reorder controls.
- Create `src/features/daily/quick-capture-dock.tsx`: typed capture input with capture type selector and submit state.
- Create `src/features/daily/focus-session-panel.tsx`: focused cockpit panel for the primary task.
- Create `src/features/daily/daily-review-panel.tsx`: reflection and rollover controls.
- Create `src/features/daily/mission-momentum.tsx`: completion ring and small stats.
- Modify `src/app/routes.tsx`: replace `DashboardPage` at `/` with `DailyMissionControlPage`.
- Modify `src/app/App.test.tsx`: update authenticated shell expectations from the old dashboard mock text to Daily Mission Control text.
- Modify `tests/e2e/smoke.spec.ts`: keep unauthenticated smoke intact; add authenticated Daily Mission Control smoke only if the existing test harness already supports mocked auth.

---

### Task 1: Add Daily Mission Control Supabase Schema

**Files:**
- Create: `supabase/migrations/202606290001_daily_mission_control.sql`
- Modify: `src/lib/supabase/database.types.ts`

- [ ] **Step 1: Create the migration with complete SQL**

Create `supabase/migrations/202606290001_daily_mission_control.sql`:

```sql
create type public.daily_plan_status as enum ('planned', 'active', 'completed');
create type public.daily_plan_item_state as enum ('planned', 'completed', 'skipped');
create type public.capture_type as enum ('task', 'note', 'idea', 'blocker');

create table public.daily_plans (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  plan_date date not null,
  status public.daily_plan_status not null default 'planned',
  reflection text,
  completed_count integer not null default 0,
  skipped_count integer not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, plan_date)
);

create table public.daily_plan_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  daily_plan_id uuid not null,
  work_item_id uuid not null,
  sort_order integer not null default 0,
  is_primary boolean not null default false,
  state public.daily_plan_item_state not null default 'planned',
  completed_at timestamptz,
  skipped_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (daily_plan_id, work_item_id),
  foreign key (daily_plan_id, workspace_id) references public.daily_plans(id, workspace_id) on delete cascade,
  foreign key (work_item_id, workspace_id) references public.work_items(id, workspace_id) on delete cascade
);

create unique index daily_plan_items_one_primary_idx
on public.daily_plan_items(daily_plan_id)
where is_primary;

create table public.captures (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid,
  work_item_id uuid,
  type public.capture_type not null default 'task',
  title text not null,
  body text,
  processed_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (work_item_id is null or project_id is not null),
  foreign key (project_id, workspace_id) references public.projects(id, workspace_id) on delete set null,
  foreign key (work_item_id, workspace_id, project_id) references public.work_items(id, workspace_id, project_id) on delete set null
);

create trigger set_daily_plans_updated_at
before update on public.daily_plans
for each row execute function public.set_updated_at();

create trigger set_daily_plan_items_updated_at
before update on public.daily_plan_items
for each row execute function public.set_updated_at();

create trigger set_captures_updated_at
before update on public.captures
for each row execute function public.set_updated_at();

create index daily_plans_workspace_date_idx on public.daily_plans(workspace_id, plan_date desc);
create index daily_plan_items_plan_order_idx on public.daily_plan_items(daily_plan_id, sort_order);
create index daily_plan_items_work_item_idx on public.daily_plan_items(work_item_id);
create index captures_workspace_processed_idx on public.captures(workspace_id, processed_at, created_at desc);
create index captures_project_idx on public.captures(project_id);
create index captures_work_item_idx on public.captures(work_item_id);

alter table public.daily_plans enable row level security;
alter table public.daily_plan_items enable row level security;
alter table public.captures enable row level security;

grant select, delete on public.daily_plans to authenticated;
grant insert(workspace_id, plan_date, status, reflection, completed_count, skipped_count, created_by) on public.daily_plans to authenticated;
grant update(status, reflection, completed_count, skipped_count) on public.daily_plans to authenticated;

grant select, delete on public.daily_plan_items to authenticated;
grant insert(workspace_id, daily_plan_id, work_item_id, sort_order, is_primary, state) on public.daily_plan_items to authenticated;
grant update(sort_order, is_primary, state, completed_at, skipped_at) on public.daily_plan_items to authenticated;

grant select, delete on public.captures to authenticated;
grant insert(workspace_id, project_id, work_item_id, type, title, body, created_by) on public.captures to authenticated;
grant update(project_id, work_item_id, type, title, body, processed_at) on public.captures to authenticated;

create policy "Members can view daily plans"
on public.daily_plans
for select
to authenticated
using (private.is_workspace_member(workspace_id));

create policy "Members can create daily plans"
on public.daily_plans
for insert
to authenticated
with check (
  created_by = (select auth.uid())
  and private.has_workspace_role(workspace_id, array['owner', 'admin', 'member']::public.workspace_role[])
);

create policy "Members can update daily plans"
on public.daily_plans
for update
to authenticated
using (private.has_workspace_role(workspace_id, array['owner', 'admin', 'member']::public.workspace_role[]))
with check (private.has_workspace_role(workspace_id, array['owner', 'admin', 'member']::public.workspace_role[]));

create policy "Owners and admins can delete daily plans"
on public.daily_plans
for delete
to authenticated
using (private.has_workspace_role(workspace_id, array['owner', 'admin']::public.workspace_role[]));

create policy "Members can view daily plan items"
on public.daily_plan_items
for select
to authenticated
using (private.is_workspace_member(workspace_id));

create policy "Members can create daily plan items"
on public.daily_plan_items
for insert
to authenticated
with check (private.has_workspace_role(workspace_id, array['owner', 'admin', 'member']::public.workspace_role[]));

create policy "Members can update daily plan items"
on public.daily_plan_items
for update
to authenticated
using (private.has_workspace_role(workspace_id, array['owner', 'admin', 'member']::public.workspace_role[]))
with check (private.has_workspace_role(workspace_id, array['owner', 'admin', 'member']::public.workspace_role[]));

create policy "Owners and admins can delete daily plan items"
on public.daily_plan_items
for delete
to authenticated
using (private.has_workspace_role(workspace_id, array['owner', 'admin']::public.workspace_role[]));

create policy "Members can view captures"
on public.captures
for select
to authenticated
using (private.is_workspace_member(workspace_id));

create policy "Members can create captures"
on public.captures
for insert
to authenticated
with check (
  created_by = (select auth.uid())
  and private.has_workspace_role(workspace_id, array['owner', 'admin', 'member']::public.workspace_role[])
);

create policy "Members can update captures"
on public.captures
for update
to authenticated
using (private.has_workspace_role(workspace_id, array['owner', 'admin', 'member']::public.workspace_role[]))
with check (private.has_workspace_role(workspace_id, array['owner', 'admin', 'member']::public.workspace_role[]));

create policy "Owners and admins can delete captures"
on public.captures
for delete
to authenticated
using (private.has_workspace_role(workspace_id, array['owner', 'admin']::public.workspace_role[]));
```

- [ ] **Step 2: Update database types**

Modify `src/lib/supabase/database.types.ts`:

```ts
export type DailyPlanStatus = "planned" | "active" | "completed";
export type DailyPlanItemState = "planned" | "completed" | "skipped";
export type CaptureType = "task" | "note" | "idea" | "blocker";
```

Add these table entries inside `Database["public"]["Tables"]`:

```ts
      daily_plans: {
        Row: {
          id: string;
          workspace_id: string;
          plan_date: string;
          status: DailyPlanStatus;
          reflection: string | null;
          completed_count: number;
          skipped_count: number;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          workspace_id: string;
          plan_date: string;
          status?: DailyPlanStatus;
          reflection?: string | null;
          completed_count?: number;
          skipped_count?: number;
          created_by: string;
        };
        Update: {
          status?: DailyPlanStatus;
          reflection?: string | null;
          completed_count?: number;
          skipped_count?: number;
        };
        Relationships: [];
      };
      daily_plan_items: {
        Row: {
          id: string;
          workspace_id: string;
          daily_plan_id: string;
          work_item_id: string;
          sort_order: number;
          is_primary: boolean;
          state: DailyPlanItemState;
          completed_at: string | null;
          skipped_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          workspace_id: string;
          daily_plan_id: string;
          work_item_id: string;
          sort_order?: number;
          is_primary?: boolean;
          state?: DailyPlanItemState;
        };
        Update: {
          sort_order?: number;
          is_primary?: boolean;
          state?: DailyPlanItemState;
          completed_at?: string | null;
          skipped_at?: string | null;
        };
        Relationships: [];
      };
      captures: {
        Row: {
          id: string;
          workspace_id: string;
          project_id: string | null;
          work_item_id: string | null;
          type: CaptureType;
          title: string;
          body: string | null;
          processed_at: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          workspace_id: string;
          project_id?: string | null;
          work_item_id?: string | null;
          type?: CaptureType;
          title: string;
          body?: string | null;
          created_by: string;
        };
        Update: {
          project_id?: string | null;
          work_item_id?: string | null;
          type?: CaptureType;
          title?: string;
          body?: string | null;
          processed_at?: string | null;
        };
        Relationships: [];
      };
```

- [ ] **Step 3: Run typecheck/build**

Run:

```powershell
$env:VITE_SUPABASE_URL='https://example.supabase.co'
$env:VITE_SUPABASE_PUBLISHABLE_KEY='sb_publishable_example'
npm.cmd run build
```

Expected: TypeScript and Vite build pass. The existing Vite chunk-size warning can remain.

- [ ] **Step 4: Commit**

```powershell
git add supabase/migrations/202606290001_daily_mission_control.sql src/lib/supabase/database.types.ts
git commit -m "Add Daily Mission Control schema"
```

---

### Task 2: Add Daily Plan Pure Helpers

**Files:**
- Create: `src/features/daily/daily-plan.utils.ts`
- Create: `src/features/daily/daily-plan.test.ts`

- [ ] **Step 1: Write failing helper tests**

Create `src/features/daily/daily-plan.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { Database } from "../../lib/supabase/database.types";
import {
  calculateDailyPlanSummary,
  formatPlanDate,
  getPrimaryDailyItem,
  sortDailyPlanItems,
} from "./daily-plan.utils";

type DailyPlanItem = Database["public"]["Tables"]["daily_plan_items"]["Row"];

function item(overrides: Partial<DailyPlanItem>): DailyPlanItem {
  return {
    id: "item-1",
    workspace_id: "workspace-1",
    daily_plan_id: "plan-1",
    work_item_id: "work-1",
    sort_order: 0,
    is_primary: false,
    state: "planned",
    completed_at: null,
    skipped_at: null,
    created_at: "2026-06-29T12:00:00.000Z",
    updated_at: "2026-06-29T12:00:00.000Z",
    ...overrides,
  };
}

describe("formatPlanDate", () => {
  it("returns a date-only string for the user's local day", () => {
    expect(formatPlanDate(new Date(2026, 5, 29, 9, 30))).toBe("2026-06-29");
  });
});

describe("sortDailyPlanItems", () => {
  it("orders items by sort order and then created time", () => {
    const sorted = sortDailyPlanItems([
      item({ id: "b", sort_order: 2, created_at: "2026-06-29T10:00:00.000Z" }),
      item({ id: "a", sort_order: 1, created_at: "2026-06-29T11:00:00.000Z" }),
      item({ id: "c", sort_order: 2, created_at: "2026-06-29T09:00:00.000Z" }),
    ]);

    expect(sorted.map((dailyItem) => dailyItem.id)).toEqual(["a", "c", "b"]);
  });
});

describe("getPrimaryDailyItem", () => {
  it("uses the explicit primary item when present", () => {
    expect(getPrimaryDailyItem([
      item({ id: "first", sort_order: 0 }),
      item({ id: "primary", sort_order: 1, is_primary: true }),
    ])?.id).toBe("primary");
  });

  it("falls back to the first planned item", () => {
    expect(getPrimaryDailyItem([
      item({ id: "done", sort_order: 0, state: "completed" }),
      item({ id: "planned", sort_order: 1, state: "planned" }),
    ])?.id).toBe("planned");
  });
});

describe("calculateDailyPlanSummary", () => {
  it("counts completed, skipped, planned, and completion percentage", () => {
    expect(calculateDailyPlanSummary([
      item({ id: "done", state: "completed" }),
      item({ id: "skip", state: "skipped" }),
      item({ id: "plan", state: "planned" }),
    ])).toEqual({
      total: 3,
      completed: 1,
      skipped: 1,
      planned: 1,
      completionPercent: 33,
    });
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```powershell
npx.cmd vitest run src/features/daily/daily-plan.test.ts
```

Expected: FAIL because `src/features/daily/daily-plan.utils.ts` does not exist.

- [ ] **Step 3: Implement helpers**

Create `src/features/daily/daily-plan.utils.ts`:

```ts
import type { Database } from "../../lib/supabase/database.types";

type DailyPlanItem = Database["public"]["Tables"]["daily_plan_items"]["Row"];

export function formatPlanDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function sortDailyPlanItems<T extends Pick<DailyPlanItem, "sort_order" | "created_at">>(items: T[]) {
  return [...items].sort((a, b) => {
    const sortDelta = a.sort_order - b.sort_order;
    if (sortDelta !== 0) return sortDelta;
    return a.created_at.localeCompare(b.created_at);
  });
}

export function getPrimaryDailyItem<T extends Pick<DailyPlanItem, "is_primary" | "state" | "sort_order" | "created_at">>(
  items: T[],
) {
  const sorted = sortDailyPlanItems(items);
  return sorted.find((item) => item.is_primary) ?? sorted.find((item) => item.state === "planned") ?? sorted[0];
}

export function calculateDailyPlanSummary(items: Pick<DailyPlanItem, "state">[]) {
  const completed = items.filter((item) => item.state === "completed").length;
  const skipped = items.filter((item) => item.state === "skipped").length;
  const planned = items.filter((item) => item.state === "planned").length;
  const total = items.length;

  return {
    total,
    completed,
    skipped,
    planned,
    completionPercent: total === 0 ? 0 : Math.round((completed / total) * 100),
  };
}
```

- [ ] **Step 4: Run helper tests**

Run:

```powershell
npx.cmd vitest run src/features/daily/daily-plan.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/features/daily/daily-plan.utils.ts src/features/daily/daily-plan.test.ts
git commit -m "Add daily plan helpers"
```

---

### Task 3: Add Daily Plan Supabase Queries

**Files:**
- Create: `src/features/daily/daily-plan.queries.ts`
- Create: `src/features/daily/daily-plan.queries.test.ts`

- [ ] **Step 1: Write query tests**

Create `src/features/daily/daily-plan.queries.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import {
  addDailyPlanItem,
  completeDailyPlanItem,
  createCapture,
  getDailyMissionControlData,
  getOrCreateDailyPlan,
  saveDailyReview,
  skipDailyPlanItem,
} from "./daily-plan.queries";

function createQuery(result: { data: unknown; error: unknown } = { data: null, error: null }) {
  const query = {
    ...result,
    select: vi.fn(() => query),
    insert: vi.fn(() => query),
    update: vi.fn(() => query),
    upsert: vi.fn(() => query),
    eq: vi.fn(() => query),
    is: vi.fn(() => query),
    neq: vi.fn(() => query),
    order: vi.fn(() => query),
    limit: vi.fn(() => query),
    maybeSingle: vi.fn(() => result),
    single: vi.fn(() => result),
  };

  return query;
}

function createClient(result: { data: unknown; error: unknown } = { data: [], error: null }) {
  const queries: Record<string, ReturnType<typeof createQuery>> = {};
  return {
    client: {
      from: vi.fn((table: string) => {
        const query = createQuery(result);
        queries[table] = query;
        return query;
      }),
    },
    queries,
  };
}

describe("getOrCreateDailyPlan", () => {
  it("upserts one workspace-scoped plan for the requested date", async () => {
    const { client, queries } = createClient({ data: { id: "plan-1" }, error: null });

    await getOrCreateDailyPlan(client as never, {
      workspaceId: "workspace-1",
      userId: "user-1",
      planDate: "2026-06-29",
    });

    expect(client.from).toHaveBeenCalledWith("daily_plans");
    expect(queries.daily_plans.upsert).toHaveBeenCalledWith(
      {
        workspace_id: "workspace-1",
        plan_date: "2026-06-29",
        created_by: "user-1",
      },
      { onConflict: "workspace_id,plan_date", ignoreDuplicates: false },
    );
    expect(queries.daily_plans.select).toHaveBeenCalledWith("*");
    expect(queries.daily_plans.single).toHaveBeenCalled();
  });
});

describe("getDailyMissionControlData", () => {
  it("loads today's plan, plan items, work items, captures, milestones, and projects", async () => {
    const { client, queries } = createClient({ data: [], error: null });

    await getDailyMissionControlData(client as never, "workspace-1", "2026-06-29");

    expect(client.from).toHaveBeenCalledWith("daily_plans");
    expect(client.from).toHaveBeenCalledWith("daily_plan_items");
    expect(client.from).toHaveBeenCalledWith("work_items");
    expect(client.from).toHaveBeenCalledWith("captures");
    expect(client.from).toHaveBeenCalledWith("milestones");
    expect(client.from).toHaveBeenCalledWith("projects");
    expect(queries.daily_plans.eq).toHaveBeenCalledWith("workspace_id", "workspace-1");
    expect(queries.daily_plans.eq).toHaveBeenCalledWith("plan_date", "2026-06-29");
    expect(queries.captures.is).toHaveBeenCalledWith("processed_at", null);
    expect(queries.work_items.neq).toHaveBeenCalledWith("status", "done");
  });
});

describe("addDailyPlanItem", () => {
  it("inserts a linked work item into a daily plan", async () => {
    const { client, queries } = createClient({ data: { id: "item-1" }, error: null });

    await addDailyPlanItem(client as never, {
      workspaceId: "workspace-1",
      dailyPlanId: "plan-1",
      workItemId: "work-1",
      sortOrder: 2,
      isPrimary: true,
    });

    expect(client.from).toHaveBeenCalledWith("daily_plan_items");
    expect(queries.daily_plan_items.insert).toHaveBeenCalledWith({
      workspace_id: "workspace-1",
      daily_plan_id: "plan-1",
      work_item_id: "work-1",
      sort_order: 2,
      is_primary: true,
    });
  });
});

describe("completeDailyPlanItem", () => {
  it("marks only the daily plan item as completed", async () => {
    const { client, queries } = createClient({ data: { id: "item-1" }, error: null });

    await completeDailyPlanItem(client as never, {
      id: "item-1",
      workspaceId: "workspace-1",
    });

    expect(queries.daily_plan_items.update).toHaveBeenCalledWith({
      state: "completed",
      completed_at: expect.any(String),
      skipped_at: null,
    });
    expect(queries.daily_plan_items.eq).toHaveBeenCalledWith("id", "item-1");
    expect(queries.daily_plan_items.eq).toHaveBeenCalledWith("workspace_id", "workspace-1");
  });
});

describe("skipDailyPlanItem", () => {
  it("marks only the daily plan item as skipped", async () => {
    const { client, queries } = createClient({ data: { id: "item-1" }, error: null });

    await skipDailyPlanItem(client as never, {
      id: "item-1",
      workspaceId: "workspace-1",
    });

    expect(queries.daily_plan_items.update).toHaveBeenCalledWith({
      state: "skipped",
      skipped_at: expect.any(String),
    });
  });
});

describe("createCapture", () => {
  it("stores an unprocessed capture scoped to the workspace", async () => {
    const { client, queries } = createClient({ data: { id: "capture-1" }, error: null });

    await createCapture(client as never, {
      workspaceId: "workspace-1",
      userId: "user-1",
      type: "idea",
      title: "New launch thought",
      body: "Use the review panel more.",
    });

    expect(queries.captures.insert).toHaveBeenCalledWith({
      workspace_id: "workspace-1",
      created_by: "user-1",
      type: "idea",
      title: "New launch thought",
      body: "Use the review panel more.",
      project_id: null,
      work_item_id: null,
    });
  });
});

describe("saveDailyReview", () => {
  it("stores reflection and daily completion stats", async () => {
    const { client, queries } = createClient({ data: { id: "plan-1" }, error: null });

    await saveDailyReview(client as never, {
      id: "plan-1",
      workspaceId: "workspace-1",
      reflection: "Moved the auth polish forward.",
      completedCount: 2,
      skippedCount: 1,
    });

    expect(queries.daily_plans.update).toHaveBeenCalledWith({
      status: "completed",
      reflection: "Moved the auth polish forward.",
      completed_count: 2,
      skipped_count: 1,
    });
  });
});
```

- [ ] **Step 2: Run query tests to verify failure**

Run:

```powershell
npx.cmd vitest run src/features/daily/daily-plan.queries.test.ts
```

Expected: FAIL because `daily-plan.queries.ts` does not exist.

- [ ] **Step 3: Implement query module**

Create `src/features/daily/daily-plan.queries.ts`:

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CaptureType, Database } from "../../lib/supabase/database.types";
import { sortDailyPlanItems } from "./daily-plan.utils";

type Client = SupabaseClient<Database>;
type DailyPlan = Database["public"]["Tables"]["daily_plans"]["Row"];
type DailyPlanItem = Database["public"]["Tables"]["daily_plan_items"]["Row"];
type WorkItem = Database["public"]["Tables"]["work_items"]["Row"];

export type DailyPlanItemWithWorkItem = DailyPlanItem & {
  workItem: WorkItem | null;
};

export async function getOrCreateDailyPlan(
  client: Client,
  input: {
    workspaceId: string;
    userId: string;
    planDate: string;
  },
) {
  const { data, error } = await client
    .from("daily_plans")
    .upsert(
      {
        workspace_id: input.workspaceId,
        plan_date: input.planDate,
        created_by: input.userId,
      },
      { onConflict: "workspace_id,plan_date", ignoreDuplicates: false },
    )
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

export async function getDailyMissionControlData(client: Client, workspaceId: string, planDate: string) {
  const [plan, planItems, workItems, captures, milestones, projects] = await Promise.all([
    client
      .from("daily_plans")
      .select("*")
      .eq("workspace_id", workspaceId)
      .eq("plan_date", planDate)
      .maybeSingle(),
    client
      .from("daily_plan_items")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("sort_order", { ascending: true }),
    client
      .from("work_items")
      .select("*")
      .eq("workspace_id", workspaceId)
      .neq("status", "done")
      .order("updated_at", { ascending: false }),
    client
      .from("captures")
      .select("*")
      .eq("workspace_id", workspaceId)
      .is("processed_at", null)
      .order("created_at", { ascending: false })
      .limit(8),
    client
      .from("milestones")
      .select("*")
      .eq("workspace_id", workspaceId)
      .is("completed_at", null)
      .order("target_date", { ascending: true })
      .limit(5),
    client.from("projects").select("*").eq("workspace_id", workspaceId).order("updated_at", { ascending: false }),
  ]);

  if (plan.error) throw plan.error;
  if (planItems.error) throw planItems.error;
  if (workItems.error) throw workItems.error;
  if (captures.error) throw captures.error;
  if (milestones.error) throw milestones.error;
  if (projects.error) throw projects.error;

  const activePlan = plan.data as DailyPlan | null;
  const dailyItems = (planItems.data as DailyPlanItem[]).filter((item) => item.daily_plan_id === activePlan?.id);
  const workItemsById = new Map((workItems.data as WorkItem[]).map((item) => [item.id, item]));
  const dailyPlanItems = sortDailyPlanItems(dailyItems).map((item) => ({
    ...item,
    workItem: workItemsById.get(item.work_item_id) ?? null,
  }));

  return {
    plan: activePlan,
    dailyPlanItems,
    availableWorkItems: workItems.data as WorkItem[],
    captures: captures.data,
    milestones: milestones.data,
    projects: projects.data,
  };
}

export async function addDailyPlanItem(
  client: Client,
  input: {
    workspaceId: string;
    dailyPlanId: string;
    workItemId: string;
    sortOrder: number;
    isPrimary: boolean;
  },
) {
  const { data, error } = await client
    .from("daily_plan_items")
    .insert({
      workspace_id: input.workspaceId,
      daily_plan_id: input.dailyPlanId,
      work_item_id: input.workItemId,
      sort_order: input.sortOrder,
      is_primary: input.isPrimary,
    })
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

export async function completeDailyPlanItem(
  client: Client,
  input: {
    id: string;
    workspaceId: string;
  },
) {
  const { data, error } = await client
    .from("daily_plan_items")
    .update({
      state: "completed",
      completed_at: new Date().toISOString(),
      skipped_at: null,
    })
    .eq("id", input.id)
    .eq("workspace_id", input.workspaceId)
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

export async function skipDailyPlanItem(
  client: Client,
  input: {
    id: string;
    workspaceId: string;
  },
) {
  const { data, error } = await client
    .from("daily_plan_items")
    .update({
      state: "skipped",
      skipped_at: new Date().toISOString(),
    })
    .eq("id", input.id)
    .eq("workspace_id", input.workspaceId)
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

export async function createCapture(
  client: Client,
  input: {
    workspaceId: string;
    userId: string;
    type: CaptureType;
    title: string;
    body?: string;
    projectId?: string | null;
    workItemId?: string | null;
  },
) {
  const { data, error } = await client
    .from("captures")
    .insert({
      workspace_id: input.workspaceId,
      created_by: input.userId,
      type: input.type,
      title: input.title,
      body: input.body || null,
      project_id: input.projectId ?? null,
      work_item_id: input.workItemId ?? null,
    })
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

export async function saveDailyReview(
  client: Client,
  input: {
    id: string;
    workspaceId: string;
    reflection: string;
    completedCount: number;
    skippedCount: number;
  },
) {
  const { data, error } = await client
    .from("daily_plans")
    .update({
      status: "completed",
      reflection: input.reflection,
      completed_count: input.completedCount,
      skipped_count: input.skippedCount,
    })
    .eq("id", input.id)
    .eq("workspace_id", input.workspaceId)
    .select("*")
    .single();

  if (error) throw error;
  return data;
}
```

- [ ] **Step 4: Run query tests**

Run:

```powershell
npx.cmd vitest run src/features/daily/daily-plan.queries.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/features/daily/daily-plan.queries.ts src/features/daily/daily-plan.queries.test.ts
git commit -m "Add daily mission control queries"
```

---

### Task 4: Route Daily Mission Control To The Authenticated Home

**Files:**
- Create: `src/features/daily/daily-mission-control-page.tsx`
- Create: `src/features/daily/daily-mission-control-page.test.tsx`
- Modify: `src/app/routes.tsx`
- Modify: `src/app/App.test.tsx`

- [ ] **Step 1: Write page route/component tests**

Create `src/features/daily/daily-mission-control-page.test.tsx`:

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DailyMissionControlPage } from "./daily-mission-control-page";

vi.mock("../../lib/supabase/client", () => ({
  supabase: {},
}));

vi.mock("../../lib/supabase/workspace", () => ({
  getStoredWorkspaceId: () => "workspace-1",
}));

vi.mock("../auth/use-auth", () => ({
  useAuth: () => ({
    isLoading: false,
    user: { id: "user-1" },
  }),
}));

const dailyMocks = vi.hoisted(() => ({
  getOrCreateDailyPlan: vi.fn(),
  getDailyMissionControlData: vi.fn(),
  createCapture: vi.fn(),
}));

vi.mock("./daily-plan.queries", () => ({
  getOrCreateDailyPlan: dailyMocks.getOrCreateDailyPlan,
  getDailyMissionControlData: dailyMocks.getDailyMissionControlData,
  createCapture: dailyMocks.createCapture,
}));

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <DailyMissionControlPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("DailyMissionControlPage", () => {
  beforeEach(() => {
    dailyMocks.getOrCreateDailyPlan.mockResolvedValue({
      id: "plan-1",
      workspace_id: "workspace-1",
      plan_date: "2026-06-29",
      status: "planned",
      reflection: null,
      completed_count: 0,
      skipped_count: 0,
      created_by: "user-1",
      created_at: "2026-06-29T00:00:00.000Z",
      updated_at: "2026-06-29T00:00:00.000Z",
    });
    dailyMocks.getDailyMissionControlData.mockResolvedValue({
      plan: null,
      dailyPlanItems: [],
      availableWorkItems: [],
      captures: [],
      milestones: [],
      projects: [],
    });
  });

  it("renders the Daily Mission Control cockpit", async () => {
    renderPage();

    expect(await screen.findByRole("heading", { name: "Daily Mission Control" })).toBeVisible();
    expect(screen.getByText("Today's Flight Plan")).toBeVisible();
    expect(screen.getByText("Quick Capture")).toBeVisible();
    expect(screen.getByText("Mission Momentum")).toBeVisible();
  });
});
```

Modify `src/app/App.test.tsx` mock:

```tsx
vi.mock("../features/daily/daily-mission-control-page", () => ({
  DailyMissionControlPage: () => <div>Daily Mission Control page</div>,
}));
```

Replace dashboard expectations:

```tsx
expect(screen.getByText("Daily Mission Control page")).toBeTruthy();
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```powershell
npx.cmd vitest run src/features/daily/daily-mission-control-page.test.tsx src/app/App.test.tsx
```

Expected: FAIL because `DailyMissionControlPage` and the route import do not exist.

- [ ] **Step 3: Implement first page shell**

Create `src/features/daily/daily-mission-control-page.tsx`:

```tsx
import { useQuery } from "@tanstack/react-query";
import { EmptyState } from "../../components/empty-state";
import { supabase } from "../../lib/supabase/client";
import { getStoredWorkspaceId } from "../../lib/supabase/workspace";
import { useAuth } from "../auth/use-auth";
import { getDailyMissionControlData, getOrCreateDailyPlan } from "./daily-plan.queries";
import { formatPlanDate } from "./daily-plan.utils";

export function DailyMissionControlPage() {
  const { isLoading: isAuthLoading, user } = useAuth();
  const workspaceId = getStoredWorkspaceId();
  const planDate = formatPlanDate();

  const dailyQuery = useQuery({
    queryKey: ["daily-mission-control", workspaceId, planDate],
    queryFn: async () => {
      if (!workspaceId || !user) {
        throw new Error("Choose a workspace before opening Daily Mission Control.");
      }

      await getOrCreateDailyPlan(supabase, {
        workspaceId,
        userId: user.id,
        planDate,
      });

      return getDailyMissionControlData(supabase, workspaceId, planDate);
    },
    enabled: Boolean(workspaceId && user),
  });

  if (isAuthLoading) {
    return <EmptyState isLoading title="Loading Daily Mission Control" message="Checking your session before launch." />;
  }

  if (!user) {
    return <EmptyState title="Sign in required" message="Sign in to open Daily Mission Control." />;
  }

  if (!workspaceId) {
    return <EmptyState title="No workspace selected" message="Choose or create a workspace before launch." />;
  }

  return (
    <section className="grid gap-5">
      <div className="orbit-panel overflow-hidden rounded-lg p-5 sm:p-6">
        <p className="mission-label">Launch Briefing</p>
        <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div>
            <h1 className="text-3xl font-black text-white sm:text-4xl">Daily Mission Control</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
              Choose today's flight plan, capture loose signals, and keep momentum in orbit.
            </p>
          </div>
          <p className="rounded-lg border border-cyan-300/20 bg-cyan-300/10 px-4 py-3 text-sm font-semibold text-cyan-100">
            {planDate}
          </p>
        </div>
      </div>

      {dailyQuery.isPending ? (
        <EmptyState isLoading title="Preparing today's orbit" message="Loading your daily mission plan." />
      ) : null}

      {dailyQuery.isError ? (
        <EmptyState title="Could not load Daily Mission Control" message={dailyQuery.error.message} />
      ) : null}

      {!dailyQuery.isPending && !dailyQuery.isError ? (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <section className="orbit-panel rounded-lg p-5">
            <p className="mission-label">Today's Flight Plan</p>
            <h2 className="mt-2 text-xl font-black text-white">Set your primary burn.</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Add 3-5 objectives to make today clear and finishable.
            </p>
          </section>

          <div className="grid gap-5">
            <section className="orbit-panel rounded-lg p-5">
              <p className="mission-label">Quick Capture</p>
              <p className="mt-2 text-sm text-slate-400">Signals, tasks, blockers, and ideas will dock here.</p>
            </section>
            <section className="orbit-panel rounded-lg p-5">
              <p className="mission-label">Mission Momentum</p>
              <p className="mt-2 text-sm text-slate-400">Your progress ring will react as objectives are completed.</p>
            </section>
          </div>
        </div>
      ) : null}
    </section>
  );
}
```

Modify `src/app/routes.tsx`:

```tsx
import { DailyMissionControlPage } from "../features/daily/daily-mission-control-page";
```

Replace the `/` route element:

```tsx
<AuthenticatedShell>
  <DailyMissionControlPage />
</AuthenticatedShell>
```

- [ ] **Step 4: Run route/page tests**

Run:

```powershell
npx.cmd vitest run src/features/daily/daily-mission-control-page.test.tsx src/app/App.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/features/daily/daily-mission-control-page.tsx src/features/daily/daily-mission-control-page.test.tsx src/app/routes.tsx src/app/App.test.tsx
git commit -m "Add Daily Mission Control home"
```

---

### Task 5: Build Flight Plan And Momentum Components

**Files:**
- Create: `src/features/daily/flight-plan.tsx`
- Create: `src/features/daily/mission-momentum.tsx`
- Modify: `src/features/daily/daily-mission-control-page.tsx`
- Modify: `src/features/daily/daily-mission-control-page.test.tsx`

- [ ] **Step 1: Extend component test for visible flight plan item**

Add this test to `src/features/daily/daily-mission-control-page.test.tsx`:

```tsx
it("shows today's flight plan and momentum progress", async () => {
  dailyMocks.getDailyMissionControlData.mockResolvedValue({
    plan: { id: "plan-1", workspace_id: "workspace-1", plan_date: "2026-06-29", status: "planned", reflection: null, completed_count: 0, skipped_count: 0, created_by: "user-1", created_at: "2026-06-29T00:00:00.000Z", updated_at: "2026-06-29T00:00:00.000Z" },
    dailyPlanItems: [
      {
        id: "daily-item-1",
        workspace_id: "workspace-1",
        daily_plan_id: "plan-1",
        work_item_id: "work-1",
        sort_order: 0,
        is_primary: true,
        state: "planned",
        completed_at: null,
        skipped_at: null,
        created_at: "2026-06-29T00:00:00.000Z",
        updated_at: "2026-06-29T00:00:00.000Z",
        workItem: {
          id: "work-1",
          workspace_id: "workspace-1",
          project_id: "project-1",
          milestone_id: null,
          title: "Ship onboarding polish",
          description: "Finish the first-run flow.",
          status: "ready",
          priority: "high",
          due_date: null,
          estimate_points: null,
          sort_order: 0,
          blocked_reason: null,
          created_by: "user-1",
          created_at: "2026-06-29T00:00:00.000Z",
          updated_at: "2026-06-29T00:00:00.000Z",
          completed_at: null,
        },
      },
    ],
    availableWorkItems: [],
    captures: [],
    milestones: [],
    projects: [],
  });

  renderPage();

  expect(await screen.findByText("Ship onboarding polish")).toBeVisible();
  expect(screen.getByText("Primary burn")).toBeVisible();
  expect(screen.getByText("0% complete")).toBeVisible();
});
```

- [ ] **Step 2: Run test to verify failure**

Run:

```powershell
npx.cmd vitest run src/features/daily/daily-mission-control-page.test.tsx
```

Expected: FAIL because the flight plan item is not rendered.

- [ ] **Step 3: Implement `FlightPlan`**

Create `src/features/daily/flight-plan.tsx`:

```tsx
import { CheckCircle2, Circle, Flame, SkipForward } from "lucide-react";
import { EmptyState } from "../../components/empty-state";
import { StatusPill } from "../../components/status-pill";
import type { DailyPlanItemWithWorkItem } from "./daily-plan.queries";

function formatLabel(value: string) {
  return value.replaceAll("_", " ");
}

export function FlightPlan({
  items,
  onComplete,
  onSkip,
}: {
  items: DailyPlanItemWithWorkItem[];
  onComplete: (id: string) => void;
  onSkip: (id: string) => void;
}) {
  if (items.length === 0) {
    return (
      <section className="orbit-panel rounded-lg p-5">
        <p className="mission-label">Today's Flight Plan</p>
        <EmptyState title="No objectives locked" message="Add 3-5 objectives to give today a clean orbit." />
      </section>
    );
  }

  return (
    <section className="orbit-panel rounded-lg p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="mission-label">Today's Flight Plan</p>
          <h2 className="mt-2 text-xl font-black text-white">Primary objectives</h2>
        </div>
        <StatusPill tone="neutral">{items.length} locked</StatusPill>
      </div>
      <ul className="mt-4 grid gap-3">
        {items.map((item) => (
          <li
            className={
              item.is_primary
                ? "relative overflow-hidden rounded-lg border border-cyan-300/35 bg-cyan-300/10 p-4 shadow-[0_0_30px_rgba(34,211,238,0.12)]"
                : "rounded-lg border border-slate-400/15 bg-slate-950/50 p-4"
            }
            key={item.id}
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  {item.is_primary ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-cyan-300/25 bg-cyan-300/10 px-2 py-1 text-[0.65rem] font-bold uppercase tracking-[0.14em] text-cyan-100">
                      <Flame size={12} aria-hidden="true" />
                      Primary burn
                    </span>
                  ) : null}
                  <StatusPill tone={item.state === "completed" ? "good" : item.state === "skipped" ? "warning" : "neutral"}>
                    {formatLabel(item.state)}
                  </StatusPill>
                </div>
                <h3 className="mt-3 break-words text-base font-black text-white">
                  {item.workItem?.title ?? "Missing work item"}
                </h3>
                {item.workItem?.description ? (
                  <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-400">{item.workItem.description}</p>
                ) : null}
              </div>
              <div className="flex shrink-0 gap-2">
                <button className="orbit-icon-button" onClick={() => onComplete(item.id)} type="button" aria-label={`Complete ${item.workItem?.title ?? "item"}`}>
                  {item.state === "completed" ? <CheckCircle2 size={16} /> : <Circle size={16} />}
                </button>
                <button className="orbit-icon-button" onClick={() => onSkip(item.id)} type="button" aria-label={`Skip ${item.workItem?.title ?? "item"}`}>
                  <SkipForward size={16} />
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
```

- [ ] **Step 4: Implement `MissionMomentum`**

Create `src/features/daily/mission-momentum.tsx`:

```tsx
import { OrbitProgressRing } from "../../components/space-visuals";
import { calculateDailyPlanSummary } from "./daily-plan.utils";
import type { DailyPlanItemWithWorkItem } from "./daily-plan.queries";

export function MissionMomentum({ items }: { items: DailyPlanItemWithWorkItem[] }) {
  const summary = calculateDailyPlanSummary(items);

  return (
    <section className="orbit-panel rounded-lg p-5">
      <p className="mission-label">Mission Momentum</p>
      <div className="mt-4 grid place-items-center">
        <OrbitProgressRing label="Today" value={summary.completionPercent} />
      </div>
      <p className="mt-4 text-center text-sm font-semibold text-cyan-100">
        {summary.completionPercent}% complete
      </p>
      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-md bg-white/5 p-2">
          <p className="text-lg font-black text-white">{summary.completed}</p>
          <p className="text-[0.65rem] uppercase tracking-[0.12em] text-slate-500">Done</p>
        </div>
        <div className="rounded-md bg-white/5 p-2">
          <p className="text-lg font-black text-white">{summary.planned}</p>
          <p className="text-[0.65rem] uppercase tracking-[0.12em] text-slate-500">Planned</p>
        </div>
        <div className="rounded-md bg-white/5 p-2">
          <p className="text-lg font-black text-white">{summary.skipped}</p>
          <p className="text-[0.65rem] uppercase tracking-[0.12em] text-slate-500">Skipped</p>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 5: Wire components and mutations into the page**

In `daily-mission-control-page.tsx`, add imports:

```tsx
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { FlightPlan } from "./flight-plan";
import { MissionMomentum } from "./mission-momentum";
import { completeDailyPlanItem, skipDailyPlanItem } from "./daily-plan.queries";
```

Inside the component:

```tsx
const queryClient = useQueryClient();
const queryKey = ["daily-mission-control", workspaceId, planDate] as const;

const completeMutation = useMutation({
  mutationFn: (id: string) => {
    if (!workspaceId) throw new Error("Choose a workspace before completing daily work.");
    return completeDailyPlanItem(supabase, { id, workspaceId });
  },
  onSuccess: async () => {
    await queryClient.invalidateQueries({ queryKey });
  },
});

const skipMutation = useMutation({
  mutationFn: (id: string) => {
    if (!workspaceId) throw new Error("Choose a workspace before skipping daily work.");
    return skipDailyPlanItem(supabase, { id, workspaceId });
  },
  onSuccess: async () => {
    await queryClient.invalidateQueries({ queryKey });
  },
});
```

Use `queryKey` in `useQuery`, then replace the initial flight plan and momentum sections:

```tsx
<FlightPlan
  items={dailyQuery.data.dailyPlanItems}
  onComplete={(id) => completeMutation.mutate(id)}
  onSkip={(id) => skipMutation.mutate(id)}
/>
```

```tsx
<MissionMomentum items={dailyQuery.data.dailyPlanItems} />
```

- [ ] **Step 6: Run component tests**

Run:

```powershell
npx.cmd vitest run src/features/daily/daily-mission-control-page.test.tsx
```

Expected: PASS.

- [ ] **Step 7: Commit**

```powershell
git add src/features/daily/flight-plan.tsx src/features/daily/mission-momentum.tsx src/features/daily/daily-mission-control-page.tsx src/features/daily/daily-mission-control-page.test.tsx
git commit -m "Add daily flight plan UI"
```

---

### Task 6: Add Quick Capture Dock

**Files:**
- Create: `src/features/daily/quick-capture-dock.tsx`
- Modify: `src/features/daily/daily-mission-control-page.tsx`
- Modify: `src/features/daily/daily-mission-control-page.test.tsx`

- [ ] **Step 1: Add quick capture test**

Add imports:

```tsx
import userEvent from "@testing-library/user-event";
```

Add test:

```tsx
it("submits a quick capture without leaving the daily cockpit", async () => {
  const user = userEvent.setup();
  dailyMocks.createCapture.mockResolvedValue({ id: "capture-1" });

  renderPage();

  await screen.findByRole("heading", { name: "Daily Mission Control" });
  await user.type(screen.getByLabelText("Capture title"), "Remember pricing page idea");
  await user.click(screen.getByRole("button", { name: "Dock signal" }));

  expect(await screen.findByText("Signal docked.")).toBeVisible();
  expect(dailyMocks.createCapture).toHaveBeenCalled();
});
```

- [ ] **Step 2: Run test to verify failure**

Run:

```powershell
npx.cmd vitest run src/features/daily/daily-mission-control-page.test.tsx
```

Expected: FAIL because Quick Capture form is not implemented.

- [ ] **Step 3: Implement QuickCaptureDock**

Create `src/features/daily/quick-capture-dock.tsx`:

```tsx
import { Lightbulb, Send } from "lucide-react";
import { useState } from "react";
import type { CaptureType } from "../../lib/supabase/database.types";

const captureTypes: CaptureType[] = ["task", "note", "idea", "blocker"];

export function QuickCaptureDock({
  isSubmitting,
  onSubmit,
}: {
  isSubmitting: boolean;
  onSubmit: (input: { type: CaptureType; title: string; body: string }) => void;
}) {
  const [type, setType] = useState<CaptureType>("task");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return;
    onSubmit({ type, title: trimmedTitle, body: body.trim() });
    setTitle("");
    setBody("");
  }

  return (
    <section className="orbit-panel rounded-lg p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="mission-label">Quick Capture</p>
          <h2 className="mt-2 text-lg font-black text-white">Dock a signal</h2>
        </div>
        <Lightbulb className="text-cyan-200" size={18} aria-hidden="true" />
      </div>
      <form className="mt-4 grid gap-3" onSubmit={submit}>
        <label className="grid gap-2 text-sm font-medium text-slate-200">
          Capture title
          <input
            className="rounded-md border border-slate-400/20 bg-slate-950/70 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-500 focus:border-cyan-300/70 focus:ring-2 focus:ring-cyan-300/15"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Task, blocker, idea, or note"
          />
        </label>
        <label className="grid gap-2 text-sm font-medium text-slate-200">
          Type
          <select
            className="rounded-md border border-slate-400/20 bg-slate-950/70 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300/70 focus:ring-2 focus:ring-cyan-300/15"
            value={type}
            onChange={(event) => setType(event.target.value as CaptureType)}
          >
            {captureTypes.map((captureType) => (
              <option key={captureType} value={captureType}>
                {captureType}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-2 text-sm font-medium text-slate-200">
          Signal notes
          <textarea
            className="min-h-24 rounded-md border border-slate-400/20 bg-slate-950/70 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-500 focus:border-cyan-300/70 focus:ring-2 focus:ring-cyan-300/15"
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder="Add context while it is fresh"
          />
        </label>
        <button className="orbit-button justify-center" disabled={isSubmitting || !title.trim()} type="submit">
          <Send size={16} aria-hidden="true" />
          Dock signal
        </button>
      </form>
    </section>
  );
}
```

- [ ] **Step 4: Wire capture mutation**

In `daily-mission-control-page.tsx`, import:

```tsx
import { QuickCaptureDock } from "./quick-capture-dock";
import { createCapture } from "./daily-plan.queries";
```

Add state:

```tsx
const [captureSuccessMessage, setCaptureSuccessMessage] = useState<string | null>(null);
```

Add mutation:

```tsx
const captureMutation = useMutation({
  mutationFn: (input: { type: CaptureType; title: string; body: string }) => {
    if (!workspaceId || !user) throw new Error("Choose a workspace before capturing signals.");
    return createCapture(supabase, {
      workspaceId,
      userId: user.id,
      type: input.type,
      title: input.title,
      body: input.body,
    });
  },
  onSuccess: async () => {
    setCaptureSuccessMessage("Signal docked.");
    await queryClient.invalidateQueries({ queryKey });
  },
});
```

Render in the right column:

```tsx
<QuickCaptureDock
  isSubmitting={captureMutation.isPending}
  onSubmit={(input) => captureMutation.mutate(input)}
/>
{captureSuccessMessage ? (
  <p className="rounded-md border border-cyan-300/20 bg-cyan-300/10 px-3 py-2 text-sm text-cyan-100">
    {captureSuccessMessage}
  </p>
) : null}
{captureMutation.isError ? (
  <p className="rounded-md border border-violet-300/35 bg-violet-400/10 px-3 py-2 text-sm text-violet-100">
    {captureMutation.error.message}
  </p>
) : null}
```

- [ ] **Step 5: Run daily page tests**

Run:

```powershell
npx.cmd vitest run src/features/daily/daily-mission-control-page.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add src/features/daily/quick-capture-dock.tsx src/features/daily/daily-mission-control-page.tsx src/features/daily/daily-mission-control-page.test.tsx
git commit -m "Add quick capture dock"
```

---

### Task 7: Add Focus Session And Daily Review Panels

**Files:**
- Create: `src/features/daily/focus-session-panel.tsx`
- Create: `src/features/daily/daily-review-panel.tsx`
- Modify: `src/features/daily/daily-mission-control-page.tsx`
- Modify: `src/features/daily/daily-mission-control-page.test.tsx`

- [ ] **Step 1: Add focus/review rendering test**

Add test:

```tsx
it("shows focus and review panels after daily data loads", async () => {
  dailyMocks.getDailyMissionControlData.mockResolvedValue({
    plan: { id: "plan-1", workspace_id: "workspace-1", plan_date: "2026-06-29", status: "active", reflection: null, completed_count: 0, skipped_count: 0, created_by: "user-1", created_at: "2026-06-29T00:00:00.000Z", updated_at: "2026-06-29T00:00:00.000Z" },
    dailyPlanItems: [],
    availableWorkItems: [],
    captures: [{ id: "capture-1", title: "Pricing idea", type: "idea", body: null, processed_at: null, workspace_id: "workspace-1", project_id: null, work_item_id: null, created_by: "user-1", created_at: "2026-06-29T00:00:00.000Z", updated_at: "2026-06-29T00:00:00.000Z" }],
    milestones: [],
    projects: [],
  });

  renderPage();

  expect(await screen.findByText("Focus Cockpit")).toBeVisible();
  expect(screen.getByText("Mission Debrief")).toBeVisible();
  expect(screen.getByText("Pricing idea")).toBeVisible();
});
```

- [ ] **Step 2: Run test to verify failure**

Run:

```powershell
npx.cmd vitest run src/features/daily/daily-mission-control-page.test.tsx
```

Expected: FAIL because panels are not implemented.

- [ ] **Step 3: Implement FocusSessionPanel**

Create `src/features/daily/focus-session-panel.tsx`:

```tsx
import { Pause, Play } from "lucide-react";
import type { DailyPlanItemWithWorkItem } from "./daily-plan.queries";
import { getPrimaryDailyItem } from "./daily-plan.utils";

export function FocusSessionPanel({ items }: { items: DailyPlanItemWithWorkItem[] }) {
  const primaryItem = getPrimaryDailyItem(items);

  return (
    <section className="orbit-panel overflow-hidden rounded-lg p-5">
      <p className="mission-label">Focus Cockpit</p>
      <div className="mt-3 rounded-lg border border-cyan-300/20 bg-slate-950/70 p-4">
        <h2 className="text-lg font-black text-white">
          {primaryItem?.workItem?.title ?? "Choose a primary burn"}
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          {primaryItem
            ? "Start a calm focus pass and keep the rest of the cockpit dimmed."
            : "Add an objective to today's flight plan to unlock the focus session."}
        </p>
        <div className="mt-4 flex gap-2">
          <button className="orbit-button" disabled={!primaryItem} type="button">
            <Play size={16} aria-hidden="true" />
            Launch focus
          </button>
          <button className="orbit-button-secondary" disabled={!primaryItem} type="button">
            <Pause size={16} aria-hidden="true" />
            Pause
          </button>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Implement DailyReviewPanel**

Create `src/features/daily/daily-review-panel.tsx`:

```tsx
import type { Database } from "../../lib/supabase/database.types";
import type { DailyPlanItemWithWorkItem } from "./daily-plan.queries";
import { calculateDailyPlanSummary } from "./daily-plan.utils";

type Capture = Database["public"]["Tables"]["captures"]["Row"];

export function DailyReviewPanel({
  captures,
  items,
}: {
  captures: Capture[];
  items: DailyPlanItemWithWorkItem[];
}) {
  const summary = calculateDailyPlanSummary(items);

  return (
    <section className="orbit-panel rounded-lg p-5">
      <p className="mission-label">Mission Debrief</p>
      <h2 className="mt-2 text-lg font-black text-white">Close today's orbit.</h2>
      <p className="mt-2 text-sm leading-6 text-slate-400">
        {summary.completed} completed, {summary.skipped} skipped, {summary.planned} still planned.
      </p>
      <label className="mt-4 grid gap-2 text-sm font-medium text-slate-200">
        What moved forward?
        <textarea
          className="min-h-24 rounded-md border border-slate-400/20 bg-slate-950/70 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-500 focus:border-cyan-300/70 focus:ring-2 focus:ring-cyan-300/15"
          placeholder="Write a short mission reflection"
        />
      </label>
      {captures.length > 0 ? (
        <div className="mt-4">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Captured signals</p>
          <ul className="mt-2 grid gap-2">
            {captures.map((capture) => (
              <li className="rounded-md bg-white/5 px-3 py-2 text-sm text-slate-300" key={capture.id}>
                {capture.title}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
```

- [ ] **Step 5: Wire panels into page**

Import:

```tsx
import { DailyReviewPanel } from "./daily-review-panel";
import { FocusSessionPanel } from "./focus-session-panel";
```

Render under the main grid:

```tsx
<div className="grid gap-5 xl:grid-cols-2">
  <FocusSessionPanel items={dailyQuery.data.dailyPlanItems} />
  <DailyReviewPanel captures={dailyQuery.data.captures} items={dailyQuery.data.dailyPlanItems} />
</div>
```

- [ ] **Step 6: Run daily page tests**

Run:

```powershell
npx.cmd vitest run src/features/daily/daily-mission-control-page.test.tsx
```

Expected: PASS.

- [ ] **Step 7: Commit**

```powershell
git add src/features/daily/focus-session-panel.tsx src/features/daily/daily-review-panel.tsx src/features/daily/daily-mission-control-page.tsx src/features/daily/daily-mission-control-page.test.tsx
git commit -m "Add daily focus and review panels"
```

---

### Task 8: Final Polish, Verification, And PR Update

**Files:**
- Modify: `src/styles.css`
- Modify: `tests/e2e/smoke.spec.ts` only if authenticated coverage is added
- Modify: `docs/superpowers/specs/2026-06-29-daily-mission-control-design.md` only if implementation discovers a necessary scope correction

- [ ] **Step 1: Add motion polish classes**

Append focused, reusable motion classes to `src/styles.css`:

```css
.daily-orbit-pulse {
  position: relative;
}

.daily-orbit-pulse::after {
  content: "";
  position: absolute;
  inset: -1px;
  border-radius: 8px;
  border: 1px solid rgba(34, 211, 238, 0.28);
  opacity: 0.7;
  animation: daily-orbit-pulse 2600ms ease-in-out infinite;
  pointer-events: none;
}

.daily-capture-dock {
  animation: daily-capture-dock 220ms ease-out;
}

@keyframes daily-orbit-pulse {
  0% {
    transform: scale(0.99);
    opacity: 0.35;
  }
  50% {
    transform: scale(1.01);
    opacity: 0.75;
  }
  100% {
    transform: scale(0.99);
    opacity: 0.35;
  }
}

@keyframes daily-capture-dock {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

Apply `daily-orbit-pulse` to the primary flight plan card and `daily-capture-dock` to success/captured signal rows.

- [ ] **Step 2: Run focused tests**

Run:

```powershell
npx.cmd vitest run src/features/daily src/app/App.test.tsx
```

Expected: PASS.

- [ ] **Step 3: Run full unit suite**

Run:

```powershell
$env:VITE_SUPABASE_URL='https://example.supabase.co'
$env:VITE_SUPABASE_PUBLISHABLE_KEY='sb_publishable_example'
npm.cmd test
```

Expected: PASS.

- [ ] **Step 4: Run production build**

Run:

```powershell
$env:VITE_SUPABASE_URL='https://example.supabase.co'
$env:VITE_SUPABASE_PUBLISHABLE_KEY='sb_publishable_example'
npm.cmd run build
```

Expected: PASS. The existing Vite chunk-size warning can remain.

- [ ] **Step 5: Run E2E smoke**

If ports `5173` and `5174` are occupied, use `E2E_PORT=5180`:

```powershell
$env:VITE_SUPABASE_URL='https://example.supabase.co'
$env:VITE_SUPABASE_PUBLISHABLE_KEY='sb_publishable_example'
$env:E2E_PORT='5180'
npm.cmd run e2e
```

Expected: PASS.

- [ ] **Step 6: Visual browser check**

Run a local dev server, open `/`, and verify:

- Daily Mission Control replaces the old dashboard.
- No text overlaps at desktop and mobile widths.
- The primary burn card has subtle motion without distracting from content.
- Quick Capture remains usable by keyboard.
- Empty states have visible action-oriented copy.

- [ ] **Step 7: Commit**

```powershell
git add src/styles.css tests/e2e/smoke.spec.ts docs/superpowers/specs/2026-06-29-daily-mission-control-design.md
git commit -m "Polish Daily Mission Control"
```

If only `src/styles.css` changed, stage and commit only that file:

```powershell
git add src/styles.css
git commit -m "Polish Daily Mission Control"
```

- [ ] **Step 8: Push branch**

```powershell
git push -u origin codex/project-command-center
```

Expected: branch pushes successfully and updates the existing PR.
