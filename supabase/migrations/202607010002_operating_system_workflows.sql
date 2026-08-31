create table if not exists public.project_briefs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid not null,
  goal text not null default '',
  audience text not null default '',
  success_criteria text not null default '',
  constraints text not null default '',
  status_summary text not null default '',
  next_milestone text not null default '',
  links jsonb not null default '[]'::jsonb,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, project_id),
  foreign key (project_id, workspace_id) references public.projects(id, workspace_id) on delete cascade
);

create table if not exists public.launch_checklists (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid not null,
  milestone_id uuid,
  title text not null default 'Launch checklist',
  checklist_items jsonb not null default '[]'::jsonb,
  completed_at timestamptz,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (project_id, workspace_id) references public.projects(id, workspace_id) on delete cascade,
  foreign key (milestone_id, workspace_id, project_id) references public.milestones(id, workspace_id, project_id) on delete set null (milestone_id)
);

create table if not exists public.meeting_notes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid,
  title text not null,
  meeting_date date not null default current_date,
  attendees text[] not null default '{}',
  discussion text not null default '',
  decisions text not null default '',
  risks text not null default '',
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id),
  foreign key (project_id, workspace_id) references public.projects(id, workspace_id) on delete cascade
);

create table if not exists public.meeting_action_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  meeting_note_id uuid not null,
  project_id uuid,
  work_item_id uuid,
  title text not null,
  owner_label text not null default '',
  due_date date,
  is_converted boolean not null default false,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (work_item_id is null or project_id is not null),
  foreign key (meeting_note_id, workspace_id) references public.meeting_notes(id, workspace_id) on delete cascade,
  foreign key (project_id, workspace_id) references public.projects(id, workspace_id) on delete cascade,
  foreign key (work_item_id, workspace_id, project_id) references public.work_items(id, workspace_id, project_id) on delete set null (work_item_id)
);

create table if not exists public.daily_shutdowns (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  daily_plan_id uuid,
  shutdown_date date not null default current_date,
  shipped text not null default '',
  moved_forward text not null default '',
  blocked text not null default '',
  resume_tomorrow text not null default '',
  created_by uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, created_by, shutdown_date),
  foreign key (workspace_id, created_by) references public.workspace_members(workspace_id, user_id) on delete cascade,
  foreign key (daily_plan_id, workspace_id) references public.daily_plans(id, workspace_id) on delete set null (daily_plan_id)
);

create table if not exists public.private_reflections (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  reflection_date date not null default current_date,
  title text not null default 'Private reflection',
  body text not null default '',
  mood text not null default '',
  tags text[] not null default '{}',
  created_by uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (workspace_id, created_by) references public.workspace_members(workspace_id, user_id) on delete cascade
);

create table if not exists public.dashboard_widget_preferences (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  widget_key text not null,
  is_visible boolean not null default true,
  sort_order integer not null default 0,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, user_id, widget_key),
  foreign key (workspace_id, user_id) references public.workspace_members(workspace_id, user_id) on delete cascade
);

create trigger set_project_briefs_updated_at
before update on public.project_briefs
for each row execute function public.set_updated_at();

create trigger set_launch_checklists_updated_at
before update on public.launch_checklists
for each row execute function public.set_updated_at();

create trigger set_meeting_notes_updated_at
before update on public.meeting_notes
for each row execute function public.set_updated_at();

create trigger set_meeting_action_items_updated_at
before update on public.meeting_action_items
for each row execute function public.set_updated_at();

create trigger set_daily_shutdowns_updated_at
before update on public.daily_shutdowns
for each row execute function public.set_updated_at();

create trigger set_private_reflections_updated_at
before update on public.private_reflections
for each row execute function public.set_updated_at();

create trigger set_dashboard_widget_preferences_updated_at
before update on public.dashboard_widget_preferences
for each row execute function public.set_updated_at();

create index if not exists project_briefs_project_idx
  on public.project_briefs (project_id, workspace_id);

create index if not exists launch_checklists_project_idx
  on public.launch_checklists (project_id, workspace_id);

create index if not exists launch_checklists_milestone_idx
  on public.launch_checklists (milestone_id, workspace_id, project_id);

create index if not exists meeting_notes_project_date_idx
  on public.meeting_notes (project_id, workspace_id, meeting_date desc);

create index if not exists meeting_action_items_meeting_idx
  on public.meeting_action_items (meeting_note_id, workspace_id);

create index if not exists meeting_action_items_project_idx
  on public.meeting_action_items (project_id, workspace_id);

