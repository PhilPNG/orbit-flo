-- Milestones were left out of the link system because they had no page to host
-- a backlink panel. They are getting one, so note_links gains a fourth target.
--
-- The four-nullable-columns shape is kept deliberately. From the original
-- migration: "a polymorphic pair cannot have referential integrity, and
-- deleting a target must take its inbound links with it rather than leave rows
-- pointing at nothing." That holds for a fourth column as much as the first
-- three.

alter table public.note_links add column target_milestone_id uuid;

alter table public.note_links
  add constraint note_links_target_milestone_fkey
  foreign key (target_milestone_id, workspace_id)
  references public.milestones(id, workspace_id) on delete cascade;

-- Both existing guards must widen with it, and each fails silently in its own
-- direction if missed.
--
-- The check counts non-nulls among three columns. A milestone-only row has zero
-- of those three, so the old check would reject every milestone link.
alter table public.note_links drop constraint note_links_one_target;

alter table public.note_links
  add constraint note_links_one_target check (
    num_nonnulls(target_note_id, target_work_item_id, target_project_id, target_milestone_id) = 1
  );

-- The unique index keys on a coalesce of the target columns. Without the new
-- column every milestone link from one note coalesces to the same null and the
-- second collides with the first.
drop index note_links_unique_target_idx;

create unique index note_links_unique_target_idx
on public.note_links (
  note_id,
  coalesce(target_note_id, target_work_item_id, target_project_id, target_milestone_id)
);

-- Assert rather than assume. A constraint that failed to widen would only
-- surface the first time somebody linked a milestone.
do $$
declare
  check_src text;
  index_src text;
begin
  select pg_get_constraintdef(oid) into check_src
  from pg_constraint
  where conname = 'note_links_one_target'
    and conrelid = 'public.note_links'::regclass;

  if check_src is null or check_src not like '%target_milestone_id%' then
    raise exception 'note_links_one_target does not count target_milestone_id: %', check_src;
  end if;

  select indexdef into index_src
  from pg_indexes
  where schemaname = 'public' and indexname = 'note_links_unique_target_idx';

  if index_src is null or index_src not like '%target_milestone_id%' then
    raise exception 'note_links_unique_target_idx does not include target_milestone_id: %', index_src;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'note_links_target_milestone_fkey'
      and conrelid = 'public.note_links'::regclass
  ) then
    raise exception 'the milestone foreign key was not created';
  end if;
end
$$;
