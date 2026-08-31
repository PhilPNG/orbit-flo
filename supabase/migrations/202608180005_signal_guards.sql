-- private.signal_assignment and private.signal_comment already guard against
-- the workspace being deleted mid-transaction, the same way private.signal_removal
-- guards workspace_members. What they did not guard is the RECIPIENT.
--
-- Deleting a user cascades: auth.users -> workspace_members (membership row
-- gone) -> work_items.assigned_to := null (on delete set null) -> this UPDATE
-- fires work_items_signal_assignment -> it tries to insert a signal whose
-- recipient_id is the very user being deleted -> the auth.users(id) foreign
-- key on signals.recipient_id fails -> the whole account deletion aborts.
-- tests/e2e/support/orbit-backend.ts deletes throwaway accounts in teardown,
-- and a test now assigns a task to the teammate right before that runs, so
-- this was a live flake, not a hypothetical.
--
-- The fix is the same membership check private.signal_mentions already makes:
-- a signal for someone who isn't (or is no longer) a workspace member is
-- unreadable by RLS anyway ("Recipients can view their signals" requires
-- private.is_workspace_member(workspace_id)), so writing one is pure garbage
-- in the ordinary case -- and actively harmful during an account deletion,
-- where it's the difference between the delete succeeding and aborting.
--
-- This also fixes a second problem the reviewer noted: a departed colleague
-- who is still `created_by` on a task otherwise accumulates comment signals
-- forever, rows RLS will never let them see.
create or replace function private.signal_assignment()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor uuid := (select auth.uid());
begin
  -- Deleting a workspace cascades to workspace_members, and that cascade sets
  -- work_items.assigned_to to null — an UPDATE which fires this trigger. The
  -- workspaces row is already gone in this transaction, so inserting a signal
  -- that references it fails the foreign key and aborts the whole deletion.
  if not exists (select 1 from public.workspaces w where w.id = new.workspace_id) then
    return new;
  end if;

  -- `is not distinct from`, never `=`. assigned_to moves to and from null
  -- constantly, and null = null is null, not true, so a plain equality test
  -- would let a no-op update raise a signal.
  if tg_op = 'UPDATE' and new.assigned_to is not distinct from old.assigned_to then
    return new;
  end if;

  -- `old` may only be touched on UPDATE; referencing it during INSERT raises.
  if tg_op = 'UPDATE'
     and old.assigned_to is not null
     and old.assigned_to is distinct from actor
     and exists (
       select 1 from public.workspace_members wm
       where wm.workspace_id = new.workspace_id and wm.user_id = old.assigned_to
     ) then
    insert into public.signals
      (workspace_id, recipient_id, actor_id, kind, work_item_id)
    values
      (new.workspace_id, old.assigned_to, actor, 'unassigned', new.id);
  end if;

  -- `is distinct from actor` rather than `<> actor`: when actor is null (a
  -- service-role or SQL-editor write) `<>` yields null and the signal would be
  -- silently dropped.
  if new.assigned_to is not null
     and new.assigned_to is distinct from actor
     and exists (
       select 1 from public.workspace_members wm
       where wm.workspace_id = new.workspace_id and wm.user_id = new.assigned_to
     ) then
    insert into public.signals
      (workspace_id, recipient_id, actor_id, kind, work_item_id)
    values
      (new.workspace_id, new.assigned_to, actor, 'assigned', new.id);
  end if;

  return new;
end;
$$;

-- Recipients are the task's assignee and its creator. `union` deduplicates, so
-- a task whose assignee is also its creator produces one row, not two. Each
-- recipient is now also checked for current membership, for the same reason
-- as above: an unreadable signal is garbage in the ordinary case, and if the
-- recipient is mid-deletion it's a foreign-key abort waiting to happen.
create or replace function private.signal_comment()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor uuid := (select auth.uid());
begin
  insert into public.signals
    (workspace_id, recipient_id, actor_id, kind, work_item_id, comment_id)
  select new.workspace_id, r.recipient, actor, 'commented', new.work_item_id, new.id
  from (
    select w.assigned_to as recipient
      from public.work_items w where w.id = new.work_item_id
    union
    select w.created_by
      from public.work_items w where w.id = new.work_item_id
  ) r
  where r.recipient is not null
    and r.recipient is distinct from actor
    and exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = new.workspace_id and wm.user_id = r.recipient
    );

  return new;
end;
$$;

-- removed_from_workspace is dead: the select policy on signals requires
-- private.is_workspace_member(workspace_id), but the recipient of this signal
-- is by definition no longer a member, so the row can never be read. There's
-- also no surface for it even if it could be read — the workspace disappears
-- from that user's switcher, and the Signals page is workspace-scoped. Drop
-- the trigger and function rather than ship writes nothing can ever display.
--
-- The 'removed_from_workspace' value stays in the public.signal_kind enum:
-- dropping an enum value requires recreating the whole type (every column and
-- policy that references it would need rebuilding along with it), which is
-- disproportionate to removing dead code. Nothing ever raises this kind again
-- from this point on; the value simply becomes unused.
drop trigger if exists workspace_members_signal_removal on public.workspace_members;
drop function if exists private.signal_removal();
