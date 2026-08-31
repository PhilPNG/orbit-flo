create index if not exists projects_workspace_updated_idx
  on public.projects (workspace_id, updated_at desc);

create index if not exists work_items_workspace_project_sort_idx
  on public.work_items (workspace_id, project_id, sort_order, created_at);

create index if not exists work_items_workspace_active_updated_idx
  on public.work_items (workspace_id, updated_at desc)
  where status <> 'done';

create index if not exists work_items_workspace_due_date_priority_idx
  on public.work_items (workspace_id, due_date, priority)
  where due_date is not null and status <> 'done';

create index if not exists milestones_workspace_project_target_sort_idx
  on public.milestones (workspace_id, project_id, target_date, sort_order);

create index if not exists milestones_workspace_open_target_idx
  on public.milestones (workspace_id, target_date)
  where completed_at is null;

create index if not exists notes_workspace_updated_idx
  on public.notes (workspace_id, updated_at desc);

create index if not exists notes_workspace_project_updated_idx
  on public.notes (workspace_id, project_id, updated_at desc)
  where project_id is not null;

create index if not exists notes_workspace_decision_updated_idx
  on public.notes (workspace_id, updated_at desc)
  where note_type = 'decision';

create index if not exists meeting_notes_workspace_project_date_created_idx
  on public.meeting_notes (workspace_id, project_id, meeting_date desc, created_at desc);

create index if not exists meeting_action_items_workspace_project_created_idx
  on public.meeting_action_items (workspace_id, project_id, created_at desc);

create index if not exists mind_maps_workspace_global_updated_idx
  on public.mind_maps (workspace_id, updated_at desc)
  where archived_at is null and project_id is null;

create index if not exists mind_map_nodes_workspace_map_created_idx
  on public.mind_map_nodes (workspace_id, map_id, created_at);

create index if not exists mind_map_edges_workspace_map_created_idx
  on public.mind_map_edges (workspace_id, map_id, created_at);
