# Mind Map Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a collaboration-ready Maps workspace where users can create global or project-scoped visual maps and switch between Mind Map, Flowchart, Timeline, and Decision Tree views.

**Architecture:** Add first-class Supabase tables for maps, nodes, and edges, then build a focused `src/features/maps` feature using React Flow for canvas behavior. Keep map data normalized and keep view modes as presentation/layout modes over the same saved graph.

**Tech Stack:** React 19, TypeScript, Vite, TanStack Query, Supabase Postgres/Auth/RLS, React Flow via `@xyflow/react`, Vitest, Testing Library, Playwright smoke tests.

---

## Scope Decisions

- Maps gets a separate top-level nav item at `/maps`; it does not replace the existing Brainstorm/Notes route.
- Project workspace gets a `Maps` tab that filters maps by `project_id`.
- v1 uses explicit save with a dirty indicator, not autosave.
- v1 includes Mind Map, Flowchart, Timeline, and Decision Tree view modes.
- v1 supports node conversion to task, note, and milestone.
- v1 does not include realtime collaboration, comments, AI generation, or a decision database table.

---

## File Structure

- Create `supabase/migrations/202607010003_mind_map_workspace.sql`: map schema, RLS, grants, indexes, triggers.
- Modify `src/lib/supabase/database.types.ts`: add map enum types and table types.
- Modify `package.json` and `package-lock.json`: add `@xyflow/react`.
- Create `src/features/maps/map-types.ts`: shared map enums, labels, graph types, conversion types.
- Create `src/features/maps/map-templates.ts`: starter templates and template generation.
- Create `src/features/maps/map-layouts.ts`: view-specific local layout helpers.
- Create `src/features/maps/maps.queries.ts`: Supabase CRUD for maps, nodes, and edges.
- Create `src/features/maps/map-canvas.tsx`: React Flow wrapper and canvas interactions.
- Create `src/features/maps/map-toolbar.tsx`: view switching, save state, canvas commands.
- Create `src/features/maps/map-inspector.tsx`: selected node editing and conversion actions.
- Create `src/features/maps/map-library-panel.tsx`: map list, filters, template actions.
- Create `src/features/maps/maps-page.tsx`: top-level page orchestration.
- Create `src/features/maps/*.test.tsx` and `src/features/maps/*.test.ts`: focused tests.
- Modify `src/app/routes.tsx`: add `/maps`.
- Modify `src/components/app-shell.tsx`: add Maps nav item.
- Modify `src/features/projects/project-workspace-page.tsx`: add `Maps` tab.
- Modify `src/features/projects/project-workspace-page.test.tsx`: mock map queries and assert project tab behavior.

---

### Task 1: Add React Flow Dependency

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Test: `npm.cmd run build`

- [ ] **Step 1: Install React Flow**

Run:

```bash
npm.cmd install @xyflow/react
```

Expected:

- `package.json` contains `@xyflow/react` in `dependencies`.
- `package-lock.json` is updated.

- [ ] **Step 2: Verify dependency resolves**

Run:

```bash
npm.cmd run build
```

Expected: PASS. The existing Vite chunk-size warning is acceptable.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "Add React Flow dependency"
```

---

### Task 2: Supabase Schema And Types

**Files:**
- Create: `supabase/migrations/202607010003_mind_map_workspace.sql`
- Modify: `src/lib/supabase/database.types.ts`
- Test: `npm.cmd run build`

- [ ] **Step 1: Create the migration**

Create `supabase/migrations/202607010003_mind_map_workspace.sql`:

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

- [ ] **Step 2: Add database enum type aliases**

In `src/lib/supabase/database.types.ts`, add these aliases near the existing aliases:

```ts
export type MindMapView = "mind_map" | "flowchart" | "timeline" | "decision_tree";
export type MindMapNodeType =
  | "idea"
  | "task_candidate"
  | "note"
  | "milestone"
  | "decision"
  | "option"
  | "risk"
  | "reference";
export type MindMapNodeStatus = "open" | "selected" | "rejected" | "converted" | "archived";
export type MindMapEdgeType = "association" | "dependency" | "sequence" | "choice" | "outcome";
```

- [ ] **Step 3: Add database table types**

In `src/lib/supabase/database.types.ts`, add `mind_maps`, `mind_map_nodes`, and `mind_map_edges` table entries under `public.Tables`. Use the same explicit `Row`, `Insert`, `Update`, and `Relationships` style as the current workflow tables.

`mind_maps`:

```ts
mind_maps: {
  Row: {
    id: string;
    workspace_id: string;
    project_id: string | null;
    title: string;
    description: string;
    default_view: MindMapView;
    created_by: string;
    created_at: string;
    updated_at: string;
    archived_at: string | null;
  };
  Insert: {
    workspace_id: string;
    project_id?: string | null;
    title: string;
    description?: string;
    default_view?: MindMapView;
    created_by?: string;
  };
  Update: {
    project_id?: string | null;
    title?: string;
    description?: string;
    default_view?: MindMapView;
    archived_at?: string | null;
  };
  Relationships: [];
};
```

`mind_map_nodes`:

```ts
mind_map_nodes: {
  Row: {
    id: string;
    workspace_id: string;
    map_id: string;
    node_type: MindMapNodeType;
    status: MindMapNodeStatus;
    title: string;
    body: string;
    position_x: number;
    position_y: number;
    width: number | null;
    height: number | null;
    accent: string;
    start_date: string | null;
    due_date: string | null;
    tags: string[];
    metadata: Json;
    linked_type: string | null;
    linked_id: string | null;
    converted_type: string | null;
    converted_id: string | null;
    converted_at: string | null;
    created_by: string;
    created_at: string;
    updated_at: string;
  };
  Insert: {
    workspace_id: string;
    map_id: string;
    node_type?: MindMapNodeType;
    status?: MindMapNodeStatus;
    title: string;
    body?: string;
    position_x?: number;
    position_y?: number;
    width?: number | null;
    height?: number | null;
    accent?: string;
    start_date?: string | null;
    due_date?: string | null;
    tags?: string[];
    metadata?: Json;
    linked_type?: string | null;
    linked_id?: string | null;
    converted_type?: string | null;
    converted_id?: string | null;
    converted_at?: string | null;
    created_by?: string;
  };
  Update: {
    node_type?: MindMapNodeType;
    status?: MindMapNodeStatus;
    title?: string;
    body?: string;
    position_x?: number;
    position_y?: number;
    width?: number | null;
    height?: number | null;
    accent?: string;
    start_date?: string | null;
    due_date?: string | null;
    tags?: string[];
    metadata?: Json;
    linked_type?: string | null;
    linked_id?: string | null;
    converted_type?: string | null;
    converted_id?: string | null;
    converted_at?: string | null;
  };
  Relationships: [];
};
```

`mind_map_edges`:

```ts
mind_map_edges: {
  Row: {
    id: string;
    workspace_id: string;
    map_id: string;
    source_node_id: string;
    target_node_id: string;
    edge_type: MindMapEdgeType;
    label: string;
    is_directional: boolean;
    metadata: Json;
    created_by: string;
    created_at: string;
    updated_at: string;
  };
  Insert: {
    workspace_id: string;
    map_id: string;
    source_node_id: string;
    target_node_id: string;
    edge_type?: MindMapEdgeType;
    label?: string;
    is_directional?: boolean;
    metadata?: Json;
    created_by?: string;
  };
  Update: {
    source_node_id?: string;
    target_node_id?: string;
    edge_type?: MindMapEdgeType;
    label?: string;
    is_directional?: boolean;
    metadata?: Json;
  };
  Relationships: [];
};
```

- [ ] **Step 4: Build-check schema types**

Run:

```bash
npm.cmd run build
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/202607010003_mind_map_workspace.sql src/lib/supabase/database.types.ts
git commit -m "Add mind map workspace schema"
```

---

### Task 3: Map Types, Templates, And Layout Helpers

**Files:**
- Create: `src/features/maps/map-types.ts`
- Create: `src/features/maps/map-templates.ts`
- Create: `src/features/maps/map-layouts.ts`
- Create: `src/features/maps/map-templates.test.ts`
- Create: `src/features/maps/map-layouts.test.ts`

- [ ] **Step 1: Write template tests**

Create `src/features/maps/map-templates.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createMapFromTemplate, mapTemplates } from "./map-templates";