create index if not exists meeting_action_items_work_item_idx
  on public.meeting_action_items (work_item_id, workspace_id, project_id);

create index if not exists daily_shutdowns_daily_plan_idx
  on public.daily_shutdowns (daily_plan_id, workspace_id);

create index if not exists daily_shutdowns_workspace_user_date_idx
  on public.daily_shutdowns (workspace_id, created_by, shutdown_date desc);

create index if not exists private_reflections_workspace_user_date_idx
  on public.private_reflections (workspace_id, created_by, reflection_date desc);

create index if not exists dashboard_widget_preferences_user_idx
  on public.dashboard_widget_preferences (user_id, workspace_id, sort_order);

alter table public.project_briefs enable row level security;
alter table public.launch_checklists enable row level security;
alter table public.meeting_notes enable row level security;
alter table public.meeting_action_items enable row level security;
alter table public.daily_shutdowns enable row level security;
alter table public.private_reflections enable row level security;
alter table public.dashboard_widget_preferences enable row level security;

grant select, delete on public.project_briefs to authenticated;
grant insert(workspace_id, project_id, goal, audience, success_criteria, constraints, status_summary, next_milestone, links, created_by) on public.project_briefs to authenticated;
grant update(goal, audience, success_criteria, constraints, status_summary, next_milestone, links) on public.project_briefs to authenticated;

grant select, delete on public.launch_checklists to authenticated;
grant insert(workspace_id, project_id, milestone_id, title, checklist_items, completed_at, created_by) on public.launch_checklists to authenticated;
grant update(milestone_id, title, checklist_items, completed_at) on public.launch_checklists to authenticated;

grant select, delete on public.meeting_notes to authenticated;
grant insert(workspace_id, project_id, title, meeting_date, attendees, discussion, decisions, risks, created_by) on public.meeting_notes to authenticated;
grant update(project_id, title, meeting_date, attendees, discussion, decisions, risks) on public.meeting_notes to authenticated;

grant select, delete on public.meeting_action_items to authenticated;
grant insert(workspace_id, meeting_note_id, project_id, work_item_id, title, owner_label, due_date, is_converted, created_by) on public.meeting_action_items to authenticated;
grant update(project_id, work_item_id, title, owner_label, due_date, is_converted) on public.meeting_action_items to authenticated;

grant select, delete on public.daily_shutdowns to authenticated;
grant insert(workspace_id, daily_plan_id, shutdown_date, shipped, moved_forward, blocked, resume_tomorrow, created_by) on public.daily_shutdowns to authenticated;
grant update(daily_plan_id, shutdown_date, shipped, moved_forward, blocked, resume_tomorrow) on public.daily_shutdowns to authenticated;

grant select, delete on public.private_reflections to authenticated;
grant insert(workspace_id, reflection_date, title, body, mood, tags, created_by) on public.private_reflections to authenticated;
grant update(reflection_date, title, body, mood, tags) on public.private_reflections to authenticated;

grant select, delete on public.dashboard_widget_preferences to authenticated;
grant insert(workspace_id, user_id, widget_key, is_visible, sort_order, settings) on public.dashboard_widget_preferences to authenticated;
grant update(widget_key, is_visible, sort_order, settings) on public.dashboard_widget_preferences to authenticated;

create policy "Members can view project briefs"
on public.project_briefs
for select
to authenticated
using (private.is_workspace_member(workspace_id));

create policy "Members can create project briefs"
on public.project_briefs
for insert
to authenticated
with check (
  created_by = (select auth.uid())
  and private.has_workspace_role(workspace_id, array['owner', 'admin', 'member']::public.workspace_role[])
);

create policy "Members can update project briefs"
on public.project_briefs
for update
to authenticated
using (private.has_workspace_role(workspace_id, array['owner', 'admin', 'member']::public.workspace_role[]))
with check (private.has_workspace_role(workspace_id, array['owner', 'admin', 'member']::public.workspace_role[]));

create policy "Owners and admins can delete project briefs"
on public.project_briefs
for delete
to authenticated
using (private.has_workspace_role(workspace_id, array['owner', 'admin']::public.workspace_role[]));

create policy "Members can view launch checklists"
on public.launch_checklists
for select
to authenticated
using (private.is_workspace_member(workspace_id));

create policy "Members can create launch checklists"
on public.launch_checklists
for insert
to authenticated
with check (
  created_by = (select auth.uid())
  and private.has_workspace_role(workspace_id, array['owner', 'admin', 'member']::public.workspace_role[])
);

