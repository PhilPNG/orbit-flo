# OrbitFlo Operating System Workflows Design

## Summary

Add six workflow features that make OrbitFlo feel more like a personal software-project operating system:

- Project Briefs
- Launch Checklist Mode
- Meeting-to-Tasks Flow
- Daily Shutdown Ritual
- Private Reflection Notes
- Dashboard Widgets

This work should be implemented in two waves. Wave 1 builds the personal workflow core: Project Briefs, Daily Shutdown Ritual, Private Reflections, and the Dashboard Widgets shell. Wave 2 adds execution workflows: Launch Checklist Mode and Meeting-to-Tasks.

## Goals

- Give each project a clear source of truth beyond tasks and notes.
- Help users close the day intentionally and resume tomorrow with less friction.
- Support private personal reflection separately from team/project notes.
- Make Mission Control customizable without turning the dashboard into a settings maze.
- Add structured launch and meeting workflows that can create useful tasks.
- Keep all Supabase schema changes explicit, reviewable, and safe for Vercel deployment.

## Non-Goals

- No AI extraction or summarization in this pass.
- No new team role model beyond existing workspace membership. Project workflows are workspace-shared; private reflections and dashboard preferences are user-private.
- No recurring calendar automation.
- No public template marketplace.
- No renaming existing tables or package identifiers.

## Data Model

The feature set should add first-class structured tables instead of overloading generic notes for everything. Existing `projects`, `work_items`, `daily_plans`, and `notes` remain unchanged unless a query needs to join against the new tables.

### SQL Commands

```sql
create table if not exists public.project_briefs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  goal text not null default '',
  audience text not null default '',
  success_criteria text not null default '',
  constraints text not null default '',
  status_summary text not null default '',
  next_milestone text not null default '',
  links jsonb not null default '[]'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, project_id)
);

create table if not exists public.launch_checklists (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  milestone_id uuid references public.milestones(id) on delete set null,
  title text not null default 'Launch checklist',
  checklist_items jsonb not null default '[]'::jsonb,
  completed_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.meeting_notes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  title text not null,
  meeting_date date not null default current_date,
  attendees text[] not null default '{}',
  discussion text not null default '',
  decisions text not null default '',
  risks text not null default '',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.meeting_action_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  meeting_note_id uuid not null references public.meeting_notes(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  work_item_id uuid references public.work_items(id) on delete set null,
  title text not null,
  owner_label text not null default '',
  due_date date,
  is_converted boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.daily_shutdowns (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  daily_plan_id uuid references public.daily_plans(id) on delete set null,
  shutdown_date date not null default current_date,
  shipped text not null default '',
  moved_forward text not null default '',
  blocked text not null default '',
  resume_tomorrow text not null default '',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, created_by, shutdown_date)
);

create table if not exists public.private_reflections (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  reflection_date date not null default current_date,
  title text not null default 'Private reflection',
  body text not null default '',
  mood text not null default '',
  tags text[] not null default '{}',
  created_by uuid references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.dashboard_widget_preferences (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  widget_key text not null,
  is_visible boolean not null default true,
  sort_order integer not null default 0,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, user_id, widget_key)
);

create index if not exists project_briefs_workspace_project_idx
  on public.project_briefs (workspace_id, project_id);

create index if not exists launch_checklists_workspace_project_idx
  on public.launch_checklists (workspace_id, project_id);

create index if not exists meeting_notes_workspace_project_date_idx
  on public.meeting_notes (workspace_id, project_id, meeting_date desc);

create index if not exists meeting_action_items_meeting_idx
  on public.meeting_action_items (workspace_id, meeting_note_id);

create index if not exists daily_shutdowns_workspace_user_date_idx
  on public.daily_shutdowns (workspace_id, created_by, shutdown_date desc);

create index if not exists private_reflections_workspace_user_date_idx
  on public.private_reflections (workspace_id, created_by, reflection_date desc);

create index if not exists dashboard_widget_preferences_workspace_user_idx
  on public.dashboard_widget_preferences (workspace_id, user_id, sort_order);

alter table public.project_briefs enable row level security;
alter table public.launch_checklists enable row level security;
alter table public.meeting_notes enable row level security;
alter table public.meeting_action_items enable row level security;
alter table public.daily_shutdowns enable row level security;
alter table public.private_reflections enable row level security;
alter table public.dashboard_widget_preferences enable row level security;

create policy "Workspace members can read project briefs"
  on public.project_briefs for select
  using (private.is_workspace_member(workspace_id));

create policy "Workspace members can manage project briefs"
  on public.project_briefs for all
  using (private.is_workspace_member(workspace_id))
  with check (private.is_workspace_member(workspace_id));

create policy "Workspace members can read launch checklists"
  on public.launch_checklists for select
  using (private.is_workspace_member(workspace_id));

create policy "Workspace members can manage launch checklists"
  on public.launch_checklists for all
  using (private.is_workspace_member(workspace_id))
  with check (private.is_workspace_member(workspace_id));

create policy "Workspace members can read meeting notes"
  on public.meeting_notes for select
  using (private.is_workspace_member(workspace_id));

create policy "Workspace members can manage meeting notes"
  on public.meeting_notes for all
  using (private.is_workspace_member(workspace_id))
  with check (private.is_workspace_member(workspace_id));

create policy "Workspace members can read meeting action items"
  on public.meeting_action_items for select
  using (private.is_workspace_member(workspace_id));

create policy "Workspace members can manage meeting action items"
  on public.meeting_action_items for all
  using (private.is_workspace_member(workspace_id))
  with check (private.is_workspace_member(workspace_id));

create policy "Users can read their own daily shutdowns"
  on public.daily_shutdowns for select
  using (created_by = auth.uid() and private.is_workspace_member(workspace_id));

create policy "Users can manage their own daily shutdowns"
  on public.daily_shutdowns for all
  using (created_by = auth.uid() and private.is_workspace_member(workspace_id))
  with check (created_by = auth.uid() and private.is_workspace_member(workspace_id));

create policy "Users can read their own private reflections"
  on public.private_reflections for select
  using (created_by = auth.uid() and private.is_workspace_member(workspace_id));

create policy "Users can manage their own private reflections"
  on public.private_reflections for all
  using (created_by = auth.uid() and private.is_workspace_member(workspace_id))
  with check (created_by = auth.uid() and private.is_workspace_member(workspace_id));

create policy "Users can read their own dashboard widget preferences"
  on public.dashboard_widget_preferences for select
  using (user_id = auth.uid() and private.is_workspace_member(workspace_id));

create policy "Users can manage their own dashboard widget preferences"
  on public.dashboard_widget_preferences for all
  using (user_id = auth.uid() and private.is_workspace_member(workspace_id))
  with check (user_id = auth.uid() and private.is_workspace_member(workspace_id));
```

