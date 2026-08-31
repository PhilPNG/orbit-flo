-- create_personal_workspace is deliberately idempotent — it returns the
-- caller's existing owned workspace — so it cannot make a second one. This is
-- the deliberate path for additional workspaces. It is a function rather than
-- an insert grant because the owner membership must be created atomically with
-- the workspace; a blanket insert grant would let a client create a workspace
-- it is not a member of.
create or replace function public.create_workspace(workspace_name text)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_user_id uuid;
  trimmed_name text;
  new_workspace_id uuid;
begin
  current_user_id := (select auth.uid());

  if current_user_id is null then
    raise exception 'Authentication required to create a workspace';
  end if;

  trimmed_name := nullif(btrim(workspace_name), '');

  if trimmed_name is null then
    raise exception 'Workspace name is required';
  end if;

  insert into public.workspaces (name, created_by)
  values (trimmed_name, current_user_id)
  returning id into new_workspace_id;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (new_workspace_id, current_user_id, 'owner');

  return new_workspace_id;
end;
$$;

revoke all on function public.create_workspace(text) from public;
grant execute on function public.create_workspace(text) to authenticated;
