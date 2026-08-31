# Recurring Tasks

**Date:** 2026-08-09 · **Branch:** `codex/recurring-tasks` · **Status:** Approved

## Problem

Nothing in the schema expresses repetition. A daily standup or a weekly review has to be recreated by hand every time, which is the one thing a daily-planning tool should not ask of you.

## Decisions

Four choices settled during design, each of which removes work rather than adding it:

1. **A rule spawns a separate task per occurrence.** Last week's review stays completed on its own date, so history and streaks survive and Missions, Calendar and the boards keep working with no changes.
2. **Only today's occurrence is created.** Occurrences you never saw are skipped rather than piling up as overdue. Coming back after a break shows a calm Today, with a quiet catch-up line stating how many were missed.
3. **Occurrences materialise on the day they are due.** No future rows exist, which means a rule change has nothing to reconcile and "edit this one or all future?" never has to be asked.
4. **Four patterns: daily, weekdays, weekly on chosen days, monthly on a day of the month.** No intervals, no end dates.

## Architecture

### Where generation runs

Client-side, on app open, alongside the existing lazy `getOrCreateDailyPlan`. A `pg_cron` job was rejected because it would materialise occurrences on days you never opened the app, contradicting decision 2. A Postgres RPC would be race-proof but buries the logic in plpgsql; the unique constraint below gives idempotency without it.

### Schema — migration `202608090001_recurring_tasks.sql`

New enum `public.recurrence_pattern`: `daily`, `weekdays`, `weekly`, `monthly`.

New table `public.recurrence_rules`, following the house pattern (workspace FK cascade, composite FK to projects, `created_by default auth.uid()` referencing `workspace_members`, `set_updated_at` trigger, member RLS for select/insert/update/delete):

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid pk | |
| `workspace_id` | uuid not null | FK cascade |
| `project_id` | uuid not null | composite FK `(project_id, workspace_id)`; tasks require a project |
| `title` | text not null | inherited by each occurrence, 1–200 chars |
| `description` | text | inherited |
| `priority` | `public.project_priority` not null default `'medium'` | inherited |
| `pattern` | `public.recurrence_pattern` not null | |
| `weekdays` | smallint[] not null default `'{}'` | 0=Sunday … 6=Saturday; used by `weekly` |
| `day_of_month` | smallint | 1–31; used by `monthly` |
| `planned_at` | time | inherited |
| `planned_minutes` | integer | inherited |
| `is_active` | boolean not null default true | pausing sets this false |
| `generated_through` | date | watermark; null means never evaluated |
| `created_by`, `created_at`, `updated_at` | | house pattern |

Check constraints enforce that `weekly` rules carry at least one weekday and that `monthly` rules carry a `day_of_month`.

On `public.work_items`, two columns:

- `recurrence_rule_id uuid` — FK to `recurrence_rules`, `on delete set null`
- `occurrence_date date`
- `unique (recurrence_rule_id, occurrence_date)` — the constraint that makes generation safe to run twice, including from two devices at once

`on delete set null` is deliberate: deleting a rule must not delete work you already did.

On `public.daily_plans`, one column: `recurring_missed_count integer not null default 0`.

### The catch-up count needs storage

Computing the missed count during generation and rendering it directly does not survive a reload — the watermark has already advanced, so the second computation returns zero. It is therefore persisted to `daily_plans.recurring_missed_count`, which shares the exact workspace-and-date grain that generation runs at, survives reloads, and disappears on its own tomorrow.

### `src/features/recurrence/recurrence.utils.ts` — pure logic

```ts
export interface RecurrenceRule {
  id: string;
  pattern: "daily" | "weekdays" | "weekly" | "monthly";
  weekdays: number[];
  dayOfMonth: number | null;
}

export function matchesRecurrence(rule: RecurrenceRule, dateKey: string): boolean;
export function countMissedOccurrences(
  rule: RecurrenceRule,
  afterKey: string | null,
  throughKey: string,
): number;
```

`matchesRecurrence` answers whether the rule fires on a given `YYYY-MM-DD`. Weekday numbers match `Date.getDay()`, so 0 is Sunday.

`countMissedOccurrences` counts matching dates strictly after `afterKey` and strictly before `throughKey`, so today itself is never counted as missed. `afterKey` is nullable and returns zero when null: a rule created moments ago has not missed anything.

**Monthly clamping.** A rule set to day 31 fires on the last day of shorter months, so February sees it on the 28th or 29th. Without clamping such a rule would silently never fire.

Both functions are pure and carry the bulk of the tests.

### `src/features/recurrence/recurrence.queries.ts` — persistence

```ts
export async function listRecurrenceRules(client, workspaceId, projectId);
export async function createRecurrenceRule(client, input);
export async function updateRecurrenceRule(client, input);
export async function deleteRecurrenceRule(client, { id, workspaceId });
export async function ensureRecurringOccurrences(
  client, workspaceId: string, todayKey: string, userId: string,
): Promise<{ created: number; missed: number }>;
```

`ensureRecurringOccurrences` loads active rules for the workspace, and for each rule whose `generated_through` is null or earlier than today:

1. Counts missed occurrences between the watermark and today.
2. Inserts today's occurrence when the pattern matches, inheriting title, description, priority, planned time and duration, with `status: "ready"`, `due_date: todayKey`, and the rule id and occurrence date set. Unique-violation errors are swallowed, since they mean another device won the race.
3. Advances `generated_through` to today.

It returns the totals, and the caller writes `missed` to today's `daily_plans` row **only when `missed` is above zero**. Generation runs on every app open, and by the second run of the day every watermark already reaches today, so `missed` is zero — writing that unconditionally would erase the count computed on the first run.

### Wiring

Today's `missionControlQuery` already calls `getOrCreateDailyPlan` before fetching. `ensureRecurringOccurrences` runs immediately after it, so occurrences exist before the day's data is read. When it reports missed occurrences, the daily plan row is updated and Today renders a quiet line beneath the headline: *"3 recurring tasks were missed while you were away."*

Rules are managed from a **Recurring tasks** panel in the project workspace, matching the existing Templates and Rituals panels: a list of rules with their pattern summarised in words ("Weekly on Mon, Thu"), plus add, edit, pause and delete.

## Testing

- `matchesRecurrence`: each of the four patterns; weekday sets; month-end clamping for day 31 across February, April and December; an inactive-day miss.
- `countMissedOccurrences`: excludes today; returns zero for a null watermark; counts correctly across a month boundary.
- `ensureRecurringOccurrences`: chainable Supabase mock asserting workspace scoping, that a rule already generated through today is skipped, that the occurrence payload inherits the rule's fields, and that a unique violation is swallowed rather than thrown.
- Panel: renders a rule's pattern summary; creating a rule submits the expected payload; pausing flips `is_active`.
- Today: renders the catch-up line when `recurring_missed_count` is above zero, and omits it at zero.

## Non-goals

Every-N intervals ("every 3 days", "fortnightly"), end dates and occurrence limits, rules spanning projects, and per-occurrence rule overrides. Timezone handling follows the app's existing local-date convention via `formatPlanDate`; no cross-timezone correctness work is in scope.
