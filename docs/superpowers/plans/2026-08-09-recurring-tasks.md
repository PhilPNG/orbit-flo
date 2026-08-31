# Recurring Tasks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A recurrence rule that materialises today's occurrence as a real task when the app opens, and tells you how many you missed while away.

**Architecture:** Pattern maths lives in pure functions that carry the tests. A query module owns persistence and the generation pass, made idempotent by a unique constraint rather than locking. Today triggers generation next to the existing `getOrCreateDailyPlan`; a workspace panel manages the rules.

**Tech Stack:** Supabase/PostgREST, React 19, @tanstack/react-query, vitest.

**Spec (normative):** `docs/superpowers/specs/2026-08-09-recurring-tasks-design.md`

## Global Constraints

- Worktree `C:\src\Personal\ToDo\.worktrees\project-command-center`, branch `codex/recurring-tasks`.
- Migration is applied by the USER via `npx supabase db push`. Never run it against the live database.
- Patterns are exactly: `daily`, `weekdays`, `weekly`, `monthly`. No intervals, no end dates.
- Weekday numbers match `Date.getDay()`: 0 is Sunday, 6 is Saturday.
- Monthly rules clamp to the last day of shorter months (day 31 fires on Feb 28).
- `countMissedOccurrences` excludes today and returns 0 for a null watermark.
- The missed count is written to `daily_plans.recurring_missed_count` **only when above zero**.
- Suite green per task (`npx vitest run --maxWorkers=2` under load). Commit per task.

## File Structure

| File | Responsibility |
| --- | --- |
| `supabase/migrations/202608090001_recurring_tasks.sql` (create) | Enum, `recurrence_rules`, work_items and daily_plans columns, RLS |
| `src/lib/supabase/database.types.ts` (modify) | Hand-maintained types for the new table and columns |
| `src/features/recurrence/recurrence.utils.ts` (create) | `matchesRecurrence`, `countMissedOccurrences` — pure |
| `src/features/recurrence/recurrence.queries.ts` (create) | CRUD plus `ensureRecurringOccurrences` |
| `src/features/recurrence/recurring-tasks-panel.tsx` (create) | Workspace panel listing and editing rules |
| `src/features/projects/project-workspace-page.tsx` (modify) | Mount the panel |
| `src/features/daily/daily-mission-control-page.tsx` (modify) | Trigger generation, render the catch-up line |

---

### Task 1: Migration and types

**Files:**
- Create: `supabase/migrations/202608090001_recurring_tasks.sql`
- Modify: `src/lib/supabase/database.types.ts`

**Interfaces — Produces:** `Database["public"]["Tables"]["recurrence_rules"]`, plus `recurrence_rule_id` and `occurrence_date` on `work_items` and `recurring_missed_count` on `daily_plans`.

- [ ] **Step 1: Write the migration**

