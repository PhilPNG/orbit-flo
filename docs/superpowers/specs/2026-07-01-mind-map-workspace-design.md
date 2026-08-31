# OrbitFlo Mind Map Workspace Design

## Summary

Add a Maps workspace to OrbitFlo for planning-first visual thinking. Users can create global maps or project-attached maps, build rich connected nodes, and switch the same map between Mind Map, Flowchart, Timeline, and Decision Tree views.

The feature should bridge brainstorming and execution. A user can start with messy ideas, structure them visually, then link or convert nodes into OrbitFlo objects such as tasks, notes, milestones, meetings, and calendar items.

## Goals

- Provide a flexible visual workspace for brainstorming, planning, and decision mapping.
- Support both global maps and maps attached to a specific project.
- Let users switch between Mind Map, Flowchart, Timeline, and Decision Tree views without duplicating data.
- Support rich node types and conversion actions into existing productivity objects.
- Keep v1 single-user in the UI while making the schema collaboration-ready.
- Use a proven canvas library instead of hand-rolling graph editing behavior.

## Non-Goals

- No realtime multiplayer editing in v1.
- No AI-generated maps in v1.
- No complex version history or node-level audit log in v1.
- No public template marketplace.
- No automatic layout engine beyond view-specific simple layout helpers unless React Flow support is sufficient.
- No dedicated risk or decision database tables in v1 unless already available; risk and decision nodes can remain map nodes.

## Product Shape

### Navigation

Add a top-level `Maps` route at `/maps`.

Add a `Maps` tab inside the project workspace. The project tab shows maps where `project_id` matches the current project.

The same data model powers global and project maps:

- Global map: `project_id` is null.
- Project map: `project_id` references a project in the current workspace.

### Screen Layout

The Maps screen uses a three-pane layout:

- Left pane: map library, search, scope filter, and new map/template actions.
- Center pane: React Flow canvas with pan, zoom, selection, controls, minimap, nodes, and edges.
- Right pane: inspector for the selected map or node.

The top canvas toolbar includes:

- View mode switcher: Mind Map, Flowchart, Timeline, Decision Tree.
- New node action.
- Template action.
- Save action with dirty state.
- Fit view and zoom controls.

### Project Workspace Integration

The project workspace gets a `Maps` tab. It should:

- Query maps for the current `workspace_id` and `project_id`.
- Allow creating a project map from templates.
- Open a selected project map in the same canvas component.
- Let project map nodes convert into project tasks, notes, and milestones.

## View Modes

Each map stores one `default_view`, but the user can switch views at runtime.

### Mind Map

Purpose: early brainstorming and clustering.

Behavior:

- Freeform canvas layout.
- Nodes can branch from a central idea.
- Edges are lightweight associations.
- Useful node types: idea, question, note, risk, decision, task candidate.

### Flowchart

Purpose: workflows, dependencies, and processes.

Behavior:

- Directional edges.
- Visual treatment for start, step, decision, blocker, output, and end nodes.
- Useful for launch flows, bug investigation, onboarding flows, and feature delivery plans.

### Timeline

Purpose: sequence and execution planning.

Behavior:

- Nodes with `start_date`, `due_date`, or `milestone_id` appear in dated lanes.
- Nodes without dates appear in an `Unscheduled` lane.
- Project maps can show linked milestones and task candidates.
- Timeline view remains backed by the same node and edge records as the other views.

### Decision Tree

Purpose: choices, tradeoffs, and outcomes.

Behavior:

- Decision nodes branch into option nodes.
- Outcome nodes can be marked `selected`, `rejected`, or `open`.
- Useful for architecture choices, product prioritization, and planning tradeoffs.

## Node Model

### Node Types

Initial node types:

- `idea`
- `task_candidate`
- `note`
- `milestone`
- `decision`
- `option`
- `risk`
- `reference`

### Node Fields

Each node stores:

- `title`
- `body`
- `node_type`
- `status`
- `position_x`
- `position_y`
- `width`
- `height`
- `accent`
- `start_date`
- `due_date`
- `tags`
- `metadata`
- optional linked object fields
- optional converted object fields

Node statuses:

- `open`
- `selected`
- `rejected`
- `converted`
- `archived`

### Node Actions

Users can:

