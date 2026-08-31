-- Work could be shared but not handed to anyone.

alter table public.work_items add column assigned_to uuid;

-- Referencing workspace_members rather than auth.users means you can only
-- assign someone who is actually in the workspace, and leaving unassigns their
-- work automatically. The column-list form of set null is already the house
-- pattern here (see milestone_id and work_item_id elsewhere in this schema).
alter table public.work_items
  add constraint work_items_assigned_to_fkey
  foreign key (workspace_id, assigned_to)
  references public.workspace_members(workspace_id, user_id)
  on delete set null (assigned_to);

create index work_items_assigned_to_idx on public.work_items (workspace_id, assigned_to);

grant insert(assigned_to) on public.work_items to authenticated;
grant update(assigned_to) on public.work_items to authenticated;