describe("map templates", () => {
  it("creates editable nodes and edges from the feature plan template", () => {
    const template = mapTemplates.find((item) => item.id === "feature-plan");
    expect(template).toBeTruthy();

    const graph = createMapFromTemplate("feature-plan", { projectId: "project-1" });

    expect(graph.title).toBe("Feature plan");
    expect(graph.defaultView).toBe("mind_map");
    expect(graph.nodes.length).toBeGreaterThan(3);
    expect(graph.edges.length).toBeGreaterThan(2);
    expect(graph.nodes[0]).toEqual(expect.objectContaining({ projectId: "project-1" }));
  });
});
```

- [ ] **Step 2: Write layout tests**

Create `src/features/maps/map-layouts.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { EditableMapNode } from "./map-types";
import { applyViewLayout } from "./map-layouts";

const nodes: EditableMapNode[] = [
  { id: "node-1", title: "Root", body: "", nodeType: "idea", status: "open", position: { x: 0, y: 0 }, accent: "cyan", tags: [] },
  { id: "node-2", title: "Task", body: "", nodeType: "task_candidate", status: "open", position: { x: 0, y: 0 }, accent: "blue", tags: [], dueDate: "2026-07-10" },
];

describe("applyViewLayout", () => {
  it("places timeline nodes with dates before unscheduled nodes", () => {
    const layout = applyViewLayout("timeline", nodes);

    expect(layout[0].id).toBe("node-2");
    expect(layout[1].id).toBe("node-1");
    expect(layout[0].position.x).toBeLessThan(layout[1].position.x);
  });
});
```

- [ ] **Step 3: Implement shared types**

Create `src/features/maps/map-types.ts`:

```ts
import type { MindMapEdgeType, MindMapNodeStatus, MindMapNodeType, MindMapView } from "../../lib/supabase/database.types";

export const mapViews = ["mind_map", "flowchart", "timeline", "decision_tree"] as const satisfies MindMapView[];
export const mapNodeTypes = ["idea", "task_candidate", "note", "milestone", "decision", "option", "risk", "reference"] as const satisfies MindMapNodeType[];
export const mapNodeStatuses = ["open", "selected", "rejected", "converted", "archived"] as const satisfies MindMapNodeStatus[];
export const mapEdgeTypes = ["association", "dependency", "sequence", "choice", "outcome"] as const satisfies MindMapEdgeType[];

export type MapScope = "all" | "global" | "project";
export type LinkedObjectType = "task" | "note" | "project" | "milestone" | "meeting" | "calendar_item";
export type ConvertedObjectType = "task" | "note" | "milestone";

export type EditableMapNode = {
  id: string;
  projectId?: string | null;
  title: string;
  body: string;
  nodeType: MindMapNodeType;
  status: MindMapNodeStatus;
  position: { x: number; y: number };
  width?: number | null;
  height?: number | null;
  accent: string;
  startDate?: string | null;
  dueDate?: string | null;
  tags: string[];
  linkedType?: LinkedObjectType | null;
  linkedId?: string | null;
  convertedType?: ConvertedObjectType | null;
  convertedId?: string | null;
  convertedAt?: string | null;
};

export type EditableMapEdge = {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  edgeType: MindMapEdgeType;
  label: string;
  isDirectional: boolean;
};

export type EditableMapGraph = {
  title: string;
  description: string;
  defaultView: MindMapView;
  nodes: EditableMapNode[];
  edges: EditableMapEdge[];
};

export function mapViewLabel(view: MindMapView) {
  const labels: Record<MindMapView, string> = {
    mind_map: "Mind Map",
    flowchart: "Flowchart",
    timeline: "Timeline",
    decision_tree: "Decision Tree",
  };
  return labels[view];
}
```

- [ ] **Step 4: Implement templates**

Create `src/features/maps/map-templates.ts` with six templates:

```ts
import type { MindMapView } from "../../lib/supabase/database.types";
import type { EditableMapEdge, EditableMapGraph, EditableMapNode } from "./map-types";

type TemplateContext = { projectId?: string | null };
type MapTemplate = {
  id: string;
  title: string;
  description: string;
  defaultView: MindMapView;
  nodes: Array<Omit<EditableMapNode, "projectId">>;
  edges: EditableMapEdge[];
};

function node(id: string, title: string, x: number, y: number, nodeType: EditableMapNode["nodeType"]): Omit<EditableMapNode, "projectId"> {
  return {
    id,
    title,
    body: "",
    nodeType,
    status: "open",
    position: { x, y },
    accent: nodeType === "risk" ? "rose" : nodeType === "decision" ? "violet" : "cyan",
    tags: [],
  };
}

function edge(id: string, sourceNodeId: string, targetNodeId: string, edgeType: EditableMapEdge["edgeType"] = "association"): EditableMapEdge {
  return { id, sourceNodeId, targetNodeId, edgeType, label: "", isDirectional: edgeType !== "association" };
}

