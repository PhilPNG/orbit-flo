# Personal vs Shared Boundary Design

**Date:** 2026-08-09
**Status:** Approved

Sub-project B of the collaboration arc, and a **hard gate before sub-project D
(invitations)**. See `2026-08-09-workspace-switching-design.md` for the full
decomposition.

## Problem

Five tables are member-visible *and* member-editable when they should not be:
`daily_plans`, `daily_plan_items`, `weekly_reviews`, `captures`, and `notes`.
Each has a select policy of nothing more than
`private.is_workspace_member(workspace_id)`.

In a one-person workspace that is invisible. The moment a workspace has a
second member, that person can read and rewrite your daily plan, your weekly
review, and your inbox.

It is already producing an untrue statement. `notes-page.tsx:350` renders
*"Private to you. Your signals stay in your orbit."* on workspace-level notes.
Nothing enforces it.

`private_reflections`, `daily_shutdowns`, and `dashboard_widget_preferences`
are already correctly scoped per user, and are the pattern the rest should
follow.

## Classification

| Table | Verdict |
|---|---|
| `daily_plans` | Personal — author only |
| `daily_plan_items` | Personal — through its parent plan |
| `captures` | Personal — a capture inbox is a personal surface |
| `notes` | Split by scope |
| `weekly_reviews` | Split by scope |

**Split by scope** means a row with `project_id is null` is personal to its
author, and a row attached to a project is visible to every member. That keeps
a decision or risk recorded against a shared project visible to the team —
which is the point of recording it — while a half-formed workspace-level idea
stays private. It also matches the existing UI copy.

## Scope

A migration and nothing else. No application code changes:

- Every query already filters by `workspace_id`; RLS narrows the rest.
- The daily-plan get-or-create is select-then-insert with **no `onConflict`**,
  so it keeps working once the select returns only the caller's row.
- No `security definer` function writes any of these five tables, so nothing
  bypasses the new policies.

The full suite passing unchanged is the evidence that no code depended on
cross-user visibility.

## The `daily_plans` schema change

`daily_plans` carries `unique (workspace_id, plan_date)` — one plan per
workspace per day. Two members could not both plan the same day. It becomes
`unique (workspace_id, created_by, plan_date)`.

A unique constraint containing a nullable column does not constrain rows whose
column is null, so `created_by` also becomes `not null`, and its foreign key
changes from `on delete set null` to `on delete cascade`. A personal plan with
no owner is invisible to everyone, so deleting an account should take it rather
than orphan it.

The migration raises if any `daily_plans` row has a null `created_by`, rather
than deleting or reassigning it — the same guard pattern used when dropping
`project_briefs.links`.

**`notes` and `weekly_reviews` keep `created_by` nullable and
`on delete set null`, deliberately.** Cascading there would delete a project
decision the team relies on because its author closed their account. A
workspace-level row whose owner is gone simply becomes invisible, which is the
safe end state for personal data.

`captures` needs no schema change — it has no unique constraint that depends on
ownership.

## Policies

Personal tables (`daily_plans`, `captures`) take the shape
`private_reflections` already uses:

```sql
-- select
using (created_by = (select auth.uid()) and private.is_workspace_member(workspace_id))

-- insert
with check (
  created_by = (select auth.uid())
  and private.has_workspace_role(workspace_id, array['owner', 'admin', 'member']::public.workspace_role[])
)

-- update, delete
using (created_by = (select auth.uid()) and private.is_workspace_member(workspace_id))
```

Scope-split tables (`notes`, `weekly_reviews`):

```sql
using (
  private.is_workspace_member(workspace_id)
  and (project_id is not null or created_by = (select auth.uid()))
)
```

with the same `with check` on insert as the personal tables.

`daily_plan_items` has no `created_by`, so ownership comes through its parent.
That needs a new helper beside the existing ones:

```sql
create or replace function private.owns_daily_plan(target_plan_id uuid)
returns boolean
language sql
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.daily_plans p
    where p.id = target_plan_id
      and p.created_by = (select auth.uid())
  );
$$;
```

granted to `authenticated` and revoked from `public`, matching
`is_workspace_member`. An inline `exists` subquery against `daily_plans` inside
the policy would be evaluated under that table's own RLS and is the kind of
construct that quietly becomes a performance problem.

`daily_plan_items` policies then read
`private.owns_daily_plan(daily_plan_id) and private.is_workspace_member(workspace_id)`.

## Existing data

Every row today was created by the single user, so `created_by` is already
populated and nothing becomes unreachable. The null-`created_by` guard should
pass trivially; if it does not, that is a signal worth stopping for.

## Migration

`supabase/migrations/202608100002_personal_boundary.sql`:

1. Guard: raise if any `daily_plans` row has a null `created_by`.
2. `daily_plans`: `created_by` set `not null`; drop and recreate the FK as
   `on delete cascade`; drop `unique (workspace_id, plan_date)` and add
   `unique (workspace_id, created_by, plan_date)`.
3. Create `private.owns_daily_plan`, revoke from `public`, grant execute to
   `authenticated`.
4. Drop and recreate the select, insert, update, and delete policies on all
   five tables.

Applied by the user with `npx supabase db push`.

## Testing and verification

**RLS cannot be exercised by the test suite.** There is no database in the
vitest environment. This is stated plainly rather than implied away.

What is verified:

- `npm run build` and the full suite pass unchanged, proving no application
  code relied on cross-user visibility.
- The migration applies cleanly, and its guard confirms every `daily_plans` row
  has an owner.
- A browser pass over Today, Inbox, and Brainstorm confirms each still loads
  and writes.

What is **not** verified: that a second member actually cannot see the first
member's rows. Proving isolation needs two real accounts, which cannot be
arranged from here. That is the one open item, and it is worth doing before
sub-project D ships invitations.

## Out of scope

- Any UI change. The "Private to you" line simply becomes true.
- A per-row sharing control. Scope is the only axis.
- Moving a personal note into a project, or the reverse.
- `dashboard_widget_preferences`, `private_reflections`, `daily_shutdowns` —
  already correct.
