create table if not exists public.project_rituals (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid not null,
  title text not null check (char_length(title) between 1 and 120),
  is_done boolean not null default false,
  sort_order integer not null default 0,
  created_by uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (project_id, workspace_id) references public.projects(id, workspace_id) on delete cascade,
  foreign key (workspace_id, created_by) references public.workspace_members(workspace_id, user_id) on delete cascade
);

create index if not exists project_rituals_project_idx
  on public.project_rituals (workspace_id, project_id, sort_order);

alter table public.projects
  add column if not exists rituals_title text;

create trigger set_project_rituals_updated_at
before update on public.project_rituals
for each row execute function public.set_updated_at();

alter table public.project_rituals enable row level security;

create policy "Members can view project rituals"
on public.project_rituals for select
using (exists (select 1 from public.workspace_members m where m.workspace_id = project_rituals.workspace_id and m.user_id = auth.uid()));

create policy "Members can create project rituals"
on public.project_rituals for insert
with check (
  created_by = auth.uid()
  and exists (select 1 from public.workspace_members m where m.workspace_id = project_rituals.workspace_id and m.user_id = auth.uid())
);

create policy "Members can update project rituals"
on public.project_rituals for update
using (exists (select 1 from public.workspace_members m where m.workspace_id = project_rituals.workspace_id and m.user_id = auth.uid()));

create policy "Members can delete project rituals"
on public.project_rituals for delete
using (exists (select 1 from public.workspace_members m where m.workspace_id = project_rituals.workspace_id and m.user_id = auth.uid()));
