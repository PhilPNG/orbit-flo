-- Recipients are the task's assignee and its creator. `union` deduplicates, so
-- a task whose assignee is also its creator produces one row, not two.
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
    and r.recipient is distinct from actor;

  return new;
end;
$$;

create trigger work_item_comments_signal
after insert on public.work_item_comments
for each row execute function private.signal_comment();

create or replace function private.signal_role_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor uuid := (select auth.uid());
begin
  if new.role is not distinct from old.role then
    return new;
  end if;

  if new.user_id is distinct from actor then
    insert into public.signals (workspace_id, recipient_id, actor_id, kind)
    values (new.workspace_id, new.user_id, actor, 'role_changed');
  end if;

  return new;
end;
$$;

create trigger workspace_members_signal_role
after update of role on public.workspace_members
for each row execute function private.signal_role_change();

create or replace function private.signal_removal()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor uuid := (select auth.uid());
begin
  -- Leaving voluntarily is not news to the person who left.
  if old.user_id is not distinct from actor then
    return old;
  end if;

  -- The membership may be disappearing because the ACCOUNT is being deleted, in
  -- which case the recipient foreign key would fail or immediately cascade. It
  -- also matters for the e2e teardown, which deletes its throwaway accounts.
  if not exists (select 1 from auth.users u where u.id = old.user_id) then
    return old;
  end if;

  -- The membership may be disappearing because the WORKSPACE is being deleted.
  -- Its row is already gone in this transaction, so a signal referencing it
  -- would fail the foreign key and abort the deletion — which would break
  -- "Delete workspace" for any workspace with more than one member. The
  -- deleting owner returns early above, so only other members reach here.
  if not exists (select 1 from public.workspaces w where w.id = old.workspace_id) then
    return old;
  end if;

  insert into public.signals (workspace_id, recipient_id, actor_id, kind)
  values (old.workspace_id, old.user_id, actor, 'removed_from_workspace');

  return old;
end;
$$;

create trigger workspace_members_signal_removal
after delete on public.workspace_members
for each row execute function private.signal_removal();

-- The recipient is the INVITER. Whoever clicked Accept already knows; the
-- person currently learning nothing is the one who sent it.
create or replace function private.signal_invitation_accepted()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.invited_by is not null
     and new.invited_by is distinct from new.accepted_by then
    insert into public.signals (workspace_id, recipient_id, actor_id, kind)
    values (new.workspace_id, new.invited_by, new.accepted_by, 'invitation_accepted');
  end if;

  return new;
end;
$$;

create trigger workspace_invitations_signal_accepted
after update on public.workspace_invitations
for each row
when (old.accepted_at is null and new.accepted_at is not null)
execute function private.signal_invitation_accepted();
