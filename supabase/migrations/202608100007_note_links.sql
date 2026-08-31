-- Notes could attach to a project or a work item by foreign key, and nothing
-- else linked to anything. This is the "what does this touch?" table.

-- projects and work_items already carry unique (id, workspace_id); notes never
-- needed it until now. Every reference in this schema is scoped by workspace,
-- and the foreign keys below follow that.
alter table public.notes add constraint notes_id_workspace_id_key unique (id, workspace_id);

create table public.note_links (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  note_id uuid not null,
  -- Four nullable foreign keys rather than a (type, id) pair: a polymorphic
  -- pair cannot have referential integrity, and deleting a target must take
  -- its inbound links with it rather than leave rows pointing at nothing.
  target_note_id uuid,
  target_work_item_id uuid,
  target_project_id uuid,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint note_links_one_target check (
    num_nonnulls(target_note_id, target_work_item_id, target_project_id) = 1
  ),

  foreign key (note_id, workspace_id)
    references public.notes(id, workspace_id) on delete cascade,
  foreign key (target_note_id, workspace_id)
    references public.notes(id, workspace_id) on delete cascade,
  foreign key (target_work_item_id, workspace_id)
    references public.work_items(id, workspace_id) on delete cascade,
  foreign key (target_project_id, workspace_id)
    references public.projects(id, workspace_id) on delete cascade
);

-- Exactly one target is non-null, so the coalesce is the target id. States
-- "one link per note per target" without relying on NULL-distinctness.
create unique index note_links_unique_target_idx
on public.note_links (note_id, coalesce(target_note_id, target_work_item_id, target_project_id));

create index note_links_note_id_idx on public.note_links (note_id);
create index note_links_target_note_idx on public.note_links (target_note_id);
create index note_links_target_work_item_idx on public.note_links (target_work_item_id);
create index note_links_target_project_idx on public.note_links (target_project_id);

create trigger set_note_links_updated_at
before update on public.note_links
for each row execute function public.set_updated_at();

-- Visibility follows the source note, not the workspace. Notes split by scope
-- — a project note is shared, a workspace note is private to its author — so a
-- member-only policy would leak that some private note references a task.
create or replace function private.can_read_note(target_note_id uuid)
returns boolean
language sql
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.notes n
    where n.id = target_note_id
      and private.is_workspace_member(n.workspace_id)
      and (n.project_id is not null or n.created_by = (select auth.uid()))
  );
$$;

revoke all on function private.can_read_note(uuid) from public;
grant execute on function private.can_read_note(uuid) to authenticated;

alter table public.note_links enable row level security;

grant select, delete on public.note_links to authenticated;
grant insert(workspace_id, note_id, target_note_id, target_work_item_id, target_project_id, created_by)
on public.note_links to authenticated;

create policy "Readers of a note can see its links"
on public.note_links
for select
to authenticated
using (private.can_read_note(note_id));

create policy "Authors can record their note links"
on public.note_links
for insert
to authenticated
with check (
  created_by = (select auth.uid())
  and private.can_read_note(note_id)
  and private.has_workspace_role(workspace_id, array['owner', 'admin', 'member']::public.workspace_role[])
);

create policy "Authors can remove their note links"
on public.note_links
for delete
to authenticated
using (private.can_read_note(note_id));

-- No update policy: reconciliation inserts and deletes, never edits.
