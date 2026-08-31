-- Consolidate every project URL into project_links, and remove the two
-- orphaned structures no code ever read.

-- 1. Each project's repository URL becomes a typed repository link.
insert into public.project_links (workspace_id, project_id, link_type, label, url, created_by)
select p.workspace_id, p.id, 'repository', 'Repository', p.repository_url, p.created_by
from public.projects p
where p.repository_url is not null
  and length(trim(p.repository_url)) > 0;

alter table public.projects drop column repository_url;

-- 2. work_item_checklist_items already covers this, with a working UI.
--    Dropping the table takes its trigger, policies, and grants with it.
drop table public.subtasks;

-- 3. project_briefs.links was round-tripped by saveProjectBrief but never set
--    by any UI, so every row should still be '[]'. If that assumption is wrong,
--    fail the push rather than discard data.
do $$
declare
  populated integer;
begin
  select count(*) into populated
  from public.project_briefs
  where links is not null
    and links <> '[]'::jsonb;

  if populated > 0 then
    raise exception
      'project_briefs.links holds data in % row(s); migrate it before dropping the column',
      populated;
  end if;
end
$$;

alter table public.project_briefs drop column links;