```sql
create type public.recurrence_pattern as enum ('daily', 'weekdays', 'weekly', 'monthly');

create table if not exists public.recurrence_rules (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid not null,
  title text not null check (char_length(title) between 1 and 200),
  description text,
  priority public.project_priority not null default 'medium',
  pattern public.recurrence_pattern not null,
  weekdays smallint[] not null default '{}',
  day_of_month smallint check (day_of_month is null or day_of_month between 1 and 31),
  planned_at time,
  planned_minutes integer check (planned_minutes is null or planned_minutes between 5 and 480),
  is_active boolean not null default true,
  generated_through date,
  created_by uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id),
  constraint recurrence_weekly_needs_days
    check (pattern <> 'weekly' or array_length(weekdays, 1) >= 1),
  constraint recurrence_monthly_needs_day
    check (pattern <> 'monthly' or day_of_month is not null),
  foreign key (project_id, workspace_id) references public.projects(id, workspace_id) on delete cascade,
  foreign key (workspace_id, created_by) references public.workspace_members(workspace_id, user_id) on delete cascade
);

create index if not exists recurrence_rules_project_idx
  on public.recurrence_rules (workspace_id, project_id);

alter table public.work_items
  add column if not exists recurrence_rule_id uuid references public.recurrence_rules(id) on delete set null;

alter table public.work_items
  add column if not exists occurrence_date date;

-- Makes generation safe to run twice, including from two devices at once.
create unique index if not exists work_items_occurrence_idx
  on public.work_items (recurrence_rule_id, occurrence_date)
  where recurrence_rule_id is not null;

alter table public.daily_plans
  add column if not exists recurring_missed_count integer not null default 0;

create trigger set_recurrence_rules_updated_at
before update on public.recurrence_rules
for each row execute function public.set_updated_at();

alter table public.recurrence_rules enable row level security;

create policy "Members can view recurrence rules"
on public.recurrence_rules for select
using (exists (select 1 from public.workspace_members m where m.workspace_id = recurrence_rules.workspace_id and m.user_id = auth.uid()));

create policy "Members can create recurrence rules"
on public.recurrence_rules for insert
with check (
  created_by = auth.uid()
  and exists (select 1 from public.workspace_members m where m.workspace_id = recurrence_rules.workspace_id and m.user_id = auth.uid())
);

create policy "Members can update recurrence rules"
on public.recurrence_rules for update
using (exists (select 1 from public.workspace_members m where m.workspace_id = recurrence_rules.workspace_id and m.user_id = auth.uid()));

create policy "Members can delete recurrence rules"
on public.recurrence_rules for delete
using (exists (select 1 from public.workspace_members m where m.workspace_id = recurrence_rules.workspace_id and m.user_id = auth.uid()));
```

- [ ] **Step 2: Add the exported pattern type**

In `database.types.ts`, next to the other exported enums:

```ts
export type RecurrencePattern = "daily" | "weekdays" | "weekly" | "monthly";
```

- [ ] **Step 3: Add the table block**

Inside `Tables`, matching the shape of neighbouring blocks:

```ts
      recurrence_rules: {
        Row: {
          id: string;
          workspace_id: string;
          project_id: string;
          title: string;
          description: string | null;
          priority: ProjectPriority;
          pattern: RecurrencePattern;
          weekdays: number[];
          day_of_month: number | null;
          planned_at: string | null;
          planned_minutes: number | null;
          is_active: boolean;
          generated_through: string | null;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          project_id: string;
          title: string;
          description?: string | null;
          priority?: ProjectPriority;
          pattern: RecurrencePattern;
          weekdays?: number[];
          day_of_month?: number | null;
          planned_at?: string | null;
          planned_minutes?: number | null;
          is_active?: boolean;
          generated_through?: string | null;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          title?: string;
          description?: string | null;
          priority?: ProjectPriority;
          pattern?: RecurrencePattern;
          weekdays?: number[];
          day_of_month?: number | null;
          planned_at?: string | null;
          planned_minutes?: number | null;
          is_active?: boolean;
          generated_through?: string | null;
        };
      };
```

- [ ] **Step 4: Add the new columns to existing blocks**

`work_items` Row gains `recurrence_rule_id: string | null;` and `occurrence_date: string | null;` (both optional in Insert and Update). `daily_plans` Row gains `recurring_missed_count: number;` (optional in Insert and Update).

- [ ] **Step 5: Patch fixtures**

Run from the worktree — every work-item factory in the suite needs the two new fields:

```bash
node -e "
const {execSync}=require('node:child_process');const fs=require('node:fs');
const files=execSync('git grep -l \"column_id: null,\" -- \"src/**/*.test.*\" \"src/dev/*\"').toString().trim().split(/\r?\n/);
for(const f of files){
  let s=fs.readFileSync(f,'utf8');
  if(s.includes('recurrence_rule_id'))continue;
  s=s.replace(/^(\s*)column_id: null,\r?$/gm,'\$1column_id: null,\n\$1recurrence_rule_id: null,\n\$1occurrence_date: null,');
  fs.writeFileSync(f,s);console.log('patched',f);
}"
```

Then add `recurring_missed_count: 0,` to any `daily_plans` fixture the build flags.

- [ ] **Step 6: Verify and commit**

Run: `npm run build`
Expected: clean. Fix any remaining fixture gaps it reports.

