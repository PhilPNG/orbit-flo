-- Two defects in the role model, closed together because they are the same
-- subsystem.
--
-- 1. `viewer` is a value the schema offers and the system refuses. It is in the
--    workspace_role enum, create_workspace_invitation rejects it, and no UI
--    offers it. Worse than useless: private.is_workspace_member ignores role,
--    and 19 write policies are gated on membership alone with no role list, so
--    a viewer inserted by the service role or from the SQL editor would look
--    read-only while holding write access to all of them.
--
--    A CHECK constraint closes it. The enum VALUE stays — removing it means
--    recreating the type and rebuilding every policy and function that depends
--    on it, which is most of the RLS surface, for a value with zero rows in
--    either table. This is a deliberate trade, not an oversight.

alter table public.workspace_members
  add constraint workspace_members_role_not_viewer check (role <> 'viewer');

alter table public.workspace_invitations
  add constraint workspace_invitations_role_not_viewer check (role <> 'viewer');

-- 2. Two owners could never remove each other. Demotion already worked — the
--    UPDATE policy's WITH CHECK permits it because user_id <> auth.uid() holds
--    for someone else's row — but the DELETE policy carried `role <> 'owner'`,
--    so removal was blocked at the database and the UI hid the control to
--    match.
--
--    The invariant that a workspace keeps an owner belongs to
--    enforce_owner_survives, which fires on every path, not to a policy clause
--    that only covers this one. Dropping the clause makes the trigger the
--    single place that guarantee lives.

drop policy "Workspace owners can remove memberships" on public.workspace_members;

create policy "Workspace owners can remove memberships"
on public.workspace_members
for delete
to authenticated
using (private.has_workspace_role(workspace_id, array['owner']::public.workspace_role[]));

-- Assert rather than assume: a constraint that failed to attach, or a policy
-- that was recreated with the old clause, would both be silent.
do $$
declare
  policy_using text;
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'workspace_members_role_not_viewer'
      and conrelid = 'public.workspace_members'::regclass
  ) then
    raise exception 'workspace_members_role_not_viewer was not created';
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'workspace_invitations_role_not_viewer'
      and conrelid = 'public.workspace_invitations'::regclass
  ) then
    raise exception 'workspace_invitations_role_not_viewer was not created';
  end if;

  select qual into policy_using
  from pg_policies
  where schemaname = 'public'
    and tablename = 'workspace_members'
    and policyname = 'Workspace owners can remove memberships';

  if policy_using is null then
    raise exception 'the remove-memberships policy is missing';
  end if;

  -- The new expression still mentions 'owner' inside the ARRAY, so match on the
  -- comparison itself rather than on the word.
  if policy_using like '%role <>%' then
    raise exception 'the remove-memberships policy still excludes owners: %', policy_using;
  end if;
end
$$;
