-- Comments -------------------------------------------------------------------

create table if not exists public.work_item_comments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  work_item_id uuid not null,
  body text not null check (char_length(body) between 1 and 4000),
  created_by uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (work_item_id, workspace_id) references public.work_items(id, workspace_id) on delete cascade,
  foreign key (workspace_id, created_by) references public.workspace_members(workspace_id, user_id) on delete cascade
);

create index if not exists work_item_comments_item_idx
  on public.work_item_comments (workspace_id, work_item_id, created_at);

-- Labels ----------------------------------------------------------------------

create table if not exists public.labels (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid not null,
  name text not null check (char_length(name) between 1 and 40),
  color text not null check (color in ('cyan', 'blue', 'violet', 'emerald', 'amber', 'rose')),
  created_by uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id),
  unique (project_id, name),
  foreign key (project_id, workspace_id) references public.projects(id, workspace_id) on delete cascade,
  foreign key (workspace_id, created_by) references public.workspace_members(workspace_id, user_id) on delete cascade
);

create index if not exists labels_project_idx on public.labels (workspace_id, project_id, name);

create table if not exists public.work_item_labels (
  work_item_id uuid not null,
  label_id uuid not null,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  primary key (work_item_id, label_id),
  foreign key (work_item_id, workspace_id) references public.work_items(id, workspace_id) on delete cascade,
  foreign key (label_id, workspace_id) references public.labels(id, workspace_id) on delete cascade
);

create index if not exists work_item_labels_item_idx on public.work_item_labels (workspace_id, work_item_id);

-- Checklist -------------------------------------------------------------------

create table if not exists public.work_item_checklist_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  work_item_id uuid not null,
  title text not null check (char_length(title) between 1 and 200),
  is_done boolean not null default false,
  sort_order integer not null default 0,
  created_by uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (work_item_id, workspace_id) references public.work_items(id, workspace_id) on delete cascade,
  foreign key (workspace_id, created_by) references public.workspace_members(workspace_id, user_id) on delete cascade
);

create index if not exists work_item_checklist_item_idx
  on public.work_item_checklist_items (workspace_id, work_item_id, sort_order);

-- Attachments -----------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('attachments', 'attachments', false)
on conflict (id) do nothing;

create table if not exists public.work_item_attachments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  work_item_id uuid not null,
  file_name text not null,
  storage_path text not null unique,
  mime_type text not null default 'application/octet-stream',
  size_bytes bigint not null default 0,
  created_by uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  foreign key (work_item_id, workspace_id) references public.work_items(id, workspace_id) on delete cascade,
  foreign key (workspace_id, created_by) references public.workspace_members(workspace_id, user_id) on delete cascade
);

create index if not exists work_item_attachments_item_idx
  on public.work_item_attachments (workspace_id, work_item_id, created_at);

-- Triggers --------------------------------------------------------------------

create trigger set_work_item_comments_updated_at
before update on public.work_item_comments
for each row execute function public.set_updated_at();

create trigger set_labels_updated_at
before update on public.labels
for each row execute function public.set_updated_at();

create trigger set_work_item_checklist_items_updated_at
before update on public.work_item_checklist_items
for each row execute function public.set_updated_at();

-- Row level security ------------------------------------------------------------

alter table public.work_item_comments enable row level security;
alter table public.labels enable row level security;
alter table public.work_item_labels enable row level security;
alter table public.work_item_checklist_items enable row level security;
alter table public.work_item_attachments enable row level security;

create policy "Members can view comments"
on public.work_item_comments for select
using (exists (select 1 from public.workspace_members m where m.workspace_id = work_item_comments.workspace_id and m.user_id = auth.uid()));

create policy "Members can create comments"
on public.work_item_comments for insert
with check (
  created_by = auth.uid()
  and exists (select 1 from public.workspace_members m where m.workspace_id = work_item_comments.workspace_id and m.user_id = auth.uid())
);

create policy "Authors can delete their comments"
on public.work_item_comments for delete
using (created_by = auth.uid());

create policy "Members can view labels"
on public.labels for select
using (exists (select 1 from public.workspace_members m where m.workspace_id = labels.workspace_id and m.user_id = auth.uid()));

create policy "Members can create labels"
on public.labels for insert
with check (
  created_by = auth.uid()
  and exists (select 1 from public.workspace_members m where m.workspace_id = labels.workspace_id and m.user_id = auth.uid())
);

create policy "Members can update labels"
on public.labels for update
using (exists (select 1 from public.workspace_members m where m.workspace_id = labels.workspace_id and m.user_id = auth.uid()));

create policy "Members can delete labels"
on public.labels for delete
using (exists (select 1 from public.workspace_members m where m.workspace_id = labels.workspace_id and m.user_id = auth.uid()));

create policy "Members can view label assignments"
on public.work_item_labels for select
using (exists (select 1 from public.workspace_members m where m.workspace_id = work_item_labels.workspace_id and m.user_id = auth.uid()));

create policy "Members can assign labels"
on public.work_item_labels for insert
with check (exists (select 1 from public.workspace_members m where m.workspace_id = work_item_labels.workspace_id and m.user_id = auth.uid()));

create policy "Members can unassign labels"
on public.work_item_labels for delete
using (exists (select 1 from public.workspace_members m where m.workspace_id = work_item_labels.workspace_id and m.user_id = auth.uid()));

create policy "Members can view checklist items"
on public.work_item_checklist_items for select
using (exists (select 1 from public.workspace_members m where m.workspace_id = work_item_checklist_items.workspace_id and m.user_id = auth.uid()));

create policy "Members can create checklist items"
on public.work_item_checklist_items for insert
with check (
  created_by = auth.uid()
  and exists (select 1 from public.workspace_members m where m.workspace_id = work_item_checklist_items.workspace_id and m.user_id = auth.uid())
);

create policy "Members can update checklist items"
on public.work_item_checklist_items for update
using (exists (select 1 from public.workspace_members m where m.workspace_id = work_item_checklist_items.workspace_id and m.user_id = auth.uid()));

create policy "Members can delete checklist items"
on public.work_item_checklist_items for delete
using (exists (select 1 from public.workspace_members m where m.workspace_id = work_item_checklist_items.workspace_id and m.user_id = auth.uid()));

create policy "Members can view attachments"
on public.work_item_attachments for select
using (exists (select 1 from public.workspace_members m where m.workspace_id = work_item_attachments.workspace_id and m.user_id = auth.uid()));

create policy "Members can create attachments"
on public.work_item_attachments for insert
with check (
  created_by = auth.uid()
  and exists (select 1 from public.workspace_members m where m.workspace_id = work_item_attachments.workspace_id and m.user_id = auth.uid())
);

create policy "Uploaders can delete their attachments"
on public.work_item_attachments for delete
using (created_by = auth.uid());

-- Storage policies ---------------------------------------------------------------

create policy "Members can view attachment objects"
on storage.objects for select to authenticated
using (
  bucket_id = 'attachments'
  and (storage.foldername(name))[1] in (
    select workspace_id::text from public.workspace_members where user_id = auth.uid()
  )
);

create policy "Members can upload attachment objects"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'attachments'
  and (storage.foldername(name))[1] in (
    select workspace_id::text from public.workspace_members where user_id = auth.uid()
  )
);

create policy "Members can delete attachment objects"
on storage.objects for delete to authenticated
using (
  bucket_id = 'attachments'
  and (storage.foldername(name))[1] in (
    select workspace_id::text from public.workspace_members where user_id = auth.uid()
  )
);