export const mapTemplates: MapTemplate[] = [
  {
    id: "feature-plan",
    title: "Feature plan",
    description: "Map requirements, tasks, risks, and launch work.",
    defaultView: "mind_map",
    nodes: [
      node("feature", "Feature idea", 0, 0, "idea"),
      node("requirements", "Requirements", 260, -120, "note"),
      node("tasks", "Task candidates", 260, 20, "task_candidate"),
      node("risks", "Risks", 260, 160, "risk"),
      node("launch", "Launch path", 520, 20, "milestone"),
    ],
    edges: [
      edge("feature-requirements", "feature", "requirements"),
      edge("feature-tasks", "feature", "tasks"),
      edge("feature-risks", "feature", "risks"),
      edge("tasks-launch", "tasks", "launch", "sequence"),
    ],
  },
  {
    id: "bug-investigation",
    title: "Bug investigation",
    description: "Trace symptoms to evidence, root cause, and fix.",
    defaultView: "flowchart",
    nodes: [node("symptom", "Symptom", 0, 0, "idea"), node("hypothesis", "Hypothesis", 240, 0, "decision"), node("evidence", "Evidence", 480, 0, "note"), node("fix", "Fix", 720, 0, "task_candidate")],
    edges: [edge("symptom-hypothesis", "symptom", "hypothesis", "sequence"), edge("hypothesis-evidence", "hypothesis", "evidence", "sequence"), edge("evidence-fix", "evidence", "fix", "sequence")],
  },
  {
    id: "launch-flow",
    title: "Launch flow",
    description: "Map dependencies, approvals, deploy, and follow-up.",
    defaultView: "flowchart",
    nodes: [node("checklist", "Checklist", 0, 0, "note"), node("dependencies", "Dependencies", 240, 0, "risk"), node("approval", "Approval", 480, 0, "decision"), node("deploy", "Deploy", 720, 0, "milestone"), node("follow-up", "Follow-up", 960, 0, "task_candidate")],
    edges: [edge("checklist-dependencies", "checklist", "dependencies", "sequence"), edge("dependencies-approval", "dependencies", "approval", "sequence"), edge("approval-deploy", "approval", "deploy", "sequence"), edge("deploy-follow-up", "deploy", "follow-up", "sequence")],
  },
  {
    id: "product-roadmap",
    title: "Product roadmap",
    description: "Shape themes, milestones, timeline, and task candidates.",
    defaultView: "timeline",
    nodes: [node("theme", "Theme", 0, 0, "idea"), node("milestone-1", "Milestone 1", 240, 0, "milestone"), node("milestone-2", "Milestone 2", 480, 0, "milestone"), node("task-candidates", "Task candidates", 720, 0, "task_candidate")],
    edges: [edge("theme-m1", "theme", "milestone-1", "sequence"), edge("m1-m2", "milestone-1", "milestone-2", "sequence"), edge("m2-tasks", "milestone-2", "task-candidates", "sequence")],
  },
  {
    id: "decision-tree",
    title: "Decision tree",
    description: "Compare options, tradeoffs, and outcomes.",
    defaultView: "decision_tree",
    nodes: [node("decision", "Decision", 0, 0, "decision"), node("option-a", "Option A", 240, -120, "option"), node("option-b", "Option B", 240, 120, "option"), node("outcome", "Selected path", 520, 0, "note")],
    edges: [edge("decision-a", "decision", "option-a", "choice"), edge("decision-b", "decision", "option-b", "choice"), edge("a-outcome", "option-a", "outcome", "outcome")],
  },
  {
    id: "meeting-brainstorm",
    title: "Meeting brainstorm",
    description: "Capture topics, decisions, and action items.",
    defaultView: "mind_map",
    nodes: [node("topic", "Topic", 0, 0, "idea"), node("decision", "Decision", 240, -90, "decision"), node("action", "Action item", 240, 90, "task_candidate")],
    edges: [edge("topic-decision", "topic", "decision"), edge("topic-action", "topic", "action")],
  },
];

export function createMapFromTemplate(templateId: string, context: TemplateContext = {}): EditableMapGraph {
  const template = mapTemplates.find((item) => item.id === templateId) ?? mapTemplates[0];
  return {
    title: template.title,
    description: template.description,
    defaultView: template.defaultView,
    nodes: template.nodes.map((item) => ({ ...item, projectId: context.projectId ?? null, position: { ...item.position }, tags: [...item.tags] })),
    edges: template.edges.map((item) => ({ ...item })),
  };
}
```

- [ ] **Step 5: Implement layout helpers**

Create `src/features/maps/map-layouts.ts`:

```ts
import type { MindMapView } from "../../lib/supabase/database.types";
import type { EditableMapNode } from "./map-types";

export function applyViewLayout(view: MindMapView, nodes: EditableMapNode[]) {
  if (view === "timeline") {
    return [...nodes]
      .sort((left, right) => {
        const leftDate = left.startDate ?? left.dueDate ?? "9999-12-31";
        const rightDate = right.startDate ?? right.dueDate ?? "9999-12-31";
        return leftDate.localeCompare(rightDate);
      })
      .map((node, index) => ({ ...node, position: { x: index * 260, y: node.startDate || node.dueDate ? 0 : 180 } }));
  }

  if (view === "flowchart") {
    return nodes.map((node, index) => ({ ...node, position: { x: index * 260, y: 0 } }));
  }

  if (view === "decision_tree") {
    return nodes.map((node, index) => ({ ...node, position: { x: Math.floor(index / 2) * 280, y: index % 2 === 0 ? -90 : 90 } }));
  }

  return nodes.map((node, index) => {
    if (index === 0) return { ...node, position: { x: 0, y: 0 } };
    const angle = (index / Math.max(nodes.length - 1, 1)) * Math.PI * 2;
    return { ...node, position: { x: Math.round(Math.cos(angle) * 260), y: Math.round(Math.sin(angle) * 180) } };
  });
}
```

- [ ] **Step 6: Run type/template tests**

Run:

```bash
npm.cmd test -- src/features/maps/map-templates.test.ts src/features/maps/map-layouts.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/features/maps/map-types.ts src/features/maps/map-templates.ts src/features/maps/map-layouts.ts src/features/maps/map-templates.test.ts src/features/maps/map-layouts.test.ts
git commit -m "Add mind map templates and layouts"
```

---

### Task 4: Supabase Query Module

**Files:**
- Create: `src/features/maps/maps.queries.ts`
- Create: `src/features/maps/maps.queries.test.ts`

- [ ] **Step 1: Write query tests**

Create `src/features/maps/maps.queries.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { createMindMap, listMindMaps, toEditableGraph } from "./maps.queries";

function queryBuilder(result: unknown) {
  const builder = {
    select: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    is: vi.fn(() => builder),
    order: vi.fn(() => builder),
    single: vi.fn().mockResolvedValue({ data: result, error: null }),
    then: (resolve: (value: unknown) => void) => resolve({ data: result, error: null }),
  };
  return builder;
}

