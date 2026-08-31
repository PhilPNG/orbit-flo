alter table public.work_items
  add column if not exists planned_at time;

alter table public.work_items
  add column if not exists planned_minutes integer
  check (planned_minutes is null or planned_minutes between 5 and 480);

alter table public.projects
  add column if not exists is_favorite boolean not null default false;

create table if not exists public.template_usage (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  template_id text not null check (char_length(template_id) between 1 and 80),
  use_count integer not null default 0,
  created_by uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, template_id),
  foreign key (workspace_id, created_by) references public.workspace_members(workspace_id, user_id) on delete cascade
);

create trigger set_template_usage_updated_at
before update on public.template_usage
for each row execute function public.set_updated_at();

alter table public.template_usage enable row level security;

create policy "Members can view template usage"
on public.template_usage for select
using (exists (select 1 from public.workspace_members m where m.workspace_id = template_usage.workspace_id and m.user_id = auth.uid()));

create policy "Members can create template usage"
on public.template_usage for insert
with check (
  created_by = auth.uid()
  and exists (select 1 from public.workspace_members m where m.workspace_id = template_usage.workspace_id and m.user_id = auth.uid())
);

create policy "Members can update template usage"
on public.template_usage for update
using (exists (select 1 from public.workspace_members m where m.workspace_id = template_usage.workspace_id and m.user_id = auth.uid()));
