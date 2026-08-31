# Personal Project Command Center Design

Date: 2026-06-28

## Summary

Build a React web app for planning multiple software projects. The product starts as a personal command center but uses a collaboration-ready Supabase data model from day one.

The first usable version focuses on:

- A cross-project dashboard for attention, blockers, milestones, and project health.
- Project workspaces with kanban work items, subtasks, structured notes, milestones, and weekly reviews.
- Supabase Auth with email/password plus Google, GitHub, and Apple OAuth.
- Supabase Postgres with workspace membership, RLS policies, and complete schema SQL.
- Manual repository and resource links, with no GitHub sync in v1.

## Product Shape

The app is personal-first. After login, the user lands on a dashboard that answers: "What needs my attention across all projects?"

The dashboard shows:

- Priority work across projects.
- Blocked work items.
- Upcoming milestones.
- Project health.
- Recent notes and decisions.

Each project has a focused workspace with:

- Kanban board for larger work items.
- Subtasks/checklists inside each card.
- Milestones and weekly planning/review.
- Structured brainstorming notes: ideas, questions, decisions, risks, references.
- Manual links for repositories, docs, designs, deployments, and related resources.

The backend uses `workspaces` and `workspace_members` immediately, even though the v1 UI behaves like a personal app. This keeps the future team/collaboration path clean.

## App Structure

Primary app areas:

1. Dashboard
   Cross-project command center for next work, blockers, upcoming milestones, health, and recent decisions.

2. Projects
   List of active projects with status, priority, health, repo links, next milestone, and last activity.

3. Project Workspace
   Project detail area with tabs for `Board`, `Tasks`, `Notes`, `Milestones`, and `Review`.

4. Brainstorming
   Structured notes across projects, filterable by type: idea, question, decision, risk, reference.

5. Settings
   Profile, account settings, workspace settings, and future member-management foundations.

Navigation should use a persistent sidebar, project switcher, and quick-create controls for projects, work items, notes, milestones, and reviews.

## UX Direction

The UI should feel like a quiet software planning workspace, not a generic task app or marketing site. It should be compact, repeatable, and built for scanning.

Expected workflows:

- Create a project with status, priority, health, links, and first milestone.
- Plan work by creating kanban cards with priority, status, subtasks, and optional milestone.
- Execute work by moving cards, completing subtasks, and surfacing blocked items.
- Think through work by adding structured notes as ideas, questions, decisions, risks, or references.
- Review weekly by capturing wins, blockers, next focus, and health changes.
- Scan across projects from the dashboard.

The app should use dense but legible lists, split views, tabs, filters, quick-create controls, and clear status signals. After authentication, the useful app should be the first screen.

## Technical Direction

Recommended stack:

- React + TypeScript.
- Vite.
- Supabase Auth and Postgres.
- `@supabase/supabase-js`.
- React Router.
- TanStack Query.
- Tailwind CSS with a small component system and shadcn-style primitives if useful.
- Vercel for preview and production deployments.

Recommended frontend structure:

```text
src/
  components/
  features/
    dashboard/
    notes/
    projects/
    reviews/
    settings/
    work-items/
  lib/
    supabase/
    utils/
```

## Auth And Collaboration Foundation

Supabase Auth providers:

- Email/password.
- Google OAuth.
- GitHub OAuth.
- Apple OAuth.

On first sign-in, onboarding is RPC-only: the app should call `public.create_personal_workspace` to create a personal workspace and add the user as `owner` in `workspace_members`.

Roles exist from the start:

- `owner`
- `admin`
- `member`
- `viewer`

The v1 UI does not need full team management, invitations, or project-level permissions. The data model should support multiple workspace members so those features can be added later without rebuilding the schema.

## Data Model

Core tables:

- `workspaces`
- `workspace_members`
- `projects`
- `project_links`
- `milestones`
- `work_items`
- `subtasks`
- `notes`
- `weekly_reviews`

Important modeling decisions:

- Kanban cards and todos use a parent/child model: `work_items` are larger cards; `subtasks` are checklist items inside a card.
- Structured brainstorming notes are stored in `notes` with a `note_type` enum.
- Risks are notes in v1, not a separate risk table.
- Project links are manual in v1. No GitHub import/sync.
- RLS is based on workspace membership, not direct user ownership.

## Supabase SQL

Run this SQL in Supabase to create the initial schema. It includes enums, tables, indexes, updated-at triggers, RLS enablement, grants, and policies.

