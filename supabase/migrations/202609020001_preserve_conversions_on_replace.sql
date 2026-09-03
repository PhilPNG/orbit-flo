-- replace_mind_map_graph deleted the map's nodes before joining back to
-- public.mind_map_nodes to carry converted_type/converted_id/converted_at forward, so the join
-- matched nothing and every autosave silently cleared the conversion links, letting a second
-- Convert create a duplicate task, note, or milestone. This version snapshots the conversions
-- into a jsonb value before the delete and joins against that snapshot instead.

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
  v_conversions jsonb := '[]'::jsonb;
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

  select coalesce(
           jsonb_agg(
             jsonb_build_object(
               'id', id,
               'converted_type', converted_type,
               'converted_id', converted_id,
               'converted_at', converted_at
             )
           ),
           '[]'::jsonb
         )
  into v_conversions
  from public.mind_map_nodes
  where workspace_id = p_workspace_id
    and map_id = p_map_id
    and converted_id is not null;

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
    left join jsonb_to_recordset(v_conversions) as existing_node(
      id uuid,
      converted_type text,
      converted_id uuid,
      converted_at timestamptz
    )
      on existing_node.id = node.id
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
