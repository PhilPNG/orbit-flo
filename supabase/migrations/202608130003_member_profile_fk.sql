-- Settings showed "Could not find a relationship between 'workspace_members'
-- and 'profiles' in the schema cache", and the assignee avatars were failing
-- the same way without saying so.
--
-- Both listMembers and listWorkspaceProfiles ask PostgREST to embed profiles
-- from workspace_members. PostgREST resolves embeds through foreign keys, and
-- there is no key joining these two: workspace_members.user_id references
-- auth.users(id), profiles.id references auth.users(id). They are siblings of
-- auth.users, not relatives of each other, and PostgREST does not traverse a
-- shared parent — least of all one in an unexposed schema.
--
-- The relationship the code assumed is real: handle_new_user creates a profile
-- for every account and 202608100003 backfilled the ones that predated it. It
-- was simply never declared. Declaring it fixes both call sites without
-- touching either, and makes "a member has a profile" an invariant the database
-- enforces rather than one the client hopes for.

-- Fail loudly and say which rows are wrong, rather than letting the constraint
-- report a violation with no way to find it.
do $$
declare
  orphaned integer;
  sample text;
begin
  select count(*), string_agg(distinct wm.user_id::text, ', ')
  into orphaned, sample
  from public.workspace_members wm
  where not exists (select 1 from public.profiles p where p.id = wm.user_id);

  if orphaned > 0 then
    raise exception
      '% workspace_members row(s) reference a user with no profile: %. Backfill public.profiles for them before adding the key.',
      orphaned, sample;
  end if;
end
$$;

-- on delete cascade matches the existing user_id -> auth.users(id) rule, so
-- deleting an account removes its memberships by either path.
alter table public.workspace_members
  add constraint workspace_members_user_id_profiles_fkey
  foreign key (user_id) references public.profiles(id) on delete cascade;

-- PostgREST caches the schema. Supabase reloads on DDL, but say so explicitly
-- so the fix does not appear to have failed for the lifetime of a stale cache.
notify pgrst, 'reload schema';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'workspace_members_user_id_profiles_fkey'
      and conrelid = 'public.workspace_members'::regclass
  ) then
    raise exception 'the workspace_members -> profiles key was not created';
  end if;
end
$$;
