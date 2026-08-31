-- Mentions are extracted in SQL rather than by the client, for the same reason
-- every other signal is: a trigger fires on every write path, including the
-- edit made a week later. find_unlinked_mentions already does regex work here,
-- so this follows an established house pattern.
create or replace function private.signal_mentions()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor      uuid := (select auth.uid());
  old_mentions uuid[] := '{}';
  mentioned  uuid;
begin
  -- Every signal-raising function guards this the same way: a signal that
  -- references a workspaces row deleted earlier in the same transaction fails
  -- its foreign key and aborts whatever was deleting.
  if not exists (select 1 from public.workspaces w where w.id = new.workspace_id) then
    return new;
  end if;

  -- Extract the old body's mentions with the same pattern as the new one, so
  -- the comparison is uuid to uuid. A substring test would ask whether the id
  -- appears anywhere in the old text — so a raw uuid pasted as plain text
  -- would suppress that person's first real mention permanently, silently.
  if tg_op = 'UPDATE' then
    select coalesce(array_agg(distinct (m[1])::uuid), '{}')
    into old_mentions
    from regexp_matches(
      coalesce(old.body, ''),
      'orbit:user/([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})',
      'g'
    ) as m;
  end if;

  for mentioned in
    select distinct (m[1])::uuid
    from regexp_matches(
      coalesce(new.body, ''),
      'orbit:user/([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})',
      'g'
    ) as m
  loop
    -- Already mentioned before this edit. Without this, every later edit of a
    -- note re-notifies everyone named in it.
    continue when mentioned = any(old_mentions);

    continue when mentioned is not distinct from actor;

    -- security definer bypasses RLS, so membership is checked explicitly. A
    -- pasted or stale uuid otherwise creates rows nobody can ever read.
    continue when not exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = new.workspace_id and wm.user_id = mentioned
    );

    if tg_table_name = 'notes' then
      insert into public.signals
        (workspace_id, recipient_id, actor_id, kind, note_id)
      values (new.workspace_id, mentioned, actor, 'mentioned', new.id);
    else
      insert into public.signals
        (workspace_id, recipient_id, actor_id, kind, work_item_id, comment_id)
      values (new.workspace_id, mentioned, actor, 'mentioned', new.work_item_id, new.id);
    end if;
  end loop;

  return new;
end;
$$;

create trigger notes_signal_mentions
after insert or update of body on public.notes
for each row execute function private.signal_mentions();

create trigger work_item_comments_signal_mentions
after insert or update of body on public.work_item_comments
for each row execute function private.signal_mentions();
