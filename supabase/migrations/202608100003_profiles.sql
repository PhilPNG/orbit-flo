-- Supabase does not expose auth.users to clients, so created_by is an opaque
-- uuid everywhere. This is the public projection every collaboration surface
-- needs: member lists, assignees, comment authors, invitation "from" lines.

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- No avatar_url column. Sub-project F may want image avatars, but a column
-- nothing writes is the orphan pattern this codebase has already had to clean
-- up twice. Initials from display_name need no storage.

create trigger set_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

-- A profile must exist for every user without the client doing anything.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(split_part(new.email, '@', 1), ''),
      'Pilot'
    )
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Same expression as the trigger, so backfilling and signing up agree.
insert into public.profiles (id, display_name)
select
  u.id,
  coalesce(
    nullif(btrim(u.raw_user_meta_data ->> 'full_name'), ''),
    nullif(split_part(u.email, '@', 1), ''),
    'Pilot'
  )
from auth.users u
on conflict (id) do nothing;

-- You may read a profile if it is yours or you share a workspace with it.
create or replace function private.shares_workspace_with(target_user_id uuid)
returns boolean
language sql
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.workspace_members mine
    join public.workspace_members theirs on theirs.workspace_id = mine.workspace_id
    where mine.user_id = (select auth.uid())
      and theirs.user_id = target_user_id
  );
$$;

revoke all on function private.shares_workspace_with(uuid) from public;
grant execute on function private.shares_workspace_with(uuid) to authenticated;

alter table public.profiles enable row level security;

-- Only display_name is writable, so a client cannot touch id or the timestamps
-- even where a policy would otherwise allow it.
grant select on public.profiles to authenticated;
grant update(display_name) on public.profiles to authenticated;

create policy "Members can view profiles they share a workspace with"
on public.profiles
for select
to authenticated
using (id = (select auth.uid()) or private.shares_workspace_with(id));

create policy "Users can update their own profile"
on public.profiles
for update
to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

-- No insert or delete policy: the trigger owns creation, the cascade owns
-- deletion, and a client has no business doing either.
