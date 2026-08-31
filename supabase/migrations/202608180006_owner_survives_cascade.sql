-- private.enforce_owner_survives protects a workspace from being stranded with
-- no owner. It does that by refusing to delete the last owner's membership row
-- — unconditionally, including when that row is disappearing because its parent
-- is being deleted.
--
-- Two shipped operations are therefore impossible, and both were verified
-- against the live database on 2026-08-19:
--
--   delete a workspace   -> cascades to workspace_members -> trigger raises
--                           'A workspace needs at least one owner' -> the whole
--                           delete aborts. The danger-zone "Delete workspace"
--                           control has never worked.
--
--   delete an account    -> cascades to workspace_members -> same raise. Since
--                           every user gets a personal workspace on first sign
--                           -in and is its sole owner, NO account can be
--                           deleted at all. This is what stopped the
--                           collaboration e2e, whose teardown removes its
--                           throwaway accounts.
--
-- The invariant is worth keeping: a LIVING workspace should never lose its last
-- owner through a demotion or someone walking out. But when the workspace or
-- the account is itself going away, this row is a consequence rather than a
-- cause, and refusing makes the parent undeletable instead of protecting
-- anything.
--
-- Same technique as the signal guards in 202608180002/0005: during a cascade
-- the parent row is already deleted in this transaction, so `not exists` is the
-- signal that we are inside one.

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

  if tg_op = 'DELETE' then
    -- The workspace is being deleted; there is nothing left to strand.
    if not exists (
      select 1 from public.workspaces w where w.id = affected_workspace
    ) then
      return old;
    end if;

    -- The account is being deleted. Its memberships go with it, and a personal
    -- workspace with no members left is collected by its own cascade.
    if not exists (
      select 1 from auth.users u where u.id = old.user_id
    ) then
      return old;
    end if;
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

-- The trigger itself is unchanged and still bound to this function, but say so
-- rather than assume: a create-or-replace that silently missed would leave the
-- old body in place with nothing to show for it.
do $$
begin
  if not exists (
    select 1
    from pg_trigger t
    join pg_proc p on p.oid = t.tgfoid
    join pg_namespace n on n.oid = p.pronamespace
    where t.tgname = 'workspace_members_owner_survives'
      and n.nspname = 'private'
      and p.proname = 'enforce_owner_survives'
  ) then
    raise exception 'workspace_members_owner_survives is no longer bound to private.enforce_owner_survives';
  end if;
end
$$;
