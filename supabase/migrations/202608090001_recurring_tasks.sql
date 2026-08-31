create type public.recurrence_pattern as enum ('daily', 'weekdays', 'weekly', 'monthly');

create table if not exists public.recurrence_rules (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid not null,
  title text not null check (char_length(title) between 1 and 200),
  description text,
  priority public.project_priority not null default 'medium',
  pattern public.recurrence_pattern not null,
  weekdays smallint[] not null default '{}',
  day_of_month smallint check (day_of_month is null or day_of_month between 1 and 31),
  planned_at time,
  planned_minutes integer check (planned_minutes is null or planned_minutes between 5 and 480),
  is_active boolean not null default true,
  generated_through date,
  created_by uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id),
  constraint recurrence_weekly_needs_days
    check (pattern <> 'weekly' or array_length(weekdays, 1) >= 1),
  constraint recurrence_monthly_needs_day
    check (pattern <> 'monthly' or day_of_month is not null),
  foreign key (project_id, workspace_id) references public.projects(id, workspace_id) on delete cascade,
  foreign key (workspace_id, created_by) references public.workspace_members(workspace_id, user_id) on delete cascade
);

create index if not exists recurrence_rules_project_idx
  on public.recurrence_rules (workspace_id, project_id);

-- Deleting a rule must never delete work already done, so occurrences are
-- detached rather than cascaded.
alter table public.work_items
  add column if not exists recurrence_rule_id uuid references public.recurrence_rules(id) on delete set null;

alter table public.work_items
  add column if not exists occurrence_date date;

-- Makes generation safe to run twice, including from two devices at once. A
-- partial index so it never applies to ordinary non-recurring tasks.
create unique index if not exists work_items_occurrence_idx
  on public.work_items (recurrence_rule_id, occurrence_date)
  where recurrence_rule_id is not null;

alter table public.daily_plans
  add column if not exists recurring_missed_count integer not null default 0;

create trigger set_recurrence_rules_updated_at
before update on public.recurrence_rules
for each row execute function public.set_updated_at();

alter table public.recurrence_rules enable row level security;

create policy "Members can view recurrence rules"
on public.recurrence_rules for select
using (exists (select 1 from public.workspace_members m where m.workspace_id = recurrence_rules.workspace_id and m.user_id = auth.uid()));

create policy "Members can create recurrence rules"
on public.recurrence_rules for insert
with check (
  created_by = auth.uid()
  and exists (select 1 from public.workspace_members m where m.workspace_id = recurrence_rules.workspace_id and m.user_id = auth.uid())
);

create policy "Members can update recurrence rules"
on public.recurrence_rules for update
using (exists (select 1 from public.workspace_members m where m.workspace_id = recurrence_rules.workspace_id and m.user_id = auth.uid()));

create policy "Members can delete recurrence rules"
on public.recurrence_rules for delete
using (exists (select 1 from public.workspace_members m where m.workspace_id = recurrence_rules.workspace_id and m.user_id = auth.uid()));
