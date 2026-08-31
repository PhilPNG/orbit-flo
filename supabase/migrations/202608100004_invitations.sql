-- workspace_members has select, update(role) and delete policies but no insert
-- policy and no insert grant, so nobody could ever be added. That gap is
-- deliberate — a blanket insert grant would let a client add itself to any
-- workspace — so this closes it through functions rather than a looser grant.

create table public.workspace_invitations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  email text not null,
  role public.workspace_role not null default 'member',
  token text not null unique,
  invited_by uuid references auth.users(id) on delete set null,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  accepted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One live invitation per person per workspace, while still allowing a fresh
-- one after the previous is accepted or revoked.
create unique index workspace_invitations_pending_email_idx
on public.workspace_invitations (workspace_id, lower(email))
where accepted_at is null;

create index workspace_invitations_workspace_id_idx
on public.workspace_invitations (workspace_id);

create trigger set_workspace_invitations_updated_at
before update on public.workspace_invitations
for each row execute function public.set_updated_at();

alter table public.workspace_invitations enable row level security;

grant select, delete on public.workspace_invitations to authenticated;

create policy "Members can view workspace invitations"
on public.workspace_invitations
for select
to authenticated
using (private.is_workspace_member(workspace_id));

create policy "Owners and admins can revoke invitations"
on public.workspace_invitations
for delete
to authenticated
using (private.has_workspace_role(workspace_id, array['owner', 'admin']::public.workspace_role[]));

-- No insert or update policy, and no insert grant: the functions below own
-- both, which is the whole point.

create or replace function public.create_workspace_invitation(
  target_workspace_id uuid,
  target_email text,
  target_role public.workspace_role default 'member'
)
returns public.workspace_invitations
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  normalized_email text;
  invitation public.workspace_invitations;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required to invite people';
  end if;

  if not private.has_workspace_role(
    target_workspace_id,
    array['owner', 'admin']::public.workspace_role[]
  ) then
    raise exception 'Only owners and admins can invite people';
  end if;

  normalized_email := lower(btrim(target_email));

  if normalized_email is null or normalized_email = '' then
    raise exception 'An email address is required';
  end if;

  -- viewer is in the enum but no policy grants it anything, so inviting
  -- someone as one would silently give them nothing.
  if target_role = 'viewer' then
    raise exception 'The viewer role is not available yet';
  end if;

  if exists (
    select 1
    from public.workspace_members wm
    join auth.users u on u.id = wm.user_id
    where wm.workspace_id = target_workspace_id
      and lower(u.email) = normalized_email
  ) then
    raise exception 'That person is already a member of this workspace';
  end if;

  insert into public.workspace_invitations (
    workspace_id, email, role, token, invited_by, expires_at
  )
  values (
    target_workspace_id,
    normalized_email,
    target_role,
    -- 256 bits, and no extension dependency.
    replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
    (select auth.uid()),
    now() + interval '7 days'
  )
  returning * into invitation;

  return invitation;
end;
$$;

revoke all on function public.create_workspace_invitation(uuid, text, public.workspace_role) from public;
grant execute on function public.create_workspace_invitation(uuid, text, public.workspace_role) to authenticated;

-- The recipient is not a member yet, so they cannot read the workspace or the
-- invitation row. This returns only what a link-holder may see, never the token.
create or replace function public.preview_workspace_invitation(invitation_token text)
returns table (
  workspace_name text,
  invited_by_name text,
  email text,
  is_expired boolean,
  is_accepted boolean
)
language sql
security definer
set search_path = public, pg_temp
as $$
  select
    w.name,
    coalesce(p.display_name, 'Someone'),
    i.email,
    i.expires_at <= now(),
    i.accepted_at is not null
  from public.workspace_invitations i
  join public.workspaces w on w.id = i.workspace_id
  left join public.profiles p on p.id = i.invited_by
  where i.token = invitation_token;
$$;

revoke all on function public.preview_workspace_invitation(text) from public;
grant execute on function public.preview_workspace_invitation(text) to authenticated;

create or replace function public.accept_workspace_invitation(invitation_token text)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  invitation public.workspace_invitations;
  current_user_id uuid;
  current_email text;
begin
  current_user_id := (select auth.uid());

  if current_user_id is null then
    raise exception 'Sign in to accept an invitation';
  end if;

  select lower(u.email) into current_email
  from auth.users u
  where u.id = current_user_id;

  select * into invitation
  from public.workspace_invitations
  where token = invitation_token;

  if invitation.id is null then
    raise exception 'This invitation could not be found';
  end if;

  if invitation.accepted_at is not null then
    raise exception 'This invitation has already been used';
  end if;

  if invitation.expires_at <= now() then
    raise exception 'This invitation has expired';
  end if;

  if lower(invitation.email) is distinct from current_email then
    raise exception 'This invitation was sent to a different email address';
  end if;

  -- Already a member: stamp it and succeed, so a double-click is harmless.
  if not exists (
    select 1
    from public.workspace_members
    where workspace_id = invitation.workspace_id
      and user_id = current_user_id
  ) then
    insert into public.workspace_members (workspace_id, user_id, role)
    values (invitation.workspace_id, current_user_id, invitation.role);
  end if;

  update public.workspace_invitations
  set accepted_at = now(), accepted_by = current_user_id
  where id = invitation.id;

  return invitation.workspace_id;
end;
$$;

revoke all on function public.accept_workspace_invitation(text) from public;
grant execute on function public.accept_workspace_invitation(text) to authenticated;
