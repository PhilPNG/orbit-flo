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
  unique (id, workspace_id, map_id),
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
  foreign key (source_node_id, workspace_id, map_id) references public.mind_map_nodes(id, workspace_id, map_id) on delete cascade,
  foreign key (target_node_id, workspace_id, map_id) references public.mind_map_nodes(id, workspace_id, map_id) on delete cascade,
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
grant insert(id, workspace_id, project_id, title, description, default_view, created_by) on public.mind_maps to authenticated;
grant update(project_id, title, description, default_view, archived_at) on public.mind_maps to authenticated;

grant select on public.mind_map_nodes to authenticated;
grant insert(id, workspace_id, map_id, node_type, status, title, body, position_x, position_y, width, height, accent, start_date, due_date, tags, metadata, linked_type, linked_id, created_by) on public.mind_map_nodes to authenticated;
grant update(node_type, status, title, body, position_x, position_y, width, height, accent, start_date, due_date, tags, metadata, linked_type, linked_id) on public.mind_map_nodes to authenticated;

grant select on public.mind_map_edges to authenticated;
grant insert(id, workspace_id, map_id, source_node_id, target_node_id, edge_type, label, is_directional, metadata, created_by) on public.mind_map_edges to authenticated;
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

create or replace function public.replace_mind_map_graph(
  p_map_id uuid,
  p_workspace_id uuid,
  p_title text,
  p_description text,
  p_default_view public.mind_map_view,
  p_nodes jsonb default '[]'::jsonb,
  p_edges jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_user_id uuid;
  v_map public.mind_maps%rowtype;
  v_nodes jsonb := '[]'::jsonb;
  v_edges jsonb := '[]'::jsonb;
begin
  current_user_id := (select auth.uid());

  if current_user_id is null then
    raise exception 'Authentication required to save mind maps'
      using errcode = '28000';
  end if;

  if not private.has_workspace_role(p_workspace_id, array['owner', 'admin', 'member']::public.workspace_role[]) then
    raise exception 'Mind map not found'
      using errcode = 'P0002';
  end if;

  update public.mind_maps
  set
    title = coalesce(nullif(btrim(p_title), ''), 'Untitled map'),
    description = coalesce(p_description, ''),
    default_view = p_default_view
  where id = p_map_id
    and workspace_id = p_workspace_id
    and archived_at is null
  returning * into v_map;

  if not found then
    raise exception 'Mind map not found'
      using errcode = 'P0002';
  end if;

  delete from public.mind_map_edges
  where workspace_id = p_workspace_id
    and map_id = p_map_id;

  delete from public.mind_map_nodes
  where workspace_id = p_workspace_id
    and map_id = p_map_id;

  with parsed_nodes as (
    select
      node.id,
      node.node_type,
      node.status,
      node.title,
      node.body,
      node.position_x,
      node.position_y,
      node.width,
      node.height,
      node.accent,
      node.start_date,
      node.due_date,
      node.tags,
      node.metadata,
      node.linked_type,
      node.linked_id,
      existing_node.converted_type,
      existing_node.converted_id,
      existing_node.converted_at
    from jsonb_to_recordset(coalesce(p_nodes, '[]'::jsonb)) as node(
      id uuid,
      node_type text,
      status text,
      title text,
      body text,
      position_x numeric,
      position_y numeric,
      width numeric,
      height numeric,
      accent text,
      start_date date,
      due_date date,
      tags jsonb,
      metadata jsonb,
      linked_type text,
      linked_id uuid
    )
    left join public.mind_map_nodes existing_node
      on existing_node.id = node.id
     and existing_node.workspace_id = p_workspace_id
     and existing_node.map_id = p_map_id
  ),
  inserted_nodes as (
    insert into public.mind_map_nodes (
      id,
      workspace_id,
      map_id,
      node_type,
      status,
      title,
      body,
      position_x,
      position_y,
      width,
      height,
      accent,
      start_date,
      due_date,
      tags,
      metadata,
      linked_type,
      linked_id,
      converted_type,
      converted_id,
      converted_at,
      created_by
    )
    select
      parsed_nodes.id,
      p_workspace_id,
      p_map_id,
      coalesce(parsed_nodes.node_type, 'idea')::public.mind_map_node_type,
      coalesce(parsed_nodes.status, 'open')::public.mind_map_node_status,
      coalesce(nullif(btrim(parsed_nodes.title), ''), 'Untitled node'),
      coalesce(parsed_nodes.body, ''),
      coalesce(parsed_nodes.position_x, 0),
      coalesce(parsed_nodes.position_y, 0),
      parsed_nodes.width,
      parsed_nodes.height,
      coalesce(nullif(btrim(parsed_nodes.accent), ''), 'cyan'),
      parsed_nodes.start_date,
      parsed_nodes.due_date,
      case
        when jsonb_typeof(coalesce(parsed_nodes.tags, '[]'::jsonb)) = 'array'
          then array(select jsonb_array_elements_text(coalesce(parsed_nodes.tags, '[]'::jsonb)))
        else '{}'::text[]
      end,
      coalesce(parsed_nodes.metadata, '{}'::jsonb),
      parsed_nodes.linked_type,
      parsed_nodes.linked_id,
      parsed_nodes.converted_type,
      parsed_nodes.converted_id,
      parsed_nodes.converted_at,
      current_user_id
    from parsed_nodes
    returning *
  )
  select coalesce(jsonb_agg(to_jsonb(inserted_nodes) order by inserted_nodes.created_at, inserted_nodes.id), '[]'::jsonb)
  into v_nodes
  from inserted_nodes;

  with parsed_edges as (
    select
      edge.id,
      edge.source_node_id,
      edge.target_node_id,
      edge.edge_type,
      edge.label,
      edge.is_directional,
      edge.metadata
    from jsonb_to_recordset(coalesce(p_edges, '[]'::jsonb)) as edge(
      id uuid,
      source_node_id uuid,
      target_node_id uuid,
      edge_type text,
      label text,
      is_directional boolean,
      metadata jsonb
    )
  ),
  inserted_edges as (
    insert into public.mind_map_edges (
      id,
      workspace_id,
      map_id,
      source_node_id,
      target_node_id,
      edge_type,
      label,
      is_directional,
      metadata,
      created_by
    )
    select
      parsed_edges.id,
      p_workspace_id,
      p_map_id,
      parsed_edges.source_node_id,
      parsed_edges.target_node_id,
      coalesce(parsed_edges.edge_type, 'association')::public.mind_map_edge_type,
      coalesce(parsed_edges.label, ''),
      coalesce(parsed_edges.is_directional, false),
      coalesce(parsed_edges.metadata, '{}'::jsonb),
      current_user_id
    from parsed_edges
    returning *
  )
  select coalesce(jsonb_agg(to_jsonb(inserted_edges) order by inserted_edges.created_at, inserted_edges.id), '[]'::jsonb)
  into v_edges
  from inserted_edges;

  return jsonb_build_object(
    'map', to_jsonb(v_map),
    'nodes', v_nodes,
    'edges', v_edges
  );
end;
$$;

revoke all on function public.replace_mind_map_graph(uuid, uuid, text, text, public.mind_map_view, jsonb, jsonb) from public;
grant execute on function public.replace_mind_map_graph(uuid, uuid, text, text, public.mind_map_view, jsonb, jsonb) to authenticated;

create or replace function public.convert_mind_map_node(
  p_node_id uuid,
  p_workspace_id uuid,
  p_project_id uuid,
  p_converted_type text
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  current_user_id uuid;
  v_node public.mind_map_nodes%rowtype;
  v_updated_node public.mind_map_nodes%rowtype;
  v_note public.notes%rowtype;
  v_work_item public.work_items%rowtype;
  v_milestone public.milestones%rowtype;
  v_converted_id uuid;
  v_converted_object jsonb;
begin
  current_user_id := (select auth.uid());

  if current_user_id is null then
    raise exception 'Authentication required to convert mind map nodes'
      using errcode = '28000';
  end if;

  if p_converted_type not in ('task', 'note', 'milestone') then
    raise exception 'Unsupported conversion type'
      using errcode = '22023';
  end if;

  if p_converted_type in ('task', 'milestone') and p_project_id is null then
    raise exception 'Project map required for this conversion'
      using errcode = '22023';
  end if;

  select n.*
  into v_node
  from public.mind_map_nodes n
  join public.mind_maps m
    on m.id = n.map_id
   and m.workspace_id = n.workspace_id
  where n.id = p_node_id
    and n.workspace_id = p_workspace_id
    and m.archived_at is null
    and m.project_id is not distinct from p_project_id
  for update of n;

  if not found then
    raise exception 'Mind map node not found'
      using errcode = 'P0002';
  end if;

  if v_node.converted_id is not null then
    return jsonb_build_object(
      'node', to_jsonb(v_node),
      'convertedObject', null,
      'alreadyConverted', true
    );
  end if;

  if p_converted_type = 'task' then
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
      v_node.title,
      nullif(v_node.body, ''),
      v_node.due_date,
      'medium',
      'ready',
      current_user_id
    )
    returning * into v_work_item;

    v_converted_id := v_work_item.id;
    v_converted_object := to_jsonb(v_work_item);
  elsif p_converted_type = 'milestone' then
    insert into public.milestones (
      workspace_id,
      project_id,
      title,
      description,
      target_date,
      created_by
    )
    values (
      p_workspace_id,
      p_project_id,
      v_node.title,
      nullif(v_node.body, ''),
      v_node.due_date,
      current_user_id
    )
    returning * into v_milestone;

    v_converted_id := v_milestone.id;
    v_converted_object := to_jsonb(v_milestone);
  else
    insert into public.notes (
      workspace_id,
      project_id,
      note_type,
      title,
      body,
      tags,
      created_by
    )
    values (
      p_workspace_id,
      p_project_id,
      'idea',
      v_node.title,
      nullif(v_node.body, ''),
      v_node.tags,
      current_user_id
    )
    returning * into v_note;

    v_converted_id := v_note.id;
    v_converted_object := to_jsonb(v_note);
  end if;

  update public.mind_map_nodes
  set
    status = 'converted',
    converted_type = p_converted_type,
    converted_id = v_converted_id,
    converted_at = now()
  where id = p_node_id
    and workspace_id = p_workspace_id
    and converted_id is null
  returning * into v_updated_node;

  if not found then
    raise exception 'Mind map node was already converted'
      using errcode = '23505';
  end if;

  return jsonb_build_object(
    'node', to_jsonb(v_updated_node),
    'convertedObject', v_converted_object,
    'alreadyConverted', false
  );
end;
$$;

revoke all on function public.convert_mind_map_node(uuid, uuid, uuid, text) from public;
grant execute on function public.convert_mind_map_node(uuid, uuid, uuid, text) to authenticated;