create policy "Members can update launch checklists"
on public.launch_checklists
for update
to authenticated
using (private.has_workspace_role(workspace_id, array['owner', 'admin', 'member']::public.workspace_role[]))
with check (private.has_workspace_role(workspace_id, array['owner', 'admin', 'member']::public.workspace_role[]));

create policy "Owners and admins can delete launch checklists"
on public.launch_checklists
for delete
to authenticated
using (private.has_workspace_role(workspace_id, array['owner', 'admin']::public.workspace_role[]));

create policy "Members can view meeting notes"
on public.meeting_notes
for select
to authenticated
using (private.is_workspace_member(workspace_id));

create policy "Members can create meeting notes"
on public.meeting_notes
for insert
to authenticated
with check (
  created_by = (select auth.uid())
  and private.has_workspace_role(workspace_id, array['owner', 'admin', 'member']::public.workspace_role[])
);

create policy "Members can update meeting notes"
on public.meeting_notes
for update
to authenticated
using (private.has_workspace_role(workspace_id, array['owner', 'admin', 'member']::public.workspace_role[]))
with check (private.has_workspace_role(workspace_id, array['owner', 'admin', 'member']::public.workspace_role[]));

create policy "Owners and admins can delete meeting notes"
on public.meeting_notes
for delete
to authenticated
using (private.has_workspace_role(workspace_id, array['owner', 'admin']::public.workspace_role[]));

create policy "Members can view meeting action items"
on public.meeting_action_items
for select
to authenticated
using (private.is_workspace_member(workspace_id));

create policy "Members can create meeting action items"
on public.meeting_action_items
for insert
to authenticated
with check (
  created_by = (select auth.uid())
  and private.has_workspace_role(workspace_id, array['owner', 'admin', 'member']::public.workspace_role[])
);

create policy "Members can update meeting action items"
on public.meeting_action_items
for update
to authenticated
using (private.has_workspace_role(workspace_id, array['owner', 'admin', 'member']::public.workspace_role[]))
with check (private.has_workspace_role(workspace_id, array['owner', 'admin', 'member']::public.workspace_role[]));

create policy "Owners and admins can delete meeting action items"
on public.meeting_action_items
for delete
to authenticated
using (private.has_workspace_role(workspace_id, array['owner', 'admin']::public.workspace_role[]));

create policy "Users can view their own daily shutdowns"
on public.daily_shutdowns
for select
to authenticated
using (created_by = (select auth.uid()) and private.is_workspace_member(workspace_id));

create policy "Users can create their own daily shutdowns"
on public.daily_shutdowns
for insert
to authenticated
with check (
  created_by = (select auth.uid())
  and private.has_workspace_role(workspace_id, array['owner', 'admin', 'member']::public.workspace_role[])
);

create policy "Users can update their own daily shutdowns"
on public.daily_shutdowns
for update
to authenticated
using (created_by = (select auth.uid()) and private.is_workspace_member(workspace_id))
with check (created_by = (select auth.uid()) and private.is_workspace_member(workspace_id));

create policy "Users can delete their own daily shutdowns"
on public.daily_shutdowns
for delete
to authenticated
using (created_by = (select auth.uid()) and private.is_workspace_member(workspace_id));

create policy "Users can view their own private reflections"
on public.private_reflections
for select
to authenticated
using (created_by = (select auth.uid()) and private.is_workspace_member(workspace_id));

create policy "Users can create their own private reflections"
on public.private_reflections
for insert
to authenticated
with check (
  created_by = (select auth.uid())
  and private.has_workspace_role(workspace_id, array['owner', 'admin', 'member']::public.workspace_role[])
);

create policy "Users can update their own private reflections"
on public.private_reflections
for update
to authenticated
using (created_by = (select auth.uid()) and private.is_workspace_member(workspace_id))
with check (created_by = (select auth.uid()) and private.is_workspace_member(workspace_id));

create policy "Users can delete their own private reflections"
on public.private_reflections
for delete
to authenticated
using (created_by = (select auth.uid()) and private.is_workspace_member(workspace_id));

create policy "Users can view their own dashboard widget preferences"
on public.dashboard_widget_preferences
for select
to authenticated
using (user_id = (select auth.uid()) and private.is_workspace_member(workspace_id));

create policy "Users can create their own dashboard widget preferences"
on public.dashboard_widget_preferences
for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and private.has_workspace_role(workspace_id, array['owner', 'admin', 'member']::public.workspace_role[])
);

create policy "Users can update their own dashboard widget preferences"
on public.dashboard_widget_preferences
for update
to authenticated
using (user_id = (select auth.uid()) and private.is_workspace_member(workspace_id))
with check (user_id = (select auth.uid()) and private.is_workspace_member(workspace_id));

