create table if not exists public.board_columns (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid not null,
  title text not null check (char_length(title) between 1 and 60),
  status_category public.work_item_status not null,
  sort_order integer not null default 0,
  created_by uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id),
  foreign key (project_id, workspace_id) references public.projects(id, workspace_id) on delete cascade,
  foreign key (workspace_id, created_by) references public.workspace_members(workspace_id, user_id) on delete cascade
);

create index if not exists board_columns_project_order_idx
  on public.board_columns (workspace_id, project_id, sort_order);

alter table public.work_items
  add column if not exists column_id uuid;

alter table public.work_items
  add constraint work_items_column_fk
  foreign key (column_id, workspace_id)
  references public.board_columns(id, workspace_id)
  on delete set null;

create index if not exists work_items_column_idx on public.work_items (column_id);

create trigger set_board_columns_updated_at
before update on public.board_columns
for each row execute function public.set_updated_at();

alter table public.board_columns enable row level security;

create policy "Members can view board columns"
on public.board_columns for select
using (
  exists (
    select 1 from public.workspace_members m
    where m.workspace_id = board_columns.workspace_id and m.user_id = auth.uid()
  )
);

create policy "Members can create board columns"
on public.board_columns for insert
with check (
  created_by = auth.uid()
  and exists (
    select 1 from public.workspace_members m
    where m.workspace_id = board_columns.workspace_id and m.user_id = auth.uid()
  )
);

create policy "Members can update board columns"
on public.board_columns for update
using (
  exists (
    select 1 from public.workspace_members m
    where m.workspace_id = board_columns.workspace_id and m.user_id = auth.uid()
  )
);

create policy "Members can delete board columns"
on public.board_columns for delete
using (
  exists (
    select 1 from public.workspace_members m
    where m.workspace_id = board_columns.workspace_id and m.user_id = auth.uid()
  )
);
