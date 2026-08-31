-- 202608100007 granted INSERT on note_links column by column. 202608200004 added
-- target_milestone_id and did not extend that list.
--
-- Nothing is broken today: Supabase's platform default privileges give
-- `authenticated` a table-wide INSERT underneath the column-scoped grant, so the
-- list has never actually restricted anything — verified against the live
-- database, where has_column_privilege for this column already returns true.
--
-- It is a trap rather than a bug. Narrowing what `authenticated` may reach is a
-- known follow-up, and the moment that lands this column becomes the one missing
-- from the list — breaking EVERY note-link insert, not only milestone ones,
-- because saveNoteLinks sends target_milestone_id on every row regardless of
-- kind. One line now, instead of a confusing permission error later.

grant insert(target_milestone_id) on public.note_links to authenticated;

do $$
begin
  if not has_column_privilege('authenticated', 'public.note_links', 'target_milestone_id', 'INSERT') then
    raise exception 'authenticated still cannot insert note_links.target_milestone_id';
  end if;
end
$$;