create policy "Users can delete their own dashboard widget preferences"
on public.dashboard_widget_preferences
for delete
to authenticated
using (user_id = (select auth.uid()) and private.is_workspace_member(workspace_id));

create or replace function public.create_meeting_note_with_actions(
  p_workspace_id uuid,
  p_project_id uuid,
  p_title text,
  p_meeting_date date,
  p_attendees text[],
  p_discussion text,
  p_decisions text,
  p_risks text,
  p_action_items jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_meeting_note public.meeting_notes%rowtype;
  v_action_items jsonb := '[]'::jsonb;
begin
  insert into public.meeting_notes (
    workspace_id,
    project_id,
    title,
    meeting_date,
    attendees,
    discussion,
    decisions,
    risks,
    created_by
  )
  values (
    p_workspace_id,
    p_project_id,
    trim(p_title),
    p_meeting_date,
    coalesce(p_attendees, '{}'::text[]),
    coalesce(p_discussion, ''),
    coalesce(p_decisions, ''),
    coalesce(p_risks, ''),
    (select auth.uid())
  )
  returning * into v_meeting_note;

  with parsed_action_items as (
    select
      trim(coalesce(action_item.title, '')) as title,
      trim(coalesce(action_item.owner_label, '')) as owner_label,
      nullif(action_item.due_date, '')::date as due_date
    from jsonb_to_recordset(coalesce(p_action_items, '[]'::jsonb)) as action_item(
      title text,
      owner_label text,
      due_date text
    )
  ),
  inserted_action_items as (
    insert into public.meeting_action_items (
      workspace_id,
      meeting_note_id,
      project_id,
      title,
      owner_label,
      due_date,
      created_by
    )
    select
      p_workspace_id,
      v_meeting_note.id,
      p_project_id,
      parsed_action_items.title,
      parsed_action_items.owner_label,
      parsed_action_items.due_date,
      (select auth.uid())
    from parsed_action_items
    where length(parsed_action_items.title) > 0
    returning *
  )
  select coalesce(jsonb_agg(to_jsonb(inserted_action_items) order by inserted_action_items.created_at), '[]'::jsonb)
  into v_action_items
  from inserted_action_items;

  return jsonb_build_object(
    'meetingNote', to_jsonb(v_meeting_note),
    'actionItems', v_action_items
  );
end;
$$;

create or replace function public.convert_meeting_action_item_to_task(
  p_action_item_id uuid,
  p_workspace_id uuid,
  p_project_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_action_item public.meeting_action_items%rowtype;
  v_updated_action_item public.meeting_action_items%rowtype;
  v_work_item public.work_items%rowtype;
begin
  select *
  into v_action_item
  from public.meeting_action_items
  where id = p_action_item_id
    and workspace_id = p_workspace_id
    and project_id = p_project_id
  for update;

  if not found then
    raise exception 'Meeting action item not found'
      using errcode = 'P0002';
  end if;

  if v_action_item.is_converted or v_action_item.work_item_id is not null then
    return jsonb_build_object(
      'actionItem', to_jsonb(v_action_item),
      'workItem', null,
      'alreadyConverted', true
    );
  end if;

  insert into public.work_items (
    workspace_id,
    project_id,
    title,
    description,
    due_date,
    priority,
    status,
    created_by
  )
  values (
    p_workspace_id,
    p_project_id,
    v_action_item.title,
    nullif(concat('Owner: ', nullif(v_action_item.owner_label, '')), 'Owner: '),
    v_action_item.due_date,
    'medium',
    'ready',
    (select auth.uid())
  )
  returning * into v_work_item;

  update public.meeting_action_items
  set
    work_item_id = v_work_item.id,
    is_converted = true
  where id = p_action_item_id
    and workspace_id = p_workspace_id
    and project_id = p_project_id
  returning * into v_updated_action_item;

  return jsonb_build_object(
    'actionItem', to_jsonb(v_updated_action_item),
    'workItem', to_jsonb(v_work_item),
    'alreadyConverted', false
  );
end;
$$;

revoke all on function public.create_meeting_note_with_actions(uuid, uuid, text, date, text[], text, text, text, jsonb) from public;
revoke all on function public.convert_meeting_action_item_to_task(uuid, uuid, uuid) from public;
grant execute on function public.create_meeting_note_with_actions(uuid, uuid, text, date, text[], text, text, text, jsonb) to authenticated;
grant execute on function public.convert_meeting_action_item_to_task(uuid, uuid, uuid) to authenticated;