describe("maps queries", () => {
  it("lists global maps when projectId is null", async () => {
    const builder = queryBuilder([]);
    const client = { from: vi.fn(() => builder) } as never;

    await listMindMaps(client, { workspaceId: "workspace-1", projectId: null });

    expect(client.from).toHaveBeenCalledWith("mind_maps");
    expect(builder.is).toHaveBeenCalledWith("project_id", null);
  });

  it("creates a project map", async () => {
    const builder = queryBuilder({ id: "map-1" });
    const client = { from: vi.fn(() => builder) } as never;

    await createMindMap(client, {
      workspaceId: "workspace-1",
      projectId: "project-1",
      userId: "user-1",
      title: "Feature map",
      description: "",
      defaultView: "mind_map",
    });

    expect(builder.insert).toHaveBeenCalledWith(expect.objectContaining({ project_id: "project-1", title: "Feature map" }));
  });

  it("maps database rows into editable graph state", () => {
    const graph = toEditableGraph({
      map: { title: "Map", description: "", default_view: "mind_map" },
      nodes: [{ id: "node-1", title: "Idea", body: "", node_type: "idea", status: "open", position_x: 10, position_y: 20, width: null, height: null, accent: "cyan", start_date: null, due_date: null, tags: [], linked_type: null, linked_id: null, converted_type: null, converted_id: null, converted_at: null }],
      edges: [],
    } as never);

    expect(graph.nodes[0].position).toEqual({ x: 10, y: 20 });
  });
});
```

- [ ] **Step 2: Implement query module**

Create `src/features/maps/maps.queries.ts`:

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json, MindMapView } from "../../lib/supabase/database.types";
import type { EditableMapEdge, EditableMapGraph, EditableMapNode } from "./map-types";

type Client = SupabaseClient<Database>;
type MindMap = Database["public"]["Tables"]["mind_maps"]["Row"];
type MindMapNode = Database["public"]["Tables"]["mind_map_nodes"]["Row"];
type MindMapEdge = Database["public"]["Tables"]["mind_map_edges"]["Row"];

export const mindMapKeys = {
  list: (workspaceId: string, projectId?: string | null) => ["mind-maps", workspaceId, projectId ?? "global"] as const,
  graph: (workspaceId: string, mapId: string) => ["mind-map-graph", workspaceId, mapId] as const,
};

export type CreateMindMapInput = {
  workspaceId: string;
  projectId?: string | null;
  userId: string;
  title: string;
  description: string;
  defaultView: MindMapView;
};

export async function listMindMaps(client: Client, input: { workspaceId: string; projectId?: string | null }) {
  let query = client
    .from("mind_maps")
    .select("*")
    .eq("workspace_id", input.workspaceId)
    .is("archived_at", null)
    .order("updated_at", { ascending: false });

  query = input.projectId ? query.eq("project_id", input.projectId) : query.is("project_id", null);

  const { data, error } = await query;
  if (error) throw error;
  return data as MindMap[];
}

export async function createMindMap(client: Client, input: CreateMindMapInput) {
  const { data, error } = await client
    .from("mind_maps")
    .insert({
      workspace_id: input.workspaceId,
      project_id: input.projectId ?? null,
      created_by: input.userId,
      title: input.title,
      description: input.description,
      default_view: input.defaultView,
    })
    .select("*")
    .single();

  if (error) throw error;
  return data as MindMap;
}

export async function getMindMapGraph(client: Client, input: { workspaceId: string; mapId: string }) {
  const [{ data: map, error: mapError }, { data: nodes, error: nodesError }, { data: edges, error: edgesError }] = await Promise.all([
    client.from("mind_maps").select("*").eq("workspace_id", input.workspaceId).eq("id", input.mapId).single(),
    client.from("mind_map_nodes").select("*").eq("workspace_id", input.workspaceId).eq("map_id", input.mapId).order("created_at", { ascending: true }),
    client.from("mind_map_edges").select("*").eq("workspace_id", input.workspaceId).eq("map_id", input.mapId).order("created_at", { ascending: true }),
  ]);

  if (mapError) throw mapError;
  if (nodesError) throw nodesError;
  if (edgesError) throw edgesError;
  return toEditableGraph({ map: map as MindMap, nodes: nodes as MindMapNode[], edges: edges as MindMapEdge[] });
}

export async function updateMindMap(client: Client, input: { id: string; workspaceId: string; title: string; description: string; defaultView: MindMapView }) {
  const { data, error } = await client
    .from("mind_maps")
    .update({ title: input.title, description: input.description, default_view: input.defaultView })
    .eq("id", input.id)
    .eq("workspace_id", input.workspaceId)
    .select("*")
    .single();

  if (error) throw error;
  return data as MindMap;
}

export async function replaceMindMapGraph(client: Client, input: { workspaceId: string; mapId: string; userId: string; graph: EditableMapGraph }) {
  const nodeRows = input.graph.nodes.map((node) => ({
    id: node.id,
    workspace_id: input.workspaceId,
    map_id: input.mapId,
    created_by: input.userId,
    node_type: node.nodeType,
    status: node.status,
    title: node.title,
    body: node.body,
    position_x: node.position.x,
    position_y: node.position.y,
    width: node.width ?? null,
    height: node.height ?? null,
    accent: node.accent,
    start_date: node.startDate ?? null,
    due_date: node.dueDate ?? null,
    tags: node.tags,
    metadata: {} as Json,
    linked_type: node.linkedType ?? null,
    linked_id: node.linkedId ?? null,
    converted_type: node.convertedType ?? null,
    converted_id: node.convertedId ?? null,
    converted_at: node.convertedAt ?? null,
  }));

  const edgeRows = input.graph.edges.map((edge) => ({
    id: edge.id,
    workspace_id: input.workspaceId,
    map_id: input.mapId,
    created_by: input.userId,
    source_node_id: edge.sourceNodeId,
    target_node_id: edge.targetNodeId,
    edge_type: edge.edgeType,
    label: edge.label,
    is_directional: edge.isDirectional,
    metadata: {} as Json,
  }));

  const { error: deleteEdgesError } = await client.from("mind_map_edges").delete().eq("workspace_id", input.workspaceId).eq("map_id", input.mapId);
  if (deleteEdgesError) throw deleteEdgesError;

  const { error: deleteNodesError } = await client.from("mind_map_nodes").delete().eq("workspace_id", input.workspaceId).eq("map_id", input.mapId);
  if (deleteNodesError) throw deleteNodesError;

  if (nodeRows.length > 0) {
    const { error } = await client.from("mind_map_nodes").insert(nodeRows);
    if (error) throw error;
  }

  if (edgeRows.length > 0) {
    const { error } = await client.from("mind_map_edges").insert(edgeRows);
    if (error) throw error;
  }

  return getMindMapGraph(client, { workspaceId: input.workspaceId, mapId: input.mapId });
}

export function toEditableGraph(input: { map: MindMap; nodes: MindMapNode[]; edges: MindMapEdge[] }): EditableMapGraph {
  return {
    title: input.map.title,
    description: input.map.description,
    defaultView: input.map.default_view,
    nodes: input.nodes.map((node) => ({
      id: node.id,
      title: node.title,
      body: node.body,
      nodeType: node.node_type,
      status: node.status,
      position: { x: Number(node.position_x), y: Number(node.position_y) },
      width: node.width === null ? null : Number(node.width),
      height: node.height === null ? null : Number(node.height),
      accent: node.accent,
      startDate: node.start_date,
      dueDate: node.due_date,
      tags: node.tags,
      linkedType: node.linked_type as EditableMapNode["linkedType"],
      linkedId: node.linked_id,
      convertedType: node.converted_type as EditableMapNode["convertedType"],
      convertedId: node.converted_id,
      convertedAt: node.converted_at,
    })),
    edges: input.edges.map((edge) => ({
      id: edge.id,
      sourceNodeId: edge.source_node_id,
      targetNodeId: edge.target_node_id,
      edgeType: edge.edge_type,
      label: edge.label,
      isDirectional: edge.is_directional,
    })),
  };
}
```

