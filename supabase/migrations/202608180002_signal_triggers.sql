-- Assignment is the clearest "this is now your problem" event, and the one the
-- assignment feature left dangling: assigned_to records who is assigned now,
-- never that it changed or by whom.
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
     and old.assigned_to is distinct from actor then
    insert into public.signals
      (workspace_id, recipient_id, actor_id, kind, work_item_id)
    values
      (new.workspace_id, old.assigned_to, actor, 'unassigned', new.id);
  end if;

  -- `is distinct from actor` rather than `<> actor`: when actor is null (a
  -- service-role or SQL-editor write) `<>` yields null and the signal would be
  -- silently dropped.
  if new.assigned_to is not null
     and new.assigned_to is distinct from actor then
    insert into public.signals
      (workspace_id, recipient_id, actor_id, kind, work_item_id)
    values
      (new.workspace_id, new.assigned_to, actor, 'assigned', new.id);
  end if;

  return new;
end;
$$;

create trigger work_items_signal_assignment
after insert or update of assigned_to on public.work_items
for each row execute function private.signal_assignment();
