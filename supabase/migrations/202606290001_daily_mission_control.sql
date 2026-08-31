create type public.daily_plan_status as enum ('planned', 'active', 'completed');
create type public.daily_plan_item_state as enum ('planned', 'completed', 'skipped');
create type public.capture_type as enum ('task', 'note', 'idea', 'blocker');

create table public.daily_plans (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  plan_date date not null,
  status public.daily_plan_status not null default 'planned',
  reflection text,
  completed_count integer not null default 0,
  skipped_count integer not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id),
  unique (workspace_id, plan_date)
);

create table public.daily_plan_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  daily_plan_id uuid not null,
  work_item_id uuid not null,
  sort_order integer not null default 0,
  is_primary boolean not null default false,
  state public.daily_plan_item_state not null default 'planned',
  completed_at timestamptz,
  skipped_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (daily_plan_id, work_item_id),
  foreign key (daily_plan_id, workspace_id) references public.daily_plans(id, workspace_id) on delete cascade,
  foreign key (work_item_id, workspace_id) references public.work_items(id, workspace_id) on delete cascade
);

create unique index daily_plan_items_one_primary_idx
on public.daily_plan_items(daily_plan_id)
where is_primary;

create table public.captures (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid,
  work_item_id uuid,
  type public.capture_type not null default 'task',
  title text not null,
  body text,
  processed_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (work_item_id is null or project_id is not null),
  foreign key (project_id, workspace_id) references public.projects(id, workspace_id) on delete cascade,
  foreign key (work_item_id, workspace_id, project_id) references public.work_items(id, workspace_id, project_id) on delete set null (work_item_id)
);

create trigger set_daily_plans_updated_at
before update on public.daily_plans
for each row execute function public.set_updated_at();

create trigger set_daily_plan_items_updated_at
before update on public.daily_plan_items
for each row execute function public.set_updated_at();

create trigger set_captures_updated_at
before update on public.captures
for each row execute function public.set_updated_at();

create index daily_plans_workspace_date_idx on public.daily_plans(workspace_id, plan_date desc);
create index daily_plan_items_plan_order_idx on public.daily_plan_items(daily_plan_id, sort_order);
create index daily_plan_items_work_item_idx on public.daily_plan_items(work_item_id);
create index captures_workspace_processed_idx on public.captures(workspace_id, processed_at, created_at desc);
create index captures_project_idx on public.captures(project_id);
create index captures_work_item_idx on public.captures(work_item_id);

alter table public.daily_plans enable row level security;
alter table public.daily_plan_items enable row level security;
alter table public.captures enable row level security;

grant select, delete on public.daily_plans to authenticated;
grant insert(workspace_id, plan_date, status, reflection, completed_count, skipped_count, created_by) on public.daily_plans to authenticated;
grant update(status, reflection, completed_count, skipped_count) on public.daily_plans to authenticated;

grant select, delete on public.daily_plan_items to authenticated;
grant insert(workspace_id, daily_plan_id, work_item_id, sort_order, is_primary, state) on public.daily_plan_items to authenticated;
grant update(sort_order, is_primary, state, completed_at, skipped_at) on public.daily_plan_items to authenticated;

grant select, delete on public.captures to authenticated;
grant insert(workspace_id, project_id, work_item_id, type, title, body, created_by) on public.captures to authenticated;
grant update(project_id, work_item_id, type, title, body, processed_at) on public.captures to authenticated;

create policy "Members can view daily plans"
on public.daily_plans
for select
to authenticated
using (private.is_workspace_member(workspace_id));

create policy "Members can create daily plans"
on public.daily_plans
for insert
to authenticated
with check (
  created_by = (select auth.uid())
  and private.has_workspace_role(workspace_id, array['owner', 'admin', 'member']::public.workspace_role[])
);

create policy "Members can update daily plans"
on public.daily_plans
for update
to authenticated
using (private.has_workspace_role(workspace_id, array['owner', 'admin', 'member']::public.workspace_role[]))
with check (private.has_workspace_role(workspace_id, array['owner', 'admin', 'member']::public.workspace_role[]));

create policy "Owners and admins can delete daily plans"
on public.daily_plans
for delete
to authenticated
using (private.has_workspace_role(workspace_id, array['owner', 'admin']::public.workspace_role[]));

create policy "Members can view daily plan items"
on public.daily_plan_items
for select
to authenticated
using (private.is_workspace_member(workspace_id));

create policy "Members can create daily plan items"
on public.daily_plan_items
for insert
to authenticated
with check (private.has_workspace_role(workspace_id, array['owner', 'admin', 'member']::public.workspace_role[]));

create policy "Members can update daily plan items"
on public.daily_plan_items
for update
to authenticated
using (private.has_workspace_role(workspace_id, array['owner', 'admin', 'member']::public.workspace_role[]))
with check (private.has_workspace_role(workspace_id, array['owner', 'admin', 'member']::public.workspace_role[]));

create policy "Owners and admins can delete daily plan items"
on public.daily_plan_items
for delete
to authenticated
using (private.has_workspace_role(workspace_id, array['owner', 'admin']::public.workspace_role[]));

create policy "Members can view captures"
on public.captures
for select
to authenticated
using (private.is_workspace_member(workspace_id));

create policy "Members can create captures"
on public.captures
for insert
to authenticated
with check (
  created_by = (select auth.uid())
  and private.has_workspace_role(workspace_id, array['owner', 'admin', 'member']::public.workspace_role[])
);

create policy "Members can update captures"
on public.captures
for update
to authenticated
using (private.has_workspace_role(workspace_id, array['owner', 'admin', 'member']::public.workspace_role[]))
with check (private.has_workspace_role(workspace_id, array['owner', 'admin', 'member']::public.workspace_role[]));

create policy "Owners and admins can delete captures"
on public.captures
for delete
to authenticated
using (private.has_workspace_role(workspace_id, array['owner', 'admin']::public.workspace_role[]));