- Add child node.
- Add sibling node.
- Duplicate node.
- Archive node.
- Link node to existing object.
- Convert node into task.
- Convert node into note.
- Convert node into milestone.
- Mark decision option as selected or rejected.

Converted nodes remain on the canvas and show their converted state. This preserves context and prevents duplicate conversion.

## Templates

Creation supports blank maps and templates.

Initial templates:

- Feature Plan: idea to requirements, tasks, risks, and launch.
- Bug Investigation: symptom, hypotheses, evidence, root cause, fix.
- Launch Flow: checklist, dependencies, approvals, deployment, follow-up.
- Product Roadmap: themes, milestones, timeline, task candidates.
- Decision Tree: decision, options, tradeoffs, selected path.
- Meeting Brainstorm: topics, decisions, action items.

Template behavior:

- Templates create starter nodes and edges.
- Template nodes are editable immediately.
- Project templates pre-link the current project.
- Each template can set a default view.

## Data Model

Use first-class tables instead of storing the whole graph as one JSON blob. This keeps node-level updates, linking, conversion, and future collaboration easier to reason about.

### SQL Commands

```sql
create type public.mind_map_view as enum (
  'mind_map',
  'flowchart',
  'timeline',
  'decision_tree'
);

create type public.mind_map_node_type as enum (
  'idea',
  'task_candidate',
  'note',
  'milestone',
  'decision',
  'option',
  'risk',
  'reference'
);

create type public.mind_map_node_status as enum (
  'open',
  'selected',
  'rejected',
  'converted',
  'archived'
);

create type public.mind_map_edge_type as enum (
  'association',
  'dependency',
  'sequence',
  'choice',
  'outcome'
);

create table if not exists public.mind_maps (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid,
  title text not null,
  description text not null default '',
  default_view public.mind_map_view not null default 'mind_map',
  created_by uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  unique (id, workspace_id),
  foreign key (project_id, workspace_id) references public.projects(id, workspace_id) on delete cascade,
  foreign key (workspace_id, created_by) references public.workspace_members(workspace_id, user_id) on delete cascade
);

create table if not exists public.mind_map_nodes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  map_id uuid not null,
  node_type public.mind_map_node_type not null default 'idea',
  status public.mind_map_node_status not null default 'open',
  title text not null,
  body text not null default '',
  position_x numeric not null default 0,
  position_y numeric not null default 0,
  width numeric,
  height numeric,
  accent text not null default 'cyan',
  start_date date,
  due_date date,
  tags text[] not null default '{}',
  metadata jsonb not null default '{}'::jsonb,
  linked_type text,
  linked_id uuid,
  converted_type text,
  converted_id uuid,
  converted_at timestamptz,
  created_by uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id),
  foreign key (map_id, workspace_id) references public.mind_maps(id, workspace_id) on delete cascade,
  foreign key (workspace_id, created_by) references public.workspace_members(workspace_id, user_id) on delete cascade,
  check ((linked_type is null and linked_id is null) or (linked_type is not null and linked_id is not null)),
  check ((converted_type is null and converted_id is null and converted_at is null) or (converted_type is not null and converted_id is not null and converted_at is not null))
);

create table if not exists public.mind_map_edges (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  map_id uuid not null,
  source_node_id uuid not null,
  target_node_id uuid not null,
  edge_type public.mind_map_edge_type not null default 'association',
  label text not null default '',
  is_directional boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (map_id, workspace_id) references public.mind_maps(id, workspace_id) on delete cascade,
  foreign key (source_node_id, workspace_id) references public.mind_map_nodes(id, workspace_id) on delete cascade,
  foreign key (target_node_id, workspace_id) references public.mind_map_nodes(id, workspace_id) on delete cascade,
  foreign key (workspace_id, created_by) references public.workspace_members(workspace_id, user_id) on delete cascade,
  check (source_node_id <> target_node_id)
);

create index if not exists mind_maps_workspace_updated_idx
  on public.mind_maps (workspace_id, updated_at desc)
  where archived_at is null;

create index if not exists mind_maps_project_updated_idx
  on public.mind_maps (project_id, workspace_id, updated_at desc)
  where archived_at is null;

create index if not exists mind_map_nodes_map_idx
  on public.mind_map_nodes (map_id, workspace_id);

create index if not exists mind_map_nodes_linked_idx
  on public.mind_map_nodes (linked_type, linked_id)
  where linked_type is not null and linked_id is not null;

create index if not exists mind_map_edges_map_idx
  on public.mind_map_edges (map_id, workspace_id);

create index if not exists mind_map_edges_source_idx
  on public.mind_map_edges (source_node_id, workspace_id);

create index if not exists mind_map_edges_target_idx
  on public.mind_map_edges (target_node_id, workspace_id);

alter table public.mind_maps enable row level security;
alter table public.mind_map_nodes enable row level security;
alter table public.mind_map_edges enable row level security;

create trigger set_mind_maps_updated_at
before update on public.mind_maps
for each row execute function public.set_updated_at();

create trigger set_mind_map_nodes_updated_at
before update on public.mind_map_nodes
for each row execute function public.set_updated_at();

create trigger set_mind_map_edges_updated_at
before update on public.mind_map_edges
for each row execute function public.set_updated_at();

grant select, delete on public.mind_maps to authenticated;
grant insert(workspace_id, project_id, title, description, default_view, created_by) on public.mind_maps to authenticated;
grant update(project_id, title, description, default_view, archived_at) on public.mind_maps to authenticated;

grant select, delete on public.mind_map_nodes to authenticated;
grant insert(workspace_id, map_id, node_type, status, title, body, position_x, position_y, width, height, accent, start_date, due_date, tags, metadata, linked_type, linked_id, converted_type, converted_id, converted_at, created_by) on public.mind_map_nodes to authenticated;
grant update(node_type, status, title, body, position_x, position_y, width, height, accent, start_date, due_date, tags, metadata, linked_type, linked_id, converted_type, converted_id, converted_at) on public.mind_map_nodes to authenticated;

grant select, delete on public.mind_map_edges to authenticated;
grant insert(workspace_id, map_id, source_node_id, target_node_id, edge_type, label, is_directional, metadata, created_by) on public.mind_map_edges to authenticated;
grant update(source_node_id, target_node_id, edge_type, label, is_directional, metadata) on public.mind_map_edges to authenticated;

create policy "Members can view mind maps"
on public.mind_maps
for select
to authenticated
using (private.is_workspace_member(workspace_id));

create policy "Members can create mind maps"
on public.mind_maps
for insert
to authenticated
with check (
  created_by = (select auth.uid())
  and private.has_workspace_role(workspace_id, array['owner', 'admin', 'member']::public.workspace_role[])
);

create policy "Members can update mind maps"
on public.mind_maps
for update
to authenticated
using (private.has_workspace_role(workspace_id, array['owner', 'admin', 'member']::public.workspace_role[]))
with check (private.has_workspace_role(workspace_id, array['owner', 'admin', 'member']::public.workspace_role[]));

create policy "Owners and admins can delete mind maps"
on public.mind_maps
for delete
to authenticated
using (private.has_workspace_role(workspace_id, array['owner', 'admin']::public.workspace_role[]));

create policy "Members can view mind map nodes"
on public.mind_map_nodes
for select
to authenticated
using (private.is_workspace_member(workspace_id));

create policy "Members can create mind map nodes"
on public.mind_map_nodes
for insert
to authenticated
with check (
  created_by = (select auth.uid())
  and private.has_workspace_role(workspace_id, array['owner', 'admin', 'member']::public.workspace_role[])
);

create policy "Members can update mind map nodes"
on public.mind_map_nodes
for update
to authenticated
using (private.has_workspace_role(workspace_id, array['owner', 'admin', 'member']::public.workspace_role[]))
with check (private.has_workspace_role(workspace_id, array['owner', 'admin', 'member']::public.workspace_role[]));

create policy "Owners and admins can delete mind map nodes"
on public.mind_map_nodes
for delete
to authenticated
using (private.has_workspace_role(workspace_id, array['owner', 'admin']::public.workspace_role[]));

create policy "Members can view mind map edges"
on public.mind_map_edges
for select
to authenticated
using (private.is_workspace_member(workspace_id));

create policy "Members can create mind map edges"
on public.mind_map_edges
for insert
to authenticated
with check (
  created_by = (select auth.uid())
  and private.has_workspace_role(workspace_id, array['owner', 'admin', 'member']::public.workspace_role[])
);

create policy "Members can update mind map edges"
on public.mind_map_edges
for update
to authenticated
using (private.has_workspace_role(workspace_id, array['owner', 'admin', 'member']::public.workspace_role[]))
with check (private.has_workspace_role(workspace_id, array['owner', 'admin', 'member']::public.workspace_role[]));

create policy "Owners and admins can delete mind map edges"
on public.mind_map_edges
for delete
to authenticated
using (private.has_workspace_role(workspace_id, array['owner', 'admin']::public.workspace_role[]));
```