```sql
create extension if not exists pgcrypto;

create schema if not exists private;
revoke all on schema private from public;

create type public.workspace_role as enum ('owner', 'admin', 'member', 'viewer');
create type public.project_status as enum ('active', 'paused', 'completed', 'archived');
create type public.project_priority as enum ('low', 'medium', 'high', 'critical');
create type public.project_health as enum ('good', 'watch', 'at_risk', 'blocked');
create type public.work_item_status as enum ('backlog', 'ready', 'in_progress', 'blocked', 'review', 'done');
create type public.note_type as enum ('idea', 'question', 'decision', 'risk', 'reference');
create type public.link_type as enum ('repository', 'documentation', 'design', 'deployment', 'issue_tracker', 'other');

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.workspace_role not null default 'member',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  description text,
  status public.project_status not null default 'active',
  priority public.project_priority not null default 'medium',
  health public.project_health not null default 'good',
  color text,
  repository_url text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id)
);

create table public.project_links (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid not null,
  link_type public.link_type not null default 'other',
  label text not null,
  url text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (project_id, workspace_id) references public.projects(id, workspace_id) on delete cascade
);

create table public.milestones (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid not null,
  title text not null,
  description text,
  target_date date,
  completed_at timestamptz,
  sort_order integer not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id),
  unique (id, workspace_id, project_id),
  foreign key (project_id, workspace_id) references public.projects(id, workspace_id) on delete cascade
);

create table public.work_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid not null,
  milestone_id uuid,
  title text not null,
  description text,
  status public.work_item_status not null default 'backlog',
  priority public.project_priority not null default 'medium',
  due_date date,
  estimate_points numeric(6, 2),
  sort_order integer not null default 0,
  blocked_reason text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (id, workspace_id),
  unique (id, workspace_id, project_id),
  foreign key (project_id, workspace_id) references public.projects(id, workspace_id) on delete cascade,
  foreign key (milestone_id, workspace_id, project_id) references public.milestones(id, workspace_id, project_id) on delete set null (milestone_id)
);

create table public.subtasks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  work_item_id uuid not null,
  title text not null,
  is_done boolean not null default false,
  sort_order integer not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  foreign key (work_item_id, workspace_id) references public.work_items(id, workspace_id) on delete cascade
);

create table public.notes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid,
  work_item_id uuid,
  note_type public.note_type not null default 'idea',
  title text not null,
  body text,
  tags text[] not null default '{}',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (work_item_id is null or project_id is not null),
  foreign key (project_id, workspace_id) references public.projects(id, workspace_id) on delete cascade,
  foreign key (work_item_id, workspace_id, project_id) references public.work_items(id, workspace_id, project_id) on delete cascade
);

create table public.weekly_reviews (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid,
  week_start date not null,
  wins text,
  blockers text,
  next_focus text,
  health public.project_health,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (project_id, workspace_id) references public.projects(id, workspace_id) on delete cascade
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.create_personal_workspace(workspace_name text default null)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_user_id uuid;
  new_workspace_id uuid;
begin
  current_user_id := (select auth.uid());

  if current_user_id is null then
    raise exception 'Authentication required to create a workspace';
  end if;

  insert into public.workspaces (name, created_by)
  values (coalesce(nullif(btrim(workspace_name), ''), 'Personal Workspace'), current_user_id)
  returning id into new_workspace_id;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (new_workspace_id, current_user_id, 'owner');

  return new_workspace_id;
end;
$$;

create or replace function private.is_workspace_member(target_workspace_id uuid)
returns boolean
language sql
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = target_workspace_id
      and wm.user_id = (select auth.uid())
  );
$$;

create or replace function private.has_workspace_role(
  target_workspace_id uuid,
  allowed_roles public.workspace_role[]
)
returns boolean
language sql
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = target_workspace_id
      and wm.user_id = (select auth.uid())
      and wm.role = any(allowed_roles)
  );
$$;

revoke all on function public.create_personal_workspace(text) from public;
grant execute on function public.create_personal_workspace(text) to authenticated;
revoke all on function private.is_workspace_member(uuid) from public;
revoke all on function private.has_workspace_role(uuid, public.workspace_role[]) from public;
grant usage on schema private to authenticated;
grant execute on function private.is_workspace_member(uuid) to authenticated;
grant execute on function private.has_workspace_role(uuid, public.workspace_role[]) to authenticated;

create trigger set_workspaces_updated_at
before update on public.workspaces
for each row execute function public.set_updated_at();

create trigger set_workspace_members_updated_at
before update on public.workspace_members
for each row execute function public.set_updated_at();

create trigger set_projects_updated_at
before update on public.projects
for each row execute function public.set_updated_at();

create trigger set_project_links_updated_at
before update on public.project_links
for each row execute function public.set_updated_at();

create trigger set_milestones_updated_at
before update on public.milestones
for each row execute function public.set_updated_at();

create trigger set_work_items_updated_at
before update on public.work_items
for each row execute function public.set_updated_at();

create trigger set_subtasks_updated_at
before update on public.subtasks
for each row execute function public.set_updated_at();

create trigger set_notes_updated_at
before update on public.notes
for each row execute function public.set_updated_at();

create trigger set_weekly_reviews_updated_at
before update on public.weekly_reviews
for each row execute function public.set_updated_at();

create index workspace_members_user_id_idx on public.workspace_members(user_id);
create index workspace_members_workspace_id_idx on public.workspace_members(workspace_id);
create index projects_workspace_id_status_idx on public.projects(workspace_id, status);
create index project_links_project_id_idx on public.project_links(project_id);
create index milestones_project_id_target_date_idx on public.milestones(project_id, target_date);
create index work_items_project_id_status_sort_idx on public.work_items(project_id, status, sort_order);
create index work_items_workspace_id_status_idx on public.work_items(workspace_id, status);
create index work_items_milestone_id_idx on public.work_items(milestone_id);
create index subtasks_work_item_id_sort_idx on public.subtasks(work_item_id, sort_order);
create index notes_workspace_id_note_type_idx on public.notes(workspace_id, note_type);
create index notes_project_id_idx on public.notes(project_id);
create index notes_work_item_id_idx on public.notes(work_item_id);
create index weekly_reviews_workspace_week_idx on public.weekly_reviews(workspace_id, week_start);
create index weekly_reviews_project_week_idx on public.weekly_reviews(project_id, week_start);
create unique index weekly_reviews_project_unique_idx
on public.weekly_reviews(workspace_id, project_id, week_start)
where project_id is not null;
create unique index weekly_reviews_workspace_unique_idx
on public.weekly_reviews(workspace_id, week_start)
where project_id is null;

alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.projects enable row level security;
alter table public.project_links enable row level security;
alter table public.milestones enable row level security;
alter table public.work_items enable row level security;
alter table public.subtasks enable row level security;
alter table public.notes enable row level security;
alter table public.weekly_reviews enable row level security;

grant select, delete on public.workspaces to authenticated;
grant update(name) on public.workspaces to authenticated;
grant select, delete on public.workspace_members to authenticated;
grant update(role) on public.workspace_members to authenticated;
grant select, delete on public.projects to authenticated;
grant insert(workspace_id, name, description, status, priority, health, color, repository_url, created_by) on public.projects to authenticated;
grant update(name, description, status, priority, health, color, repository_url) on public.projects to authenticated;
grant select, delete on public.project_links to authenticated;
grant insert(workspace_id, project_id, link_type, label, url, created_by) on public.project_links to authenticated;
grant update(link_type, label, url) on public.project_links to authenticated;
grant select, delete on public.milestones to authenticated;
grant insert(workspace_id, project_id, title, description, target_date, sort_order, created_by) on public.milestones to authenticated;
grant update(title, description, target_date, completed_at, sort_order) on public.milestones to authenticated;
grant select, delete on public.work_items to authenticated;
grant insert(workspace_id, project_id, milestone_id, title, description, status, priority, due_date, estimate_points, sort_order, blocked_reason, created_by) on public.work_items to authenticated;
grant update(milestone_id, title, description, status, priority, due_date, estimate_points, sort_order, blocked_reason, completed_at) on public.work_items to authenticated;
grant select, delete on public.subtasks to authenticated;
grant insert(workspace_id, work_item_id, title, is_done, sort_order, created_by) on public.subtasks to authenticated;
grant update(title, is_done, sort_order, completed_at) on public.subtasks to authenticated;
grant select, delete on public.notes to authenticated;
grant insert(workspace_id, project_id, work_item_id, note_type, title, body, tags, created_by) on public.notes to authenticated;
grant update(note_type, title, body, tags) on public.notes to authenticated;
grant select, delete on public.weekly_reviews to authenticated;
grant insert(workspace_id, project_id, week_start, wins, blockers, next_focus, health, created_by) on public.weekly_reviews to authenticated;
grant update(week_start, wins, blockers, next_focus, health) on public.weekly_reviews to authenticated;

create policy "Users can view their created or joined workspaces"
on public.workspaces
for select
to authenticated
using (created_by = (select auth.uid()) or private.is_workspace_member(id));

create policy "Workspace owners and admins can update workspaces"
on public.workspaces
for update
to authenticated
using (private.has_workspace_role(id, array['owner', 'admin']::public.workspace_role[]))
with check (private.has_workspace_role(id, array['owner', 'admin']::public.workspace_role[]));

create policy "Workspace owners can delete workspaces"
on public.workspaces
for delete
to authenticated
using (private.has_workspace_role(id, array['owner']::public.workspace_role[]));

create policy "Workspace members can view memberships"
on public.workspace_members
for select
to authenticated
using (private.is_workspace_member(workspace_id));

create policy "Workspace owners can update memberships"
on public.workspace_members
for update
to authenticated
using (private.has_workspace_role(workspace_id, array['owner']::public.workspace_role[]))
with check (
  private.has_workspace_role(workspace_id, array['owner']::public.workspace_role[])
  and (
    user_id <> (select auth.uid())
    or role = 'owner'
  )
);

create policy "Workspace owners can remove memberships"
on public.workspace_members
for delete
to authenticated
using (
  private.has_workspace_role(workspace_id, array['owner']::public.workspace_role[])
  and role <> 'owner'
);

create policy "Members can view projects"
on public.projects
for select
to authenticated
using (private.is_workspace_member(workspace_id));

create policy "Members can create projects"
on public.projects
for insert
to authenticated
with check (
  created_by = (select auth.uid())
  and private.has_workspace_role(workspace_id, array['owner', 'admin', 'member']::public.workspace_role[])
);

create policy "Members can update projects"
on public.projects
for update
to authenticated
using (private.has_workspace_role(workspace_id, array['owner', 'admin', 'member']::public.workspace_role[]))
with check (private.has_workspace_role(workspace_id, array['owner', 'admin', 'member']::public.workspace_role[]));

create policy "Owners and admins can delete projects"
on public.projects
for delete
to authenticated
using (private.has_workspace_role(workspace_id, array['owner', 'admin']::public.workspace_role[]));

create policy "Members can view project links"
on public.project_links
for select
to authenticated
using (private.is_workspace_member(workspace_id));

create policy "Members can create project links"
on public.project_links
for insert
to authenticated
with check (
  created_by = (select auth.uid())
  and private.has_workspace_role(workspace_id, array['owner', 'admin', 'member']::public.workspace_role[])
);

create policy "Members can update project links"
on public.project_links
for update
to authenticated
using (private.has_workspace_role(workspace_id, array['owner', 'admin', 'member']::public.workspace_role[]))
with check (private.has_workspace_role(workspace_id, array['owner', 'admin', 'member']::public.workspace_role[]));

create policy "Owners and admins can delete project links"
on public.project_links
for delete
to authenticated
using (private.has_workspace_role(workspace_id, array['owner', 'admin']::public.workspace_role[]));

create policy "Members can view milestones"
on public.milestones
for select
to authenticated
using (private.is_workspace_member(workspace_id));

create policy "Members can create milestones"
on public.milestones
for insert
to authenticated
with check (
  created_by = (select auth.uid())
  and private.has_workspace_role(workspace_id, array['owner', 'admin', 'member']::public.workspace_role[])
);

create policy "Members can update milestones"
on public.milestones
for update
to authenticated
using (private.has_workspace_role(workspace_id, array['owner', 'admin', 'member']::public.workspace_role[]))
with check (private.has_workspace_role(workspace_id, array['owner', 'admin', 'member']::public.workspace_role[]));

create policy "Owners and admins can delete milestones"
on public.milestones
for delete
to authenticated
using (private.has_workspace_role(workspace_id, array['owner', 'admin']::public.workspace_role[]));

create policy "Members can view work items"
on public.work_items
for select
to authenticated
using (private.is_workspace_member(workspace_id));

create policy "Members can create work items"
on public.work_items
for insert
to authenticated
with check (
  created_by = (select auth.uid())
  and private.has_workspace_role(workspace_id, array['owner', 'admin', 'member']::public.workspace_role[])
);

create policy "Members can update work items"
on public.work_items
for update
to authenticated
using (private.has_workspace_role(workspace_id, array['owner', 'admin', 'member']::public.workspace_role[]))
with check (private.has_workspace_role(workspace_id, array['owner', 'admin', 'member']::public.workspace_role[]));

create policy "Owners and admins can delete work items"
on public.work_items
for delete
to authenticated
using (private.has_workspace_role(workspace_id, array['owner', 'admin']::public.workspace_role[]));

create policy "Members can view subtasks"
on public.subtasks
for select
to authenticated
using (private.is_workspace_member(workspace_id));

create policy "Members can create subtasks"
on public.subtasks
for insert
to authenticated
with check (
  created_by = (select auth.uid())
  and private.has_workspace_role(workspace_id, array['owner', 'admin', 'member']::public.workspace_role[])
);

create policy "Members can update subtasks"
on public.subtasks
for update
to authenticated
using (private.has_workspace_role(workspace_id, array['owner', 'admin', 'member']::public.workspace_role[]))
with check (private.has_workspace_role(workspace_id, array['owner', 'admin', 'member']::public.workspace_role[]));

create policy "Owners and admins can delete subtasks"
on public.subtasks
for delete
to authenticated
using (private.has_workspace_role(workspace_id, array['owner', 'admin']::public.workspace_role[]));

create policy "Members can view notes"
on public.notes
for select
to authenticated
using (private.is_workspace_member(workspace_id));

create policy "Members can create notes"
on public.notes
for insert
to authenticated
with check (
  created_by = (select auth.uid())
  and private.has_workspace_role(workspace_id, array['owner', 'admin', 'member']::public.workspace_role[])
);

create policy "Members can update notes"
on public.notes
for update
to authenticated
using (private.has_workspace_role(workspace_id, array['owner', 'admin', 'member']::public.workspace_role[]))
with check (private.has_workspace_role(workspace_id, array['owner', 'admin', 'member']::public.workspace_role[]));

create policy "Owners and admins can delete notes"
on public.notes
for delete
to authenticated
using (private.has_workspace_role(workspace_id, array['owner', 'admin']::public.workspace_role[]));

create policy "Members can view weekly reviews"
on public.weekly_reviews
for select
to authenticated
using (private.is_workspace_member(workspace_id));

create policy "Members can create weekly reviews"
on public.weekly_reviews
for insert
to authenticated
with check (
  created_by = (select auth.uid())
  and private.has_workspace_role(workspace_id, array['owner', 'admin', 'member']::public.workspace_role[])
);

create policy "Members can update weekly reviews"
on public.weekly_reviews
for update
to authenticated
using (private.has_workspace_role(workspace_id, array['owner', 'admin', 'member']::public.workspace_role[]))
with check (private.has_workspace_role(workspace_id, array['owner', 'admin', 'member']::public.workspace_role[]));

create policy "Owners and admins can delete weekly reviews"
on public.weekly_reviews
for delete
to authenticated
using (private.has_workspace_role(workspace_id, array['owner', 'admin']::public.workspace_role[]));
```

