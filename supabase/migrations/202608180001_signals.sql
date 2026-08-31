-- One row per notification, addressed to a recipient. Written only by triggers:
-- a notification you sometimes get is worse than none, and application code has
-- already proven it forgets (linkMention had to be taught to call saveNoteLinks).

create type public.signal_kind as enum (
  'assigned', 'unassigned', 'commented', 'mentioned',
  'invitation_accepted', 'role_changed', 'removed_from_workspace'
);

create table public.signals (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces(id) on delete cascade,
  -- auth.users, not profiles: always the current user, never embedded. Pointing
  -- both user columns at profiles would give this table two foreign keys to it
  -- and make the profiles(...) embed ambiguous.
  recipient_id  uuid not null references auth.users(id) on delete cascade,
  -- profiles, so the list can embed profiles(display_name) for "Alice assigned
  -- you...". This is the relationship whose absence broke Settings in #48.
  actor_id      uuid references public.profiles(id) on delete set null,
  kind          public.signal_kind not null,
  work_item_id  uuid,
  note_id       uuid,
  comment_id    uuid references public.work_item_comments(id) on delete cascade,
  read_at       timestamptz,
  created_at    timestamptz not null default now(),
  foreign key (work_item_id, workspace_id)
    references public.work_items(id, workspace_id) on delete cascade,
  foreign key (note_id, workspace_id)
    references public.notes(id, workspace_id) on delete cascade
);

-- comment_id is a plain reference: work_item_comments has only a primary key on
-- id, with no (id, workspace_id) unique to hang a composite key on.

create index signals_recipient_unread_idx
  on public.signals (recipient_id, read_at, created_at desc);

alter table public.signals enable row level security;

-- Supabase runs `alter default privileges in schema public grant all on tables
-- to anon, authenticated`, so a new table in this schema starts life fully
-- granted to both roles. "No insert grant" is therefore not achieved by staying
-- silent — it has to be taken away. Verified on the live project: anon holds
-- INSERT on notes, workspace_members and workspace_invitations despite those
-- migrations saying otherwise. RLS default-deny is all that protects them.
-- Triggers own creation here, so the grant layer says so too.
revoke all on public.signals from public, anon, authenticated;

grant select, delete on public.signals to authenticated;
grant update(read_at) on public.signals to authenticated;

create policy "Recipients can view their signals"
on public.signals
for select
to authenticated
using (
  recipient_id = (select auth.uid())
  and private.is_workspace_member(workspace_id)
);

create policy "Recipients can mark their signals read"
on public.signals
for update
to authenticated
using (
  recipient_id = (select auth.uid())
  and private.is_workspace_member(workspace_id)
)
with check (
  recipient_id = (select auth.uid())
  and private.is_workspace_member(workspace_id)
);

create policy "Recipients can delete their signals"
on public.signals
for delete
to authenticated
using (
  recipient_id = (select auth.uid())
  and private.is_workspace_member(workspace_id)
);

-- Assert rather than assume: a GRANT or REVOKE that changes nothing is silent.
do $$
begin
  if has_table_privilege('authenticated', 'public.signals', 'INSERT') then
    raise exception 'authenticated can insert signals directly; triggers must own creation';
  end if;

  if not has_table_privilege('authenticated', 'public.signals', 'SELECT') then
    raise exception 'authenticated cannot read signals';
  end if;

  -- has_table_privilege(..., 'UPDATE') is true for a one-column grant as well
  -- as a table-wide one, so it cannot prove the column restriction held. Ask
  -- about a column that must NOT be writable instead.
  if has_column_privilege('authenticated', 'public.signals', 'kind', 'UPDATE') then
    raise exception 'authenticated can rewrite signal kind; only read_at may be updated';
  end if;

  if not has_column_privilege('authenticated', 'public.signals', 'read_at', 'UPDATE') then
    raise exception 'authenticated cannot mark a signal read';
  end if;

  if has_table_privilege('anon', 'public.signals', 'SELECT')
     or has_table_privilege('anon', 'public.signals', 'INSERT') then
    raise exception 'anon retains privileges on signals';
  end if;
end
$$;