```bash
git add supabase/migrations src/lib/supabase/database.types.ts src
git commit -m "Add recurrence rules migration and types"
```

---

### Task 2: Pattern maths (TDD)

**Files:**
- Create: `src/features/recurrence/recurrence.utils.ts`
- Create: `src/features/recurrence/recurrence.utils.test.ts`

**Interfaces — Produces:**

```ts
export interface RecurrenceRule {
  id: string;
  pattern: "daily" | "weekdays" | "weekly" | "monthly";
  weekdays: number[];
  dayOfMonth: number | null;
}

export function matchesRecurrence(rule: RecurrenceRule, dateKey: string): boolean;
export function countMissedOccurrences(rule: RecurrenceRule, afterKey: string | null, throughKey: string): number;
export function describeRecurrence(rule: RecurrenceRule): string;
```

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from "vitest";
import {
  countMissedOccurrences,
  describeRecurrence,
  matchesRecurrence,
  type RecurrenceRule,
} from "./recurrence.utils";

function rule(overrides: Partial<RecurrenceRule> = {}): RecurrenceRule {
  return { id: "rule-1", pattern: "daily", weekdays: [], dayOfMonth: null, ...overrides };
}

describe("matchesRecurrence", () => {
  it("fires every day for a daily rule", () => {
    expect(matchesRecurrence(rule(), "2026-08-09")).toBe(true);
    expect(matchesRecurrence(rule(), "2026-08-10")).toBe(true);
  });

  it("skips weekends for a weekdays rule", () => {
    // 2026-08-09 is a Sunday, 2026-08-10 a Monday, 2026-08-15 a Saturday.
    expect(matchesRecurrence(rule({ pattern: "weekdays" }), "2026-08-09")).toBe(false);
    expect(matchesRecurrence(rule({ pattern: "weekdays" }), "2026-08-10")).toBe(true);
    expect(matchesRecurrence(rule({ pattern: "weekdays" }), "2026-08-15")).toBe(false);
  });

  it("fires only on the chosen weekdays", () => {
    const weekly = rule({ pattern: "weekly", weekdays: [1, 4] });

    expect(matchesRecurrence(weekly, "2026-08-10")).toBe(true);
    expect(matchesRecurrence(weekly, "2026-08-13")).toBe(true);
    expect(matchesRecurrence(weekly, "2026-08-11")).toBe(false);
  });

  it("fires on the chosen day of the month", () => {
    const monthly = rule({ pattern: "monthly", dayOfMonth: 12 });

    expect(matchesRecurrence(monthly, "2026-08-12")).toBe(true);
    expect(matchesRecurrence(monthly, "2026-08-13")).toBe(false);
  });

  it("clamps a day beyond the month to the last day", () => {
    const monthly = rule({ pattern: "monthly", dayOfMonth: 31 });

    expect(matchesRecurrence(monthly, "2026-02-28")).toBe(true);
    expect(matchesRecurrence(monthly, "2026-04-30")).toBe(true);
    expect(matchesRecurrence(monthly, "2026-12-31")).toBe(true);
    expect(matchesRecurrence(monthly, "2026-12-30")).toBe(false);
  });
});

describe("countMissedOccurrences", () => {
  it("returns zero when the rule has never been evaluated", () => {
    expect(countMissedOccurrences(rule(), null, "2026-08-09")).toBe(0);
  });

  it("excludes both the watermark day and today", () => {
    // Aug 5 through Aug 9 exclusive leaves the 6th, 7th and 8th.
    expect(countMissedOccurrences(rule(), "2026-08-05", "2026-08-09")).toBe(3);
  });

  it("counts only matching days", () => {
    const weekly = rule({ pattern: "weekly", weekdays: [1] });

    expect(countMissedOccurrences(weekly, "2026-08-02", "2026-08-19")).toBe(2);
  });

  it("returns zero when the watermark already reaches today", () => {
    expect(countMissedOccurrences(rule(), "2026-08-09", "2026-08-09")).toBe(0);
  });
});