## Error Handling

Frontend errors should be specific and recoverable:

- Auth errors show inline form messages.
- Failed mutations show toast feedback and leave local form state intact.
- Empty states should include quick-create actions.
- Network/loading states should avoid shifting layouts.
- RLS or permission failures should display a generic "You do not have access to this item" message.

## Testing And Verification

Initial verification should cover:

- Supabase Auth sign-in routes for email/password and configured OAuth providers.
- First-login workspace creation.
- Create/read/update/delete for projects.
- Create/read/update/delete for work items, subtasks, notes, milestones, and weekly reviews.
- Dashboard queries for priority work, blocked work, upcoming milestones, and recent decisions.
- RLS checks proving a user cannot read another workspace without membership.
- Basic responsive UI checks for dashboard, project workspace, and kanban board.
- Vercel preview deployment with required Supabase environment variables configured.

## Deferred Features

Out of scope for v1:

- GitHub issue/PR import or sync.
- Full team invitation UI.
- Project-level access permissions.
- Whiteboard/canvas brainstorming.
- Timers, focus mode, recurring reminders, and analytics.
- Mobile native app.

## Open Implementation Notes

- Raw Supabase generated types should be written to `src/lib/supabase/generated.types.ts`; keep `src/lib/supabase/database.types.ts` as the app-facing narrowed type layer that reflects grant-aware mutation rules.
- The first workspace creation flow is RPC-only: call `public.create_personal_workspace` from app code via `supabase.rpc(...)` after auth callback so workspace and owner membership creation stay transactional.
- Before applying SQL to a live Supabase project, run security/performance advisors and verify RLS behavior with test users.
- Vercel should use Git-based preview deployments for branches/PRs and production deployments from `main`.
- Configure `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in Vercel for Development, Preview, and Production. Do not commit `.env.local`.