## Frontend Architecture

Use React Flow for the canvas.

New files:

- `src/features/maps/maps-page.tsx`
- `src/features/maps/maps.queries.ts`
- `src/features/maps/map-canvas.tsx`
- `src/features/maps/map-toolbar.tsx`
- `src/features/maps/map-inspector.tsx`
- `src/features/maps/map-library-panel.tsx`
- `src/features/maps/map-templates.ts`
- `src/features/maps/map-types.ts`
- `src/features/maps/map-layouts.ts`
- `src/features/maps/*.test.tsx`

Route changes:

- Add `/maps`.
- Add Maps nav item in the app shell.
- Add project workspace Maps tab.

Dependency:

- Add `@xyflow/react` for React Flow.

### Component Boundaries

`MapsPage` owns routing-level state:

- selected map
- scope filter
- search text
- create/template modal state

`MapCanvas` owns canvas interaction:

- React Flow nodes and edges
- selected node
- drag/drop
- edge creation
- local graph edits

`MapInspector` owns selected node editing:

- title/body/type/status
- dates
- tags
- linked object fields
- conversion actions

`maps.queries.ts` owns Supabase access:

- list maps
- create map
- update map
- archive map
- get map graph
- create/update/delete nodes
- create/update/delete edges
- conversion helpers where existing query modules are insufficient