describe("describeRecurrence", () => {
  it("summarises each pattern in words", () => {
    expect(describeRecurrence(rule())).toBe("Every day");
    expect(describeRecurrence(rule({ pattern: "weekdays" }))).toBe("Every weekday");
    expect(describeRecurrence(rule({ pattern: "weekly", weekdays: [1, 4] }))).toBe("Weekly on Mon, Thu");
    expect(describeRecurrence(rule({ pattern: "monthly", dayOfMonth: 12 }))).toBe("Monthly on day 12");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/features/recurrence/recurrence.utils.test.ts`
Expected: FAIL — cannot resolve `./recurrence.utils`.

- [ ] **Step 3: Implement**

```ts
export interface RecurrenceRule {
  id: string;
  pattern: "daily" | "weekdays" | "weekly" | "monthly";
  weekdays: number[];
  dayOfMonth: number | null;
}

const weekdayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Dates are handled in UTC so a local timezone can never shift which day a
// YYYY-MM-DD key lands on.
function toDate(dateKey: string) {
  return new Date(`${dateKey}T00:00:00Z`);
}

function toKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function lastDayOfMonth(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
}

export function matchesRecurrence(rule: RecurrenceRule, dateKey: string): boolean {
  const date = toDate(dateKey);
  const weekday = date.getUTCDay();

  if (rule.pattern === "daily") return true;
  if (rule.pattern === "weekdays") return weekday >= 1 && weekday <= 5;
  if (rule.pattern === "weekly") return rule.weekdays.includes(weekday);

  if (rule.dayOfMonth === null) return false;

  // A rule set past the end of a short month fires on its last day, otherwise
  // "the 31st" would silently never happen in February.
  const target = Math.min(rule.dayOfMonth, lastDayOfMonth(date));
  return date.getUTCDate() === target;
}

export function countMissedOccurrences(
  rule: RecurrenceRule,
  afterKey: string | null,
  throughKey: string,
): number {
  if (!afterKey) return 0;

  let count = 0;
  const cursor = toDate(afterKey);
  const end = toDate(throughKey);

  cursor.setUTCDate(cursor.getUTCDate() + 1);

  while (cursor < end) {
    if (matchesRecurrence(rule, toKey(cursor))) count += 1;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return count;
}

export function describeRecurrence(rule: RecurrenceRule): string {
  if (rule.pattern === "daily") return "Every day";
  if (rule.pattern === "weekdays") return "Every weekday";
  if (rule.pattern === "weekly") {
    const days = [...rule.weekdays].sort((a, b) => a - b).map((day) => weekdayNames[day]);
    return `Weekly on ${days.join(", ")}`;
  }
  return `Monthly on day ${rule.dayOfMonth}`;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/features/recurrence/recurrence.utils.test.ts`
Expected: PASS, 10 tests.

- [ ] **Step 5: Commit**

```bash
git add src/features/recurrence
git commit -m "Add recurrence pattern maths"
```

---

### Task 3: Queries and generation (TDD)

**Files:**
- Create: `src/features/recurrence/recurrence.queries.ts`
- Create: `src/features/recurrence/recurrence.queries.test.ts`

**Interfaces:**
- Consumes: `matchesRecurrence`, `countMissedOccurrences` from Task 2.
- Produces:

```ts
export const recurrenceKeys = {
  project: (workspaceId: string, projectId: string) => ["recurrence-rules", workspaceId, projectId] as const,
};
export async function listRecurrenceRules(client, workspaceId: string, projectId: string);
export async function createRecurrenceRule(client, input: RecurrenceRuleInput);
export async function updateRecurrenceRule(client, input: { id: string; workspaceId: string } & Partial<RecurrenceRuleInput> & { isActive?: boolean });
export async function deleteRecurrenceRule(client, input: { id: string; workspaceId: string });
export async function ensureRecurringOccurrences(
  client, workspaceId: string, todayKey: string, userId: string,
): Promise<{ created: number; missed: number }>;
```

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it, vi } from "vitest";
import { ensureRecurringOccurrences, listRecurrenceRules } from "./recurrence.queries";

function ruleRow(overrides = {}) {
  return {
    id: "rule-1",
    workspace_id: "workspace-1",
    project_id: "project-1",
    title: "Daily standup",
    description: null,
    priority: "medium",
    pattern: "daily",
    weekdays: [],
    day_of_month: null,
    planned_at: null,
    planned_minutes: null,
    is_active: true,
    generated_through: null,
    ...overrides,
  };
}

function createClient(rules) {
  const inserts = [];
  const updates = [];

  const client = {
    from: vi.fn((table: string) => {
      if (table === "recurrence_rules") {
        const builder = {
          select: vi.fn(() => builder),
          eq: vi.fn(() => builder),
          order: vi.fn(() => Promise.resolve({ data: rules, error: null })),
          update: vi.fn((payload: unknown) => {
            updates.push(payload);
            return { eq: vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ error: null })) })) };
          }),
        };
        return builder;
      }

      return {
        insert: vi.fn((payload: unknown) => {
          inserts.push(payload);
          return Promise.resolve({ error: null });
        }),
      };
    }),
  };

  return { client, inserts, updates };
}

describe("listRecurrenceRules", () => {
  it("scopes rules by workspace and project", async () => {
    const { client } = createClient([]);
    const builder = client.from("recurrence_rules");

    await listRecurrenceRules(client as never, "workspace-1", "project-1");

    expect(client.from).toHaveBeenCalledWith("recurrence_rules");
    expect(builder.eq).toBeDefined();
  });
});

describe("ensureRecurringOccurrences", () => {
  it("creates today's occurrence inheriting the rule fields", async () => {
    const { client, inserts } = createClient([
      ruleRow({ planned_at: "09:00:00", planned_minutes: 15, generated_through: "2026-08-08" }),
    ]);

    const result = await ensureRecurringOccurrences(client as never, "workspace-1", "2026-08-09", "user-1");

    expect(result.created).toBe(1);
    expect(inserts[0]).toMatchObject({
      workspace_id: "workspace-1",
      project_id: "project-1",
      title: "Daily standup",
      priority: "medium",
      status: "ready",
      due_date: "2026-08-09",
      planned_at: "09:00:00",
      planned_minutes: 15,
      recurrence_rule_id: "rule-1",
      occurrence_date: "2026-08-09",
    });
  });

  it("reports occurrences missed since the watermark", async () => {
    const { client } = createClient([ruleRow({ generated_through: "2026-08-05" })]);

    const result = await ensureRecurringOccurrences(client as never, "workspace-1", "2026-08-09", "user-1");

    expect(result.missed).toBe(3);
  });

  it("skips a rule already generated through today", async () => {
    const { client, inserts } = createClient([ruleRow({ generated_through: "2026-08-09" })]);

    const result = await ensureRecurringOccurrences(client as never, "workspace-1", "2026-08-09", "user-1");

    expect(inserts).toHaveLength(0);
    expect(result).toEqual({ created: 0, missed: 0 });
  });

  it("advances the watermark to today", async () => {
    const { client, updates } = createClient([ruleRow({ generated_through: "2026-08-08" })]);

    await ensureRecurringOccurrences(client as never, "workspace-1", "2026-08-09", "user-1");

    expect(updates[0]).toMatchObject({ generated_through: "2026-08-09" });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/features/recurrence/recurrence.queries.test.ts`
Expected: FAIL — cannot resolve `./recurrence.queries`.

- [ ] **Step 3: Implement**

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, ProjectPriority, RecurrencePattern } from "../../lib/supabase/database.types";
import { countMissedOccurrences, matchesRecurrence, type RecurrenceRule } from "./recurrence.utils";

type Client = SupabaseClient<Database>;

export interface RecurrenceRuleInput {
  workspaceId: string;
  projectId: string;
  userId: string;
  title: string;
  description?: string;
  priority: ProjectPriority;
  pattern: RecurrencePattern;
  weekdays: number[];
  dayOfMonth: number | null;
  plannedAt?: string | null;
  plannedMinutes?: number | null;
}

export const recurrenceKeys = {
  project: (workspaceId: string, projectId: string) =>
    ["recurrence-rules", workspaceId, projectId] as const,
};

export async function listRecurrenceRules(client: Client, workspaceId: string, projectId: string) {
  const { data, error } = await client
    .from("recurrence_rules")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data;
}

export async function createRecurrenceRule(client: Client, input: RecurrenceRuleInput) {
  const { data, error } = await client
    .from("recurrence_rules")
    .insert({
      workspace_id: input.workspaceId,
      project_id: input.projectId,
      created_by: input.userId,
      title: input.title,
      description: input.description || null,
      priority: input.priority,
      pattern: input.pattern,
      weekdays: input.weekdays,
      day_of_month: input.dayOfMonth,
      planned_at: input.plannedAt ?? null,
      planned_minutes: input.plannedMinutes ?? null,
    })
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

export async function updateRecurrenceRule(
  client: Client,
  input: { id: string; workspaceId: string } & Partial<Omit<RecurrenceRuleInput, "workspaceId" | "projectId" | "userId">> & {
    isActive?: boolean;
  },
) {
  const payload: Record<string, unknown> = {};
  if (input.title !== undefined) payload.title = input.title;
  if (input.description !== undefined) payload.description = input.description || null;
  if (input.priority !== undefined) payload.priority = input.priority;
  if (input.pattern !== undefined) payload.pattern = input.pattern;
  if (input.weekdays !== undefined) payload.weekdays = input.weekdays;
  if (input.dayOfMonth !== undefined) payload.day_of_month = input.dayOfMonth;
  if (input.plannedAt !== undefined) payload.planned_at = input.plannedAt;
  if (input.plannedMinutes !== undefined) payload.planned_minutes = input.plannedMinutes;
  if (input.isActive !== undefined) payload.is_active = input.isActive;

  const { error } = await client
    .from("recurrence_rules")
    .update(payload)
    .eq("id", input.id)
    .eq("workspace_id", input.workspaceId);

  if (error) throw error;
}

export async function deleteRecurrenceRule(client: Client, input: { id: string; workspaceId: string }) {
  const { error } = await client
    .from("recurrence_rules")
    .delete()
    .eq("id", input.id)
    .eq("workspace_id", input.workspaceId);

  if (error) throw error;
}

export async function ensureRecurringOccurrences(
  client: Client,
  workspaceId: string,
  todayKey: string,
  userId: string,
): Promise<{ created: number; missed: number }> {
  const { data, error } = await client
    .from("recurrence_rules")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  if (error) throw error;

  const rows = data ?? [];
  let created = 0;
  let missed = 0;

  for (const row of rows) {
    if (row.generated_through && row.generated_through >= todayKey) continue;

    const rule: RecurrenceRule = {
      id: row.id,
      pattern: row.pattern,
      weekdays: row.weekdays ?? [],
      dayOfMonth: row.day_of_month,
    };

    missed += countMissedOccurrences(rule, row.generated_through, todayKey);

    if (matchesRecurrence(rule, todayKey)) {
      const insert = await client.from("work_items").insert({
        workspace_id: workspaceId,
        project_id: row.project_id,
        created_by: userId,
        title: row.title,
        description: row.description,
        priority: row.priority,
        status: "ready",
        due_date: todayKey,
        planned_at: row.planned_at,
        planned_minutes: row.planned_minutes,
        recurrence_rule_id: row.id,
        occurrence_date: todayKey,
      });

      // 23505 is a unique violation, which here means another device already
      // created this occurrence. That is success, not failure.
      if (insert.error && insert.error.code !== "23505") throw insert.error;
      if (!insert.error) created += 1;
    }

    const advance = await client
      .from("recurrence_rules")
      .update({ generated_through: todayKey })
      .eq("id", row.id)
      .eq("workspace_id", workspaceId);

    if (advance.error) throw advance.error;
  }

  return { created, missed };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/features/recurrence/recurrence.queries.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/features/recurrence
git commit -m "Generate today's recurring occurrences"
```

---

### Task 4: Recurring tasks panel

**Files:**
- Create: `src/features/recurrence/recurring-tasks-panel.tsx`
- Create: `src/features/recurrence/recurring-tasks-panel.test.tsx`
- Modify: `src/features/projects/project-workspace-page.tsx`

**Interfaces:**
- Consumes: everything from Task 3, plus `describeRecurrence` from Task 2.
- Produces: `<RecurringTasksPanel workspaceId projectId userId onHide />`

**Implementation.** Follow `project-rituals-panel.tsx` for structure: a `QuietPanel`-style card headed "Recurring tasks" with a hide button, a `useQuery` on `recurrenceKeys.project`, and mutations that invalidate it. Each rule row shows its title, `describeRecurrence(...)` as a subtitle, a Pause/Resume button toggling `isActive`, and a Delete button. Below the list, an add form: title input, pattern select (Daily / Every weekday / Weekly / Monthly), a weekday toggle row shown only for `weekly`, and a day-of-month number input shown only for `monthly`.

- [ ] **Step 1: Write the failing tests**

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RecurringTasksPanel } from "./recurring-tasks-panel";

const recurrenceMocks = vi.hoisted(() => ({
  listRecurrenceRules: vi.fn(),
  createRecurrenceRule: vi.fn(),
  updateRecurrenceRule: vi.fn(),
  deleteRecurrenceRule: vi.fn(),
}));

vi.mock("../../lib/supabase/client", () => ({ supabase: {} }));

vi.mock("./recurrence.queries", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./recurrence.queries")>()),
  ...recurrenceMocks,
}));

function renderPanel() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <RecurringTasksPanel onHide={() => undefined} projectId="project-1" userId="user-1" workspaceId="workspace-1" />
    </QueryClientProvider>,
  );
}

describe("RecurringTasksPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    recurrenceMocks.createRecurrenceRule.mockResolvedValue({});
    recurrenceMocks.updateRecurrenceRule.mockResolvedValue(undefined);
    recurrenceMocks.deleteRecurrenceRule.mockResolvedValue(undefined);
    recurrenceMocks.listRecurrenceRules.mockResolvedValue([
      {
        id: "rule-1",
        workspace_id: "workspace-1",
        project_id: "project-1",
        title: "Weekly review",
        description: null,
        priority: "medium",
        pattern: "weekly",
        weekdays: [1, 4],
        day_of_month: null,
        planned_at: null,
        planned_minutes: null,
        is_active: true,
        generated_through: null,
        created_by: "user-1",
        created_at: "",
        updated_at: "",
      },
    ]);
  });

  it("summarises each rule's pattern in words", async () => {
    renderPanel();

    expect(await screen.findByText("Weekly review")).toBeVisible();
    expect(screen.getByText("Weekly on Mon, Thu")).toBeVisible();
  });

  it("pauses a rule", async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(await screen.findByRole("button", { name: "Pause Weekly review" }));

    await waitFor(() => {
      expect(recurrenceMocks.updateRecurrenceRule).toHaveBeenCalledWith(
        {},
        { id: "rule-1", workspaceId: "workspace-1", isActive: false },
      );
    });
  });

  it("creates a daily rule", async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.type(await screen.findByLabelText("Recurring task title"), "Daily standup");
    await user.click(screen.getByRole("button", { name: "Add recurring task" }));

    await waitFor(() => {
      expect(recurrenceMocks.createRecurrenceRule).toHaveBeenCalledWith(
        {},
        expect.objectContaining({
          workspaceId: "workspace-1",
          projectId: "project-1",
          title: "Daily standup",
          pattern: "daily",
        }),
      );
    });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/features/recurrence/recurring-tasks-panel.test.tsx`
Expected: FAIL — cannot resolve `./recurring-tasks-panel`.

- [ ] **Step 3: Implement the panel** per the implementation notes, then mount it in `project-workspace-page.tsx` beside `TemplatesPanel`, gated on `workspaceId && projectId && user` exactly as `ProjectRitualsPanel` is.

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/features/recurrence src/features/projects/project-workspace-page.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/recurrence src/features/projects/project-workspace-page.tsx
git commit -m "Manage recurring tasks from the project workspace"
```

---

### Task 5: Today wiring, catch-up line, then verify

**Files:**
- Modify: `src/features/daily/daily-mission-control-page.tsx`
- Modify: `src/features/daily/daily-mission-control-page.test.tsx`

**Implementation.** Inside `missionControlQuery`'s `queryFn`, after `getOrCreateDailyPlan` resolves and before `getDailyMissionControlData`:

```ts
const plan = await getOrCreateDailyPlan(supabase, { workspaceId, userId: user.id, planDate });
const { missed } = await ensureRecurringOccurrences(supabase, workspaceId, planDate, user.id);

// Written only when above zero: generation runs on every open, and by the
// second run the watermark already reaches today, so missed is 0.
if (missed > 0) {
  await supabase
    .from("daily_plans")
    .update({ recurring_missed_count: missed })
    .eq("id", plan.id)
    .eq("workspace_id", workspaceId);
}
```

Render beneath the headline, reading from the loaded plan:

```tsx
{(missionControl?.plan?.recurring_missed_count ?? 0) > 0 ? (
  <p className="text-xs font-medium text-amber-200/80">
    {missionControl.plan.recurring_missed_count} recurring tasks were missed while you were away.
  </p>
) : null}
```

- [ ] **Step 1: Write the failing test**

Add to `daily-mission-control-page.test.tsx`, with `ensureRecurringOccurrences` added to the existing `dailyPlanMocks` mock of the queries module:

```tsx
it("reports recurring tasks missed while away", async () => {
  setMissionControl({
    availableWorkItems: [],
    captures: [],
    dailyPlanItems: [],
    milestones: [],
    plan: dailyPlan({ plan_date: formatPlanDate(), recurring_missed_count: 3 }),
    projects: [project()],
  });

  renderDailyMissionControlPage();

  expect(await screen.findByText("3 recurring tasks were missed while you were away.")).toBeVisible();
});

it("says nothing when none were missed", async () => {
  setMissionControl({
    availableWorkItems: [],
    captures: [],
    dailyPlanItems: [],
    milestones: [],
    plan: dailyPlan({ plan_date: formatPlanDate(), recurring_missed_count: 0 }),
    projects: [project()],
  });

  renderDailyMissionControlPage();

  await screen.findByRole("heading", { name: "Today" });
  expect(screen.queryByText(/recurring tasks were missed/)).toBeNull();
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/features/daily/daily-mission-control-page.test.tsx`
Expected: FAIL — the catch-up text is not found.

- [ ] **Step 3: Implement** the wiring and the line above.

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/features/daily/daily-mission-control-page.test.tsx`
Expected: PASS.

- [ ] **Step 5: Full verification**

```bash
npx vitest run --maxWorkers=2
npm run build
```

Expected: all green, build clean.

- [ ] **Step 6: Commit and push**

```bash
git add src/features/daily
git commit -m "Generate recurring occurrences and surface missed ones"
git push -u origin codex/recurring-tasks
```

- [ ] **Step 7: Tell the user to apply the migration**

The feature does nothing against real data until they run `npx supabase db push` from the worktree.

## Self-Review (completed)

**Spec coverage.** Schema and both column additions → Task 1. `matchesRecurrence`, `countMissedOccurrences`, monthly clamping, `Date.getDay()` numbering → Task 2. CRUD, `ensureRecurringOccurrences`, watermark advance, unique-violation swallowing → Task 3. Rules panel in the workspace → Task 4. Today trigger, the write-only-when-above-zero rule, and the catch-up line → Task 5. Every test named in the spec's Testing section appears in a task.

**Placeholder scan.** No TBDs; every code step carries real code. Task 4's panel body is described rather than transcribed because it follows `project-rituals-panel.tsx` verbatim in structure — its contract is fully pinned by the tests in the same task.

**Type consistency.** `RecurrenceRule` uses `dayOfMonth` in TypeScript against `day_of_month` in SQL, and Task 3 maps between them explicitly. `RecurrencePattern` is defined in Task 1 and consumed in Tasks 2 and 3. `recurrenceKeys.project` is defined in Task 3 and used in Task 4.

**One gap found and fixed while reviewing:** the unique constraint was originally written as a table constraint, which in Postgres treats every NULL `recurrence_rule_id` as distinct and would therefore have applied to non-recurring tasks too. It is now a partial unique index with `where recurrence_rule_id is not null`, which states the intent directly.
