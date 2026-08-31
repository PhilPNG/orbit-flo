-- A note that names a task without linking it. Obsidian calls these unlinked
-- mentions; here they answer "who is talking about this without saying so".

create or replace function public.find_unlinked_mentions(
  target_kind text,
  target_id uuid
)
returns table (
  note_id uuid,
  title text,
  note_type public.note_type
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_title text;
  target_workspace uuid;
  pattern text;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required';
  end if;

  if target_kind = 'task' then
    select w.title, w.workspace_id into target_title, target_workspace
    from public.work_items w where w.id = target_id;
  elsif target_kind = 'note' then
    select n.title, n.workspace_id into target_title, target_workspace
    from public.notes n where n.id = target_id;
  elsif target_kind = 'project' then
    select p.name, p.workspace_id into target_title, target_workspace
    from public.projects p where p.id = target_id;
  else
    raise exception 'Unknown target kind: %', target_kind;
  end if;

  -- security definer bypasses RLS, so membership is checked explicitly rather
  -- than assumed.
  if target_workspace is null or not private.is_workspace_member(target_workspace) then
    return;
  end if;

  -- Short titles carry no signal: a task called "UI" would match half the
  -- notes in the workspace and drown the panel in noise.
  if length(btrim(coalesce(target_title, ''))) < 4 then
    return;
  end if;

  -- % and _ are ILIKE wildcards, so a task named "50% faster" would otherwise
  -- match every note that exists. Escaped here, with \ as the escape char.
  pattern := '%' || replace(replace(replace(btrim(target_title), '\', '\\'), '%', '\%'), '_', '\_') || '%';

  return query
  select n.id, n.title, n.note_type
  from public.notes n
  where n.workspace_id = target_workspace
    and n.body ilike pattern escape '\'
    -- Only notes the caller may actually read: notes split by scope, so a
    -- private note belonging to someone else must not surface here.
    and private.is_workspace_member(n.workspace_id)
    and (n.project_id is not null or n.created_by = (select auth.uid()))
    -- A note that already links the target is a backlink, not a mention.
    and not exists (
      select 1
      from public.note_links l
      where l.note_id = n.id
        and (
          (target_kind = 'task' and l.target_work_item_id = target_id)
          or (target_kind = 'note' and l.target_note_id = target_id)
          or (target_kind = 'project' and l.target_project_id = target_id)
        )
    )
    -- A note never mentions itself.
    and not (target_kind = 'note' and n.id = target_id)
  order by n.updated_at desc
  limit 10;
end;
$$;

revoke all on function public.find_unlinked_mentions(text, uuid) from public;
grant execute on function public.find_unlinked_mentions(text, uuid) to authenticated;
