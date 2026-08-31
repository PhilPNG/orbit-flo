-- Membership could be granted (invitations) but never managed. There was no
-- way to leave a workspace at all: delete required the owner role AND
-- role <> 'owner', so a member could not remove their own row and an owner
-- could not be removed by anyone.

-- A workspace with no owner has nobody who can manage it, delete it, or invite
-- to it. A trigger rather than a check inside an RPC, so the invariant holds on
-- every path — role changes, self-removal, and owner removal alike.
create or replace function private.enforce_owner_survives()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  remaining_owners integer;
  affected_workspace uuid;
begin
  affected_workspace := old.workspace_id;

  -- Only removals and demotions can strand a workspace.
  if tg_op = 'UPDATE' and (old.role <> 'owner' or new.role = 'owner') then
    return new;
  end if;

  if tg_op = 'DELETE' and old.role <> 'owner' then
    return old;
  end if;

  select count(*) into remaining_owners
  from public.workspace_members
  where workspace_id = affected_workspace
    and role = 'owner'
    and id <> old.id;

  if remaining_owners = 0 then
    raise exception 'A workspace needs at least one owner';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

create trigger workspace_members_owner_survives
before update or delete on public.workspace_members
for each row execute function private.enforce_owner_survives();

-- Leaving is removing your own membership. The trigger above stops the last
-- owner from walking out and stranding the workspace.
create policy "Members can leave a workspace"
on public.workspace_members
for delete
to authenticated
using (user_id = (select auth.uid()));