The schema uses the existing `private.is_workspace_member(workspace_id)` helper already present in the current migrations.

## Product Design

### Project Briefs

Project Briefs live in the project workspace, near the top of the page before the board tabs. The brief should feel like a compact mission dossier:

- Goal
- Audience or user
- Success criteria
- Constraints
- Status summary
- Next milestone
- Links

The first version should support viewing, inline editing, saving, and empty states. The brief should be unique per project.

### Launch Checklist Mode

Launch checklists live in the project workspace and can optionally attach to a milestone. The default checklist should include:

- Tests pass
- Documentation updated
- Review completed
- Deployment path confirmed
- Rollback plan captured
- Screenshots or proof captured
- Follow-up tasks created

Users can check items, add custom items, and mark the checklist complete. In Wave 2, completed launch checklist items can optionally create follow-up work items.

### Meeting-to-Tasks Flow

Meeting notes should support structured capture:

- Title
- Date
- Attendees
- Discussion
- Decisions
- Risks
- Action items

Action items can be converted into `work_items`. Converted action items should store the created `work_item_id` and show a converted state so users do not duplicate tasks.

### Daily Shutdown Ritual

Daily Shutdown lives in Daily Mission Control below the focus/review area. It captures:

- What shipped
- What moved forward
- What got blocked
- What to resume tomorrow

There should be one shutdown per user per workspace per date. Saving should be gentle and fast, with a clear success state.

### Private Reflection Notes

Private reflections are personal, not team/project notes. They can live in Daily Mission Control first, then later get a dedicated Reflection page if the feature grows.

Reflections include:

- Date
- Title
- Body
- Mood
- Tags

Only the author can read or manage their reflections. Workspace members should not see another user's reflections, even after collaboration features expand.

### Dashboard Widgets

Mission Control should gain a widget customization shell. Users can toggle and order widgets such as:

- Project health
- Priority work
- Blocked work
- Upcoming milestones
- Recent decisions
- Daily shutdown
- Private reflection
- Launch checklist
- Inbox
- Calendar

The first version should support visible/hidden toggles and persisted sort order. Drag reordering can be deferred if needed; up/down controls are acceptable for the first version.

## Frontend Architecture

Add feature folders or modules with focused query and component files:

- `src/features/projects/project-brief.queries.ts`
- `src/features/projects/project-brief-panel.tsx`
- `src/features/projects/launch-checklist.queries.ts`
- `src/features/projects/launch-checklist-panel.tsx`
- `src/features/meetings/meeting-notes.queries.ts`
- `src/features/meetings/meeting-notes-page.tsx`
- `src/features/daily/daily-shutdown.queries.ts`
- `src/features/daily/daily-shutdown-panel.tsx`
- `src/features/daily/private-reflections.queries.ts`
- `src/features/daily/private-reflection-panel.tsx`
- `src/features/dashboard/dashboard-widgets.queries.ts`
- `src/features/dashboard/dashboard-widget-customizer.tsx`

Keep each panel independently testable. The project workspace and daily mission control pages should only orchestrate queries and pass callbacks into panels.

## Error Handling

- Missing workspace or user should render the existing `EmptyState` pattern.
- Query failures should show module-specific error messages inside the relevant panel.
- Save failures should preserve form input.
- Conversion failures from meeting action item to task should leave the action item unconverted.
- Dashboard widget preference failures should fall back to default widgets.

## Testing

Add focused unit/component tests for:

- Project brief create/update and display.
- Launch checklist default items, custom items, and completion.
- Meeting note creation and action item conversion.
- Daily shutdown create/update for the current date.
- Private reflection visibility and save behavior.
- Dashboard widget preference toggles and ordering.

Add query tests for each new Supabase query module. Add e2e smoke coverage for the authenticated shell only if existing test helpers support auth; otherwise keep the unauthenticated e2e smoke unchanged.

## Rollout Plan

1. Add Supabase migration and update database types.
2. Implement Wave 1 query modules and tests.
3. Implement Project Brief, Daily Shutdown, Private Reflection, and Dashboard Widget shell.
4. Run tests, build, and e2e smoke.
5. Implement Wave 2 query modules and tests.
6. Implement Launch Checklist and Meeting-to-Tasks.
7. Run full verification again.

## Open Decisions

- Meeting notes should probably get a top-level nav item later, but Wave 2 can start from project workspace to reduce navigation churn.
- Private reflections should start inside Daily Mission Control and only become a dedicated route if the journal grows.
- Dashboard widget ordering can use simple up/down controls first; drag sorting is a polish pass.
