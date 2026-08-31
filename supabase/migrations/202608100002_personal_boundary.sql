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