- [ ] **Step 3: Run query tests**

Run:

```bash
npm.cmd test -- src/features/maps/maps.queries.test.ts
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/features/maps/maps.queries.ts src/features/maps/maps.queries.test.ts
git commit -m "Add mind map query module"
```

---

### Task 5: Canvas, Toolbar, And Inspector Components

**Files:**
- Create: `src/features/maps/map-canvas.tsx`
- Create: `src/features/maps/map-toolbar.tsx`
- Create: `src/features/maps/map-inspector.tsx`
- Create: `src/features/maps/map-canvas.test.tsx`
- Create: `src/features/maps/map-inspector.test.tsx`

- [ ] **Step 1: Write canvas test**

Create `src/features/maps/map-canvas.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MapCanvas } from "./map-canvas";
import type { EditableMapGraph } from "./map-types";

const graph: EditableMapGraph = {
  title: "Feature map",
  description: "",
  defaultView: "mind_map",
  nodes: [{ id: "node-1", title: "Feature idea", body: "", nodeType: "idea", status: "open", position: { x: 0, y: 0 }, accent: "cyan", tags: [] }],
  edges: [],
};

describe("MapCanvas", () => {
  it("renders nodes and adds a new node", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onSelectNode = vi.fn();

    render(<MapCanvas graph={graph} onChange={onChange} onSelectNode={onSelectNode} selectedNodeId={null} view="mind_map" />);

    expect(screen.getByText("Feature idea")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Add node" }));

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ nodes: expect.arrayContaining([expect.objectContaining({ title: "New idea" })]) }));
  });
});
```

- [ ] **Step 2: Write inspector test**

Create `src/features/maps/map-inspector.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MapInspector } from "./map-inspector";

const node = {
  id: "node-1",
  title: "Feature idea",
  body: "",
  nodeType: "idea" as const,
  status: "open" as const,
  position: { x: 0, y: 0 },
  accent: "cyan",
  tags: [],
};

describe("MapInspector", () => {
  it("edits a selected node title and requests task conversion", async () => {
    const user = userEvent.setup();
    const onNodeChange = vi.fn();
    const onConvert = vi.fn();

    render(<MapInspector node={node} onConvert={onConvert} onNodeChange={onNodeChange} />);

    await user.clear(screen.getByLabelText("Node title"));
    await user.type(screen.getByLabelText("Node title"), "Ship map canvas");
    await user.click(screen.getByRole("button", { name: "Convert to task" }));

    expect(onNodeChange).toHaveBeenCalledWith(expect.objectContaining({ title: "Ship map canvas" }));
    expect(onConvert).toHaveBeenCalledWith("task");
  });
});
```

- [ ] **Step 3: Implement toolbar**

Create `src/features/maps/map-toolbar.tsx`:

```tsx
import { GitBranch, Save } from "lucide-react";
import type { MindMapView } from "../../lib/supabase/database.types";
import { mapViewLabel, mapViews } from "./map-types";

export function MapToolbar({
  activeView,
  isDirty,
  isSaving,
  onAddNode,
  onSave,
  onViewChange,
}: {
  activeView: MindMapView;
  isDirty: boolean;
  isSaving: boolean;
  onAddNode: () => void;
  onSave: () => void;
  onViewChange: (view: MindMapView) => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-400/15 px-4 py-3">
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Map views">
        {mapViews.map((view) => (
          <button className={activeView === view ? "orbit-button" : "orbit-button-secondary"} key={view} onClick={() => onViewChange(view)} role="tab" type="button">
            {mapViewLabel(view)}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        {isDirty ? <span className="text-xs font-semibold text-amber-100">Unsaved changes</span> : <span className="text-xs font-semibold text-emerald-100">Saved</span>}
        <button className="orbit-button-secondary" onClick={onAddNode} type="button">
          <GitBranch aria-hidden="true" className="h-4 w-4" />
          Add node
        </button>
        <button className="orbit-button" disabled={!isDirty || isSaving} onClick={onSave} type="button">
          <Save aria-hidden="true" className="h-4 w-4" />
          {isSaving ? "Saving..." : "Save map"}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Implement canvas**

Create `src/features/maps/map-canvas.tsx`:

```tsx
import { Background, Controls, MiniMap, ReactFlow, type Edge, type Node } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { MindMapView } from "../../lib/supabase/database.types";
import type { EditableMapGraph, EditableMapNode } from "./map-types";
import { applyViewLayout } from "./map-layouts";

function toFlowNodes(nodes: EditableMapNode[]): Node[] {
  return nodes.map((node) => ({
    id: node.id,
    position: node.position,
    data: { label: node.title },
    type: "default",
    className: `rounded-md border border-cyan-300/25 bg-slate-950 px-3 py-2 text-sm font-semibold text-white shadow-lg`,
  }));
}

function toFlowEdges(graph: EditableMapGraph): Edge[] {
  return graph.edges.map((edge) => ({
    id: edge.id,
    source: edge.sourceNodeId,
    target: edge.targetNodeId,
    label: edge.label || undefined,
    animated: edge.edgeType === "sequence",
  }));
}

function createNode(): EditableMapNode {
  return {
    id: crypto.randomUUID(),
    title: "New idea",
    body: "",
    nodeType: "idea",
    status: "open",
    position: { x: 120, y: 120 },
    accent: "cyan",
    tags: [],
  };
}

export function MapCanvas({
  graph,
  onChange,
  onSelectNode,
  selectedNodeId,
  view,
}: {
  graph: EditableMapGraph;
  selectedNodeId: string | null;
  view: MindMapView;
  onChange: (graph: EditableMapGraph) => void;
  onSelectNode: (nodeId: string | null) => void;
}) {
  const laidOutNodes = applyViewLayout(view, graph.nodes);
  const flowNodes = toFlowNodes(laidOutNodes);
  const flowEdges = toFlowEdges(graph);

  function addNode() {
    onChange({ ...graph, nodes: [...graph.nodes, createNode()] });
  }

  return (
    <div className="relative min-h-[36rem] overflow-hidden rounded-lg border border-slate-400/15 bg-slate-950/50">
      <button className="sr-only" onClick={addNode} type="button">
        Add node
      </button>
      <ReactFlow
        edges={flowEdges}
        fitView
        nodes={flowNodes.map((node) => ({ ...node, selected: node.id === selectedNodeId }))}
        onNodeClick={(_, node) => onSelectNode(node.id)}
        onPaneClick={() => onSelectNode(null)}
      >
        <Background />
        <MiniMap />
        <Controls />
      </ReactFlow>
      <button className="orbit-button absolute bottom-4 left-4" onClick={addNode} type="button">
        Add node
      </button>
    </div>
  );
}
```

- [ ] **Step 5: Implement inspector**

Create `src/features/maps/map-inspector.tsx`:

```tsx
import { Field } from "../../components/field";
import type { ConvertedObjectType, EditableMapNode } from "./map-types";

