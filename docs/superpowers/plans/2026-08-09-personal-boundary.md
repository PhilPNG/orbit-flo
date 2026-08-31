# Personal vs Shared Boundary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make five member-visible tables respect ownership, so a second workspace member cannot read or rewrite the first member's daily plan, inbox, or private notes.

**Architecture:** One migration. Personal tables gain author-scoped RLS matching the shape `private_reflections` already uses; `notes` and `weekly_reviews` split by scope; `daily_plan_items` gains a `private.owns_daily_plan` helper because it has no `created_by` of its own. `daily_plans` also needs a schema change, because its unique constraint assumed one plan per workspace per day.

**Tech Stack:** PostgreSQL, Supabase RLS, Supabase CLI.

**Spec:** `docs/superpowers/specs/2026-08-09-personal-boundary-design.md`

## Global Constraints

- **No application code changes.** If any turn out to be needed, stop — it means an assumption in the spec was wrong.
- Keep `unique (id, workspace_id)` on `daily_plans`. Two foreign keys depend on it (`daily_plan_items` and the `202607010002` reference).
- `notes` and `weekly_reviews` keep `created_by` nullable and `on delete set null`. Only `daily_plans` becomes `not null` + cascade.
- Drop constraints by their exact name, without `if exists` — a wrong name must fail loudly rather than silently leave the old constraint in place.
- Commit trailer: `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`
- The migration is applied by the USER via `npx supabase db push`.

---

### Task 1: The migration

**Files:**
- Create: `supabase/migrations/202608100002_personal_boundary.sql`

**Interfaces:**
- Produces: `private.owns_daily_plan(uuid) returns boolean`, and author-scoped policies on `daily_plans`, `daily_plan_items`, `captures`, `notes`, `weekly_reviews`.

- [ ] **Step 1: Write the guard and the `daily_plans` schema change**

Create `supabase/migrations/202608100002_personal_boundary.sql`:

```sql
-- Five tables were member-visible and member-editable when they should not be.
-- Invisible in a one-person workspace; a privacy leak the moment there are two.

-- 1. A personal row with no owner would be invisible to everyone, and a unique
--    constraint containing a nullable column does not constrain null rows at
--    all. Fail loudly rather than delete or reassign.
do $$
declare
  unowned integer;
begin
  select count(*) into unowned
  from public.daily_plans
  where created_by is null;

  if unowned > 0 then
    raise exception
      'daily_plans has % row(s) with no created_by; assign an owner before scoping the table',
      unowned;
  end if;
end
$$;

alter table public.daily_plans alter column created_by set not null;

-- Deleting an account should take its personal plans, not orphan them.
alter table public.daily_plans drop constraint daily_plans_created_by_fkey;
alter table public.daily_plans
  add constraint daily_plans_created_by_fkey
  foreign key (created_by) references auth.users(id) on delete cascade;

-- One plan per person per day, not one per workspace per day. The composite
-- unique (id, workspace_id) stays: two foreign keys depend on it.
alter table public.daily_plans drop constraint daily_plans_workspace_id_plan_date_key;
alter table public.daily_plans
  add constraint daily_plans_workspace_id_created_by_plan_date_key
  unique (workspace_id, created_by, plan_date);
```

- [ ] **Step 2: Add the ownership helper**

Append:

```sql
-- daily_plan_items has no created_by; ownership comes through its parent. A
-- security-definer helper matches private.is_workspace_member and avoids an
-- inline subquery that would be evaluated under daily_plans' own RLS.
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

revoke all on function private.owns_daily_plan(uuid) from public;
grant execute on function private.owns_daily_plan(uuid) to authenticated;
```

- [ ] **Step 3: Re-scope the personal tables**

Append:

```sql
-- 2. daily_plans — author only.
drop policy "Members can view daily plans" on public.daily_plans;
drop policy "Members can create daily plans" on public.daily_plans;
drop policy "Members can update daily plans" on public.daily_plans;
drop policy "Owners and admins can delete daily plans" on public.daily_plans;

create policy "Authors can view their daily plans"
on public.daily_plans
for select
to authenticated
using (created_by = (select auth.uid()) and private.is_workspace_member(workspace_id));

create policy "Members can create their own daily plans"
on public.daily_plans
for insert
to authenticated
with check (
  created_by = (select auth.uid())
  and private.has_workspace_role(workspace_id, array['owner', 'admin', 'member']::public.workspace_role[])
);

create policy "Authors can update their daily plans"
on public.daily_plans
for update
to authenticated
using (created_by = (select auth.uid()) and private.is_workspace_member(workspace_id))
with check (created_by = (select auth.uid()) and private.is_workspace_member(workspace_id));

create policy "Authors can delete their daily plans"
on public.daily_plans
for delete
to authenticated
using (created_by = (select auth.uid()) and private.is_workspace_member(workspace_id));

-- 3. daily_plan_items — through the parent plan.
drop policy "Members can view daily plan items" on public.daily_plan_items;
drop policy "Members can create daily plan items" on public.daily_plan_items;
drop policy "Members can update daily plan items" on public.daily_plan_items;
drop policy "Owners and admins can delete daily plan items" on public.daily_plan_items;

create policy "Authors can view their daily plan items"
on public.daily_plan_items
for select
to authenticated
using (private.owns_daily_plan(daily_plan_id) and private.is_workspace_member(workspace_id));

create policy "Authors can create their daily plan items"
on public.daily_plan_items
for insert
to authenticated
with check (private.owns_daily_plan(daily_plan_id) and private.is_workspace_member(workspace_id));

create policy "Authors can update their daily plan items"
on public.daily_plan_items
for update
to authenticated
using (private.owns_daily_plan(daily_plan_id) and private.is_workspace_member(workspace_id))
with check (private.owns_daily_plan(daily_plan_id) and private.is_workspace_member(workspace_id));

create policy "Authors can delete their daily plan items"
on public.daily_plan_items
for delete
to authenticated
using (private.owns_daily_plan(daily_plan_id) and private.is_workspace_member(workspace_id));

-- 4. captures — a capture inbox is a personal surface.
drop policy "Members can view captures" on public.captures;
drop policy "Members can create captures" on public.captures;
drop policy "Members can update captures" on public.captures;
drop policy "Owners and admins can delete captures" on public.captures;

create policy "Authors can view their captures"
on public.captures
for select
to authenticated
using (created_by = (select auth.uid()) and private.is_workspace_member(workspace_id));

create policy "Members can create their own captures"
on public.captures
for insert
to authenticated
with check (
  created_by = (select auth.uid())
  and private.has_workspace_role(workspace_id, array['owner', 'admin', 'member']::public.workspace_role[])
);

create policy "Authors can update their captures"
on public.captures
for update
to authenticated
using (created_by = (select auth.uid()) and private.is_workspace_member(workspace_id))
with check (created_by = (select auth.uid()) and private.is_workspace_member(workspace_id));

create policy "Authors can delete their captures"
on public.captures
for delete
to authenticated
using (created_by = (select auth.uid()) and private.is_workspace_member(workspace_id));
```

- [ ] **Step 4: Split `notes` and `weekly_reviews` by scope**

Append:

```sql
-- 5. notes — a project note is team knowledge; a workspace note is a private
--    thought. The Brainstorm page already promises the latter.
drop policy "Members can view notes" on public.notes;
drop policy "Members can create notes" on public.notes;
drop policy "Members can update notes" on public.notes;
drop policy "Owners and admins can delete notes" on public.notes;

create policy "Members can view project notes and their own"
on public.notes
for select
to authenticated
using (
  private.is_workspace_member(workspace_id)
  and (project_id is not null or created_by = (select auth.uid()))
);

create policy "Members can create their own notes"
on public.notes
for insert
to authenticated
with check (
  created_by = (select auth.uid())
  and private.has_workspace_role(workspace_id, array['owner', 'admin', 'member']::public.workspace_role[])
);

create policy "Members can update project notes and their own"
on public.notes
for update
to authenticated
using (
  private.is_workspace_member(workspace_id)
  and (project_id is not null or created_by = (select auth.uid()))
)
with check (
  private.is_workspace_member(workspace_id)
  and (project_id is not null or created_by = (select auth.uid()))
);

create policy "Members can delete project notes and their own"
on public.notes
for delete
to authenticated
using (
  private.is_workspace_member(workspace_id)
  and (project_id is not null or created_by = (select auth.uid()))
);

-- 6. weekly_reviews — same rule.
drop policy "Members can view weekly reviews" on public.weekly_reviews;
drop policy "Members can create weekly reviews" on public.weekly_reviews;
drop policy "Members can update weekly reviews" on public.weekly_reviews;
drop policy "Owners and admins can delete weekly reviews" on public.weekly_reviews;

create policy "Members can view project reviews and their own"
on public.weekly_reviews
for select
to authenticated
using (
  private.is_workspace_member(workspace_id)
  and (project_id is not null or created_by = (select auth.uid()))
);

create policy "Members can create their own weekly reviews"
on public.weekly_reviews
for insert
to authenticated
with check (
  created_by = (select auth.uid())
  and private.has_workspace_role(workspace_id, array['owner', 'admin', 'member']::public.workspace_role[])
);

create policy "Members can update project reviews and their own"
on public.weekly_reviews
for update
to authenticated
using (
  private.is_workspace_member(workspace_id)
  and (project_id is not null or created_by = (select auth.uid()))
)
with check (
  private.is_workspace_member(workspace_id)
  and (project_id is not null or created_by = (select auth.uid()))
);

create policy "Members can delete project reviews and their own"
on public.weekly_reviews
for delete
to authenticated
using (
  private.is_workspace_member(workspace_id)
  and (project_id is not null or created_by = (select auth.uid()))
);
```

- [ ] **Step 5: Check it against the existing schema**

Read `202606280001_initial_project_command_center.sql` and
`202606290001_daily_mission_control.sql` and confirm:

- The four policy names dropped per table match exactly what was created. A
  wrong name fails the push, which is the intended behaviour, but catching it
  by reading is cheaper than a round trip.
- `unique (id, workspace_id)` on `daily_plans` is untouched — `daily_plan_items`
  and the `202607010002` reference both depend on it.
- `private.is_workspace_member` and `private.has_workspace_role` are the exact
  helper names and signatures used.
- No `security definer` function writes these five tables, so nothing bypasses
  the new policies.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/202608100002_personal_boundary.sql && git commit -m "feat: scope personal tables to their author"
```

---

### Task 2: Verification and PR

- [ ] **Step 1: Confirm no application code changed**

```bash
git diff --stat origin/main -- src
```

Expected: no output. If anything appears, an assumption in the spec was wrong —
stop and re-read rather than adapting the code to the migration.

- [ ] **Step 2: Build and full suite**

```bash
npm run build
npx vitest run --maxWorkers=2
```

Expected: clean, and 95 files / 527 tests passing — unchanged from `main`.
Passing *unchanged* is the point: it shows no code depended on cross-user
visibility.

- [ ] **Step 3: Apply the migration**

Hand the user, to run from the worktree:

```bash
npx supabase db push
```

If it raises `daily_plans has N row(s) with no created_by`, stop. That means
rows exist that cannot be attributed, and the fix is a decision about that data,
not a change to this migration.

- [ ] **Step 4: Browser pass**

Only after the push succeeds. Confirm Today loads and a plan can still be
created, Inbox lists and triages captures, and Brainstorm lists workspace notes
and project notes. Each exercises one re-scoped table end to end as the owner.

- [ ] **Step 5: Open the PR**

```bash
git push -u origin codex/personal-boundary
```

The body must state plainly what is **not** verified: that a second member is
actually blocked. There is no database in the test environment and no second
account here, so isolation is argued from the policy text, not demonstrated.
Say so, and recommend confirming it with two real accounts before invitations
ship.

- [ ] **Step 6: Merge once CI is green**

```bash
gh pr checks <number> --watch --interval 15
```