## Persistence Strategy

Use explicit save with a dirty indicator for v1.

Reasoning:

- Graph editing creates many small intermediate changes.
- Autosave can create noisy writes and harder conflict behavior.
- Explicit save is easier to test and easier to reason about before collaboration is added.

Behavior:

- Canvas updates local state immediately.
- The toolbar shows unsaved changes.
- Save writes changed nodes and edges.
- Navigation away from a dirty map prompts the user.

## Conversion Behavior

Conversion actions should be available in the inspector.

Initial conversions:

- Node to task: creates `work_items`, marks node converted.
- Node to note: creates `notes`, marks node converted.
- Node to milestone: creates `milestones`, marks node converted.

Rules:

- A converted node keeps its original map position and context.
- A converted node displays the linked created object.
- Re-converting a converted node is blocked unless the user explicitly clears the conversion.
- Project maps should create project-scoped objects.
- Global maps can create notes and tasks only after the user picks a project where needed.

## Error Handling

- Missing workspace: use existing empty state pattern.
- No maps: show a Maps empty state with blank map and templates actions.
- Map load failure: show an error panel in the canvas area.
- Save failure: keep local dirty state and show the error.
- Conversion failure: leave node unconverted and show error in the inspector.
- Unsupported linked object: keep the raw link metadata visible but disable navigation.

## Testing

Add focused tests for:

- Template generation.
- Map list empty state.
- Creating a blank map.
- Creating a map from a template.
- Switching view modes.
- Adding and editing nodes.
- Creating edges.
- Dirty state and explicit save.
- Project workspace Maps tab filtering.
- Node conversion to task, note, and milestone.

Run:

```bash
npm.cmd test -- src/features/maps
npm.cmd test -- src/features/projects/project-workspace-page.test.tsx
npm.cmd run build
```

Optional e2e smoke:

```bash
npm.cmd run e2e
```

## Rollout Plan

1. Add schema and database types.
2. Add React Flow dependency.
3. Build map templates and type utilities.
4. Build Supabase query module.
5. Build map library page shell.
6. Build React Flow canvas and node rendering.
7. Build inspector and edit/save behavior.
8. Add project workspace Maps tab.
9. Add conversion actions.
10. Run focused tests, full tests, build, and e2e smoke.

## Open Decisions

- Whether Maps should replace the current `Brainstorm` nav label or sit beside it as a separate nav item.
- Whether a dedicated `decisions` table should be added later for decisions that outgrow map nodes.
- Whether autosave should replace explicit save after collaboration support is introduced.