export function MapInspector({
  node,
  onConvert,
  onNodeChange,
}: {
  node: EditableMapNode | null;
  onConvert: (type: ConvertedObjectType) => void;
  onNodeChange: (node: EditableMapNode) => void;
}) {
  if (!node) {
    return (
      <aside className="orbit-panel-soft rounded-lg p-4">
        <p className="mission-label">Inspector</p>
        <p className="mt-2 text-sm text-slate-400">Select a node to edit details or convert it into work.</p>
      </aside>
    );
  }

  const isConverted = Boolean(node.convertedId);

  return (
    <aside className="orbit-panel-soft rounded-lg p-4">
      <p className="mission-label">Node inspector</p>
      <div className="mt-4 grid gap-3">
        <Field label="Node title">
          <input className="orbit-input" onChange={(event) => onNodeChange({ ...node, title: event.target.value })} value={node.title} />
        </Field>
        <Field label="Node notes">
          <textarea className="orbit-input min-h-24" onChange={(event) => onNodeChange({ ...node, body: event.target.value })} value={node.body} />
        </Field>
        <Field label="Due date">
          <input className="orbit-input" onChange={(event) => onNodeChange({ ...node, dueDate: event.target.value })} type="date" value={node.dueDate ?? ""} />
        </Field>
      </div>
      <div className="mt-4 grid gap-2">
        <button className="orbit-button-secondary" disabled={isConverted} onClick={() => onConvert("task")} type="button">
          Convert to task
        </button>
        <button className="orbit-button-secondary" disabled={isConverted} onClick={() => onConvert("note")} type="button">
          Convert to note
        </button>
        <button className="orbit-button-secondary" disabled={isConverted} onClick={() => onConvert("milestone")} type="button">
          Convert to milestone
        </button>
      </div>
      {isConverted ? <p className="mt-3 text-xs font-semibold text-emerald-100">Converted to {node.convertedType}</p> : null}
    </aside>
  );
}
```

- [ ] **Step 6: Run component tests**

Run:

```bash
npm.cmd test -- src/features/maps/map-canvas.test.tsx src/features/maps/map-inspector.test.tsx
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/features/maps/map-canvas.tsx src/features/maps/map-toolbar.tsx src/features/maps/map-inspector.tsx src/features/maps/map-canvas.test.tsx src/features/maps/map-inspector.test.tsx
git commit -m "Add mind map canvas components"
```

---

### Task 6: Maps Page And Library

**Files:**
- Create: `src/features/maps/map-library-panel.tsx`
- Create: `src/features/maps/maps-page.tsx`
- Create: `src/features/maps/maps-page.test.tsx`

- [ ] **Step 1: Write page test**

Create `src/features/maps/maps-page.test.tsx`:

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MapsPage } from "./maps-page";

const mapMocks = vi.hoisted(() => ({
  createMindMap: vi.fn(),
  listMindMaps: vi.fn(),
}));

vi.mock("../../lib/supabase/client", () => ({ supabase: {} }));
vi.mock("../../lib/supabase/workspace", () => ({ getStoredWorkspaceId: () => "workspace-1" }));
vi.mock("../auth/use-auth", () => ({ useAuth: () => ({ isLoading: false, user: { id: "user-1" } }) }));
vi.mock("./maps.queries", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./maps.queries")>();
  return { ...actual, createMindMap: mapMocks.createMindMap, listMindMaps: mapMocks.listMindMaps };
});

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MapsPage />
    </QueryClientProvider>,
  );
}

describe("MapsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mapMocks.createMindMap.mockResolvedValue({ id: "map-1", title: "Feature plan" });
    mapMocks.listMindMaps.mockResolvedValue([]);
  });

  it("creates a blank global map", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: "New blank map" }));

    expect(mapMocks.createMindMap).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ workspaceId: "workspace-1", projectId: null, title: "Untitled map" }),
    );
  });
});
```

- [ ] **Step 2: Implement library panel**

Create `src/features/maps/map-library-panel.tsx`:

```tsx
import { Plus } from "lucide-react";
import type { Database } from "../../lib/supabase/database.types";
import { mapTemplates } from "./map-templates";

type MindMap = Database["public"]["Tables"]["mind_maps"]["Row"];

export function MapLibraryPanel({
  maps,
  onCreateBlank,
  onCreateFromTemplate,
  onSelectMap,
  selectedMapId,
}: {
  maps: MindMap[];
  selectedMapId: string | null;
  onCreateBlank: () => void;
  onCreateFromTemplate: (templateId: string) => void;
  onSelectMap: (mapId: string) => void;
}) {
  return (
    <aside className="orbit-panel-soft rounded-lg p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="mission-label">Map library</p>
          <h2 className="mt-1 text-lg font-black text-white">Visual plans</h2>
        </div>
        <button className="orbit-button-secondary" onClick={onCreateBlank} type="button">
          <Plus aria-hidden="true" className="h-4 w-4" />
          New blank map
        </button>
      </div>
      <div className="mt-4 grid gap-2">
        {maps.length === 0 ? <p className="text-sm text-slate-400">No maps yet. Start blank or choose a template.</p> : null}
        {maps.map((map) => (
          <button className={selectedMapId === map.id ? "orbit-button w-full justify-start" : "orbit-button-secondary w-full justify-start"} key={map.id} onClick={() => onSelectMap(map.id)} type="button">
            {map.title}
          </button>
        ))}
      </div>
      <div className="mt-5 grid gap-2">
        <p className="text-xs font-bold uppercase text-slate-400">Templates</p>
        {mapTemplates.map((template) => (
          <button className="rounded-md border border-slate-400/15 bg-slate-950/35 px-3 py-2 text-left text-sm font-semibold text-slate-100 hover:border-cyan-300/35" key={template.id} onClick={() => onCreateFromTemplate(template.id)} type="button">
            {template.title}
          </button>
        ))}
      </div>
    </aside>
  );
}
```

- [ ] **Step 3: Implement MapsPage**

Create `src/features/maps/maps-page.tsx`:

```tsx
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { EmptyState } from "../../components/empty-state";
import { supabase } from "../../lib/supabase/client";
import { getStoredWorkspaceId } from "../../lib/supabase/workspace";
import { useAuth } from "../auth/use-auth";
import { MapCanvas } from "./map-canvas";
import { MapInspector } from "./map-inspector";
import { MapLibraryPanel } from "./map-library-panel";
import { MapToolbar } from "./map-toolbar";
import { createMapFromTemplate } from "./map-templates";
import { createMindMap, listMindMaps, mindMapKeys } from "./maps.queries";
import type { EditableMapGraph, EditableMapNode } from "./map-types";

const emptyGraph: EditableMapGraph = { title: "Untitled map", description: "", defaultView: "mind_map", nodes: [], edges: [] };

export function MapsPage({ projectId = null }: { projectId?: string | null }) {
  const { isLoading, user } = useAuth();
  const workspaceId = getStoredWorkspaceId();
  const queryClient = useQueryClient();
  const [selectedMapId, setSelectedMapId] = useState<string | null>(null);
  const [graph, setGraph] = useState<EditableMapGraph>(emptyGraph);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  const mapsQuery = useQuery({
    queryKey: workspaceId ? mindMapKeys.list(workspaceId, projectId) : ["mind-maps", "missing-workspace"],
    queryFn: () => listMindMaps(supabase, { workspaceId: workspaceId ?? "", projectId }),
    enabled: Boolean(workspaceId && user),
  });

  const createMapMutation = useMutation({
    mutationFn: (values: { title: string; description: string; defaultView: EditableMapGraph["defaultView"] }) => {
      if (!workspaceId || !user) throw new Error("Choose a workspace before creating maps.");
      return createMindMap(supabase, { workspaceId, projectId, userId: user.id, title: values.title, description: values.description, defaultView: values.defaultView });
    },
    onSuccess: async (map) => {
      setSelectedMapId(map.id);
      await queryClient.invalidateQueries({ queryKey: mindMapKeys.list(workspaceId ?? "", projectId) });
    },
  });

  if (isLoading) return <EmptyState isLoading title="Loading maps" message="Checking your session before loading visual plans." />;
  if (!user) return <EmptyState title="Sign in required" message="Sign in to use maps." />;
  if (!workspaceId) return <EmptyState title="No workspace selected" message="Choose a workspace before creating maps." />;

  const selectedNode = graph.nodes.find((node) => node.id === selectedNodeId) ?? null;

  function updateGraph(nextGraph: EditableMapGraph) {
    setGraph(nextGraph);
    setIsDirty(true);
  }

  function updateNode(nextNode: EditableMapNode) {
    updateGraph({ ...graph, nodes: graph.nodes.map((node) => (node.id === nextNode.id ? nextNode : node)) });
  }

  function createTemplateMap(templateId: string) {
    const templateGraph = createMapFromTemplate(templateId, { projectId });
    setGraph(templateGraph);
    setIsDirty(true);
    createMapMutation.mutate({ title: templateGraph.title, description: templateGraph.description, defaultView: templateGraph.defaultView });
  }

  return (
    <section className="grid gap-5">
      <div>
        <p className="mission-label">Maps</p>
        <h1 className="mt-2 text-3xl font-black text-white">Visual planning workspace</h1>
      </div>
      <div className="grid gap-4 xl:grid-cols-[20rem_minmax(0,1fr)_20rem]">
        <MapLibraryPanel
          maps={mapsQuery.data ?? []}
          onCreateBlank={() => createMapMutation.mutate({ title: "Untitled map", description: "", defaultView: "mind_map" })}
          onCreateFromTemplate={createTemplateMap}
          onSelectMap={setSelectedMapId}
          selectedMapId={selectedMapId}
        />
        <div className="orbit-panel overflow-hidden rounded-lg p-0">
          <MapToolbar
            activeView={graph.defaultView}
            isDirty={isDirty}
            isSaving={false}
            onAddNode={() => updateGraph({ ...graph, nodes: [...graph.nodes, { id: crypto.randomUUID(), title: "New idea", body: "", nodeType: "idea", status: "open", position: { x: 80, y: 80 }, accent: "cyan", tags: [] }] })}
            onSave={() => setIsDirty(false)}
            onViewChange={(view) => updateGraph({ ...graph, defaultView: view })}
          />
          <MapCanvas graph={graph} onChange={updateGraph} onSelectNode={setSelectedNodeId} selectedNodeId={selectedNodeId} view={graph.defaultView} />
        </div>
        <MapInspector node={selectedNode} onConvert={() => undefined} onNodeChange={updateNode} />
      </div>
      {createMapMutation.isError ? <p className="rounded-lg border border-rose-300/25 bg-rose-300/10 px-3 py-2 text-sm font-semibold text-rose-100">{createMapMutation.error.message}</p> : null}
    </section>
  );
}
```

- [ ] **Step 4: Run page tests**

Run:

```bash
npm.cmd test -- src/features/maps/maps-page.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/maps/map-library-panel.tsx src/features/maps/maps-page.tsx src/features/maps/maps-page.test.tsx
git commit -m "Add maps workspace page"
```

---

### Task 7: Routes, Navigation, And Project Tab

**Files:**
- Modify: `src/app/routes.tsx`
- Modify: `src/components/app-shell.tsx`
- Modify: `src/features/projects/project-workspace-page.tsx`
- Modify: `src/features/projects/project-workspace-page.test.tsx`
- Modify: `src/app/App.test.tsx`

- [ ] **Step 1: Update route tests**

In `src/app/App.test.tsx`, add an assertion that `/maps` can route to the authenticated shell. Use the existing auth mocks in that file and assert the heading:

```tsx
expect(await screen.findByRole("heading", { name: "Visual planning workspace" })).toBeTruthy();
```

- [ ] **Step 2: Add route**

In `src/app/routes.tsx`, import `MapsPage`:

```ts
import { MapsPage } from "../features/maps/maps-page";
```

Add route:

```tsx
<Route
  path="/maps"
  element={
    <AuthenticatedShell>
      <MapsPage />
    </AuthenticatedShell>
  }
/>
```

- [ ] **Step 3: Add nav item**

In `src/components/app-shell.tsx`, import `Network` from `lucide-react` and add the nav item:

```ts
{ to: "/maps", label: "Maps", Icon: Network },
```

Place it after Missions and before Calendar.

- [ ] **Step 4: Add project workspace Maps tab**

In `src/features/projects/project-workspace-page.tsx`, import `MapsPage`:

```ts
import { MapsPage } from "../maps/maps-page";
```

Update tabs:

```ts
const tabs = ["Board", "Tasks", "Timeline", "Meetings", "Launch", "Maps", "Notes", "Review"] as const;
```

Add tab panel before Notes:

```tsx
) : activeTab === "Maps" ? (
  <div aria-label="Maps" role="tabpanel">
    <MapsPage projectId={projectId} />
  </div>
```

- [ ] **Step 5: Update project workspace test**

In `src/features/projects/project-workspace-page.test.tsx`, update the keyboard-focusable tab test list:

