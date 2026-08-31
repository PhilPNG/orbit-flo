create index work_items_workspace_due_date_idx
on public.work_items(workspace_id, due_date)
where due_date is not null and status <> 'done';