```ts
for (const tabName of ["Board", "Tasks", "Timeline", "Meetings", "Launch", "Maps", "Notes", "Review"]) {
```

Add a test:

```tsx
it("renders project maps from the Maps tab", async () => {
  const user = userEvent.setup();
  renderProjectWorkspacePage();

  await user.click(screen.getByRole("tab", { name: "Maps" }));

  expect(await screen.findByRole("heading", { name: "Visual planning workspace" })).toBeTruthy();
});
```

- [ ] **Step 6: Run route/project tests**

Run:

```bash
npm.cmd test -- src/app/App.test.tsx src/features/projects/project-workspace-page.test.tsx
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/app/routes.tsx src/components/app-shell.tsx src/features/projects/project-workspace-page.tsx src/features/projects/project-workspace-page.test.tsx src/app/App.test.tsx
git commit -m "Wire maps into app navigation"
```

---

### Task 8: Persistence And Conversion Actions

**Files:**
- Modify: `src/features/maps/maps-page.tsx`
- Modify: `src/features/maps/maps.queries.ts`
- Modify: `src/features/maps/maps-page.test.tsx`
- Modify: `src/features/maps/map-inspector.test.tsx`

- [ ] **Step 1: Add save behavior test**

In `src/features/maps/maps-page.test.tsx`, add:

```tsx
it("shows dirty state and saves the current map", async () => {
  const user = userEvent.setup();
  mapMocks.listMindMaps.mockResolvedValue([{ id: "map-1", title: "Feature plan", description: "", default_view: "mind_map", workspace_id: "workspace-1", project_id: null, created_by: "user-1", created_at: "2026-07-01T00:00:00.000Z", updated_at: "2026-07-01T00:00:00.000Z", archived_at: null }]);
  renderPage();

  await user.click(await screen.findByRole("button", { name: "Feature plan" }));
  await user.click(screen.getByRole("tab", { name: "Flowchart" }));

  expect(screen.getByText("Unsaved changes")).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "Save map" }));
  expect(screen.getByText("Saved")).toBeTruthy();
});
```

- [ ] **Step 2: Add conversion query helpers**

In `src/features/maps/maps.queries.ts`, add:

```ts
export async function markMindMapNodeConverted(
  client: Client,
  input: { id: string; workspaceId: string; convertedType: string; convertedId: string },
) {
  const { data, error } = await client
    .from("mind_map_nodes")
    .update({
      status: "converted",
      converted_type: input.convertedType,
      converted_id: input.convertedId,
      converted_at: new Date().toISOString(),
    })
    .eq("id", input.id)
    .eq("workspace_id", input.workspaceId)
    .select("*")
    .single();

  if (error) throw error;
  return data as MindMapNode;
}
```

- [ ] **Step 3: Wire save behavior**

In `src/features/maps/maps-page.tsx`, add a `saveMapMutation` that calls `updateMindMap` and `replaceMindMapGraph`. Use this shape:

```ts
const saveMapMutation = useMutation({
  mutationFn: async () => {
    if (!workspaceId || !user || !selectedMapId) throw new Error("Choose a map before saving.");
    await updateMindMap(supabase, { id: selectedMapId, workspaceId, title: graph.title, description: graph.description, defaultView: graph.defaultView });
    return replaceMindMapGraph(supabase, { workspaceId, mapId: selectedMapId, userId: user.id, graph });
  },
  onSuccess: async (savedGraph) => {
    setGraph(savedGraph);
    setIsDirty(false);
    await queryClient.invalidateQueries({ queryKey: mindMapKeys.graph(workspaceId ?? "", selectedMapId ?? "") });
    await queryClient.invalidateQueries({ queryKey: mindMapKeys.list(workspaceId ?? "", projectId) });
  },
});
```

Pass `saveMapMutation.isPending` and `saveMapMutation.mutate` into `MapToolbar`.

- [ ] **Step 4: Wire conversion actions**

In `MapsPage`, use existing query modules:

```ts
import { createNote } from "../notes/notes.queries";
import { createMilestone } from "../projects/milestones.queries";
import { createWorkItem } from "../work-items/work-items.queries";
import { markMindMapNodeConverted } from "./maps.queries";
```

Add `convertNodeMutation`. Behavior:

- task conversion requires `projectId`.
- milestone conversion requires `projectId`.
- note conversion can use `projectId` when present and `null` for global notes.
- after creating the object, call `markMindMapNodeConverted`.
- update local graph node status to `converted`.

- [ ] **Step 5: Run persistence tests**

Run:

```bash
npm.cmd test -- src/features/maps/maps-page.test.tsx src/features/maps/map-inspector.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/maps/maps-page.tsx src/features/maps/maps.queries.ts src/features/maps/maps-page.test.tsx src/features/maps/map-inspector.test.tsx
git commit -m "Add map save and conversion actions"
```

---

### Task 9: Full Verification

**Files:**
- No new files unless verification exposes a defect.

- [ ] **Step 1: Run focused maps tests**

Run:

```bash
npm.cmd test -- src/features/maps
```

Expected: PASS.

- [ ] **Step 2: Run project integration tests**

Run:

```bash
npm.cmd test -- src/features/projects/project-workspace-page.test.tsx src/app/App.test.tsx
```

Expected: PASS.

- [ ] **Step 3: Run full unit/component tests**

Run:

```bash
npm.cmd test
```

Expected: all tests pass.

- [ ] **Step 4: Run production build**

Run:

```bash
npm.cmd run build
```

Expected: TypeScript and Vite build pass. Existing chunk-size warning is acceptable.

- [ ] **Step 5: Run e2e smoke**

Run:

```bash
npm.cmd run e2e
```

Expected: Playwright smoke test passes.

- [ ] **Step 6: Commit verification fixes**

If verification required fixes:

```bash
git add src supabase package.json package-lock.json tests
git commit -m "Stabilize mind map workspace"
```

If verification required no fixes, do not create an empty commit.

---

## Self-Review

Spec coverage:

- Global and project maps: Tasks 2, 6, 7.
- React Flow canvas: Tasks 1 and 5.
- Mind Map, Flowchart, Timeline, Decision Tree views: Tasks 3, 5, 6.
- Rich node model: Tasks 2, 3, 5.
- Templates: Tasks 3 and 6.
- Explicit save and dirty state: Tasks 5, 6, 8.
- Conversion to task, note, milestone: Task 8.
- Collaboration-ready schema: Task 2.
- Route/nav/project tab: Task 7.
- Verification: Task 9.

Placeholder scan:

- The plan contains no unresolved placeholder markers or incomplete implementation sections.

Type consistency:

- Database enum names use `MindMapView`, `MindMapNodeType`, `MindMapNodeStatus`, and `MindMapEdgeType`.
- Frontend editable node fields use camelCase and map to snake_case in `maps.queries.ts`.
- Conversion status uses `convertedType`, `convertedId`, and `convertedAt` in frontend state and `converted_type`, `converted_id`, and `converted_at` in Supabase.
