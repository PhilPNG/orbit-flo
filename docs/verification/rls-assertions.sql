-- ============================================================================
-- Orbit Flo — RLS isolation assertions
--
-- Everything the collaboration arc (PRs #31-#36) claims about privacy lives in
-- RLS policies. Vitest has no database, so none of it is covered by the suite:
-- the guarantees are argued in migration comments and never demonstrated. This
-- script demonstrates them.
--
-- HOW TO RUN
--   1. Both accounts must have signed in at least once (auth.users needs rows).
--   2. Replace the two email addresses in step 1.
--   3. Run it. Either route works; both keep one session, which this file needs
--      for its temp tables and SET ROLE:
--
--        npx supabase db query --linked -f docs/verification/rls-assertions.sql
--
--      or paste the whole file into the Supabase SQL editor. The CLI route
--      authenticates with your existing login — no database password.
--   4. Read the final table. Failures sort to the top of each group.
--
--      The CLI prints only the LAST result set, which is the summary counts.
--      To see the per-check detail, comment out the summary query at the end.
--
-- WHAT MOVED OUT
--   The privilege checks that need no accounts and no data now live in
--   docs/verification/grants-assertions.sql, which runs on every pull request
--   (see the `guards` job in .github/workflows/ci.yml). They are not repeated
--   here — each check exists in exactly one file so the two cannot drift.
--
--   This file keeps everything that needs two real signed-in accounts: the RLS
--   isolation boundaries, the sharing rules, the write probes, the signal
--   triggers, and the four privilege checks that build their own fixtures.
--
--   A FULL SWEEP IS NOW TWO COMMANDS. Running only the hermetic file proves
--   nothing about RLS.
--
-- STATUS: first executed 2026-08-12 against the linked project. It runs. The
-- SET ROLE impersonation works through the Management API, and step 8 confirmed
-- auth.uid() resolves to the second account.
--
-- HOW TO READ THE VERDICTS
--   PASS            the boundary held
--   FAIL — LEAK     the second account can see or write data it must not
--   VACUOUS         the check ran but there was nothing to hide, so it proved
--                   nothing. Create data as the first account and re-run.
--   SKIP            preconditions absent (e.g. no shared workspace yet)
--
-- A VACUOUS result is NOT a pass. It is the exact failure mode this script
-- exists to avoid: a check that is green because the table was empty.
--
-- Nothing here writes to your data. Step 12 attempts two writes on purpose and
-- rolls both back inside a subtransaction. The TRIGGERS section near the end
-- does the same for the signal-raising triggers, which are unreachable from
-- vitest (no database) and so are checked here instead.
-- ============================================================================

reset role;

drop table if exists rls_actors;
drop table if exists rls_scope;
drop table if exists rls_tables;
drop table if exists rls_personal;
drop table if exists rls_a_plans;
drop table if exists rls_truth;
drop table if exists rls_iso_truth;
drop table if exists rls_owner_probe;
drop table if exists rls_results;


-- ---------------------------------------------------------------------------
-- 1. Resolve the two accounts. Runs as your admin role, which can read
--    auth.users; the impersonated role cannot, which is why this happens first.
--
--    >>> REPLACE THE TWO ADDRESSES BELOW <<<
-- ---------------------------------------------------------------------------

create temp table rls_actors as
select
  (select id from auth.users where lower(email) = lower('REPLACE_WITH_YOUR_EMAIL')) as user_a,
  (select id from auth.users where lower(email) = lower('REPLACE_WITH_SECOND_EMAIL')) as user_b;

do $$
declare
  a uuid;
  b uuid;
begin
  select user_a, user_b into a, b from rls_actors;

  if a is null then
    raise exception 'No auth.users row for the first email. Check the address, and that the account has signed in at least once.';
  end if;
  if b is null then
    raise exception 'No auth.users row for the second email. Has the second account signed up yet?';
  end if;
  if a = b then
    raise exception 'Both addresses resolve to the same user. This script needs two distinct accounts.';
  end if;
end
$$;


-- ---------------------------------------------------------------------------
-- 2. Pick the two workspaces the checks run against.
--
--    private_ws  A is a member, B is NOT       -> isolation checks
--    shared_ws   both are members              -> personal-boundary checks
--                (null until the invitation is accepted; those checks SKIP)
-- ---------------------------------------------------------------------------

create temp table rls_scope as
select
  (
    select wm.workspace_id
    from public.workspace_members wm, rls_actors act
    where wm.user_id = act.user_a
      and not exists (
        select 1 from public.workspace_members other
        where other.workspace_id = wm.workspace_id
          and other.user_id = act.user_b
      )
    order by wm.created_at
    limit 1
  ) as private_ws,
  (
    select wm.workspace_id
    from public.workspace_members wm, rls_actors act
    where wm.user_id = act.user_a
      and exists (
        select 1 from public.workspace_members other
        where other.workspace_id = wm.workspace_id
          and other.user_id = act.user_b
      )
    order by wm.created_at
    limit 1
  ) as shared_ws;


-- ---------------------------------------------------------------------------
-- 3. Every table scoped by workspace_id, discovered rather than listed, so a
--    table added later is covered without editing this file.
-- ---------------------------------------------------------------------------

create temp table rls_tables as
select c.table_name::text as table_name
from information_schema.columns c
join information_schema.tables t
  on t.table_schema = c.table_schema
 and t.table_name = c.table_name
where c.table_schema = 'public'
  and c.column_name = 'workspace_id'
  and t.table_type = 'BASE TABLE'
order by c.table_name;


-- ---------------------------------------------------------------------------
-- 4. The personal surfaces, and how to recognise a row belonging to A.
--
--    daily_plan_items is identified through a materialised list of A's plan
--    ids rather than a live subquery on daily_plans. A live subquery would
--    itself be filtered by RLS when B runs it, return nothing, and make the
--    check pass no matter what — the vacuous green this script guards against.
-- ---------------------------------------------------------------------------

create temp table rls_a_plans as
select p.id
from public.daily_plans p, rls_actors act, rls_scope s
where p.created_by = act.user_a
  and p.workspace_id = s.shared_ws;

create temp table rls_personal (table_name text, a_predicate text);

insert into rls_personal (table_name, a_predicate)
select v.name, replace(v.pred, '{A}', quote_literal(act.user_a))
from rls_actors act,
  (values
    ('captures',                     'created_by = {A}'),
    ('daily_plans',                  'created_by = {A}'),
    ('daily_plan_items',             'daily_plan_id in (select id from rls_a_plans)'),
    ('notes',                        'created_by = {A} and project_id is null'),
    ('weekly_reviews',               'created_by = {A} and project_id is null'),
    ('private_reflections',          'created_by = {A}'),
    ('daily_shutdowns',              'created_by = {A}'),
    ('dashboard_widget_preferences', 'user_id = {A}')
  ) as v(name, pred);


-- ---------------------------------------------------------------------------
-- 5. Ground truth: how many such rows actually exist, counted WITHOUT RLS.
--    A check only means something if there was something to hide.
-- ---------------------------------------------------------------------------

create temp table rls_truth (table_name text, a_rows bigint);

do $$
declare
  r record;
  ws uuid;
  n bigint;
begin
  select shared_ws into ws from rls_scope;
  if ws is null then
    return;
  end if;

  for r in select * from rls_personal loop
    execute format(
      'select count(*) from public.%I where workspace_id = %L and %s',
      r.table_name, ws, r.a_predicate
    ) into n;
    insert into rls_truth values (r.table_name, n);
  end loop;
end
$$;


-- ---------------------------------------------------------------------------
-- 5b. The same ground truth for the isolation workspace.
--
--     Added after the first real run (2026-08-12), which reported 31 isolation
--     passes — but most of those tables were simply empty in that workspace.
--     "B saw zero rows" only means something when there were rows to see, and
--     the boundary group already knew that. This closes the same gap here.
-- ---------------------------------------------------------------------------

create temp table rls_iso_truth (table_name text, ws_rows bigint);

do $$
declare
  t  record;
  ws uuid;
  n  bigint;
begin
  select private_ws into ws from rls_scope;
  if ws is null then
    return;
  end if;

  for t in select table_name from rls_tables loop
    execute format('select count(*) from public.%I where workspace_id = %L', t.table_name, ws)
      into n;
    insert into rls_iso_truth values (t.table_name, n);
  end loop;
end
$$;


-- ---------------------------------------------------------------------------
-- 6. Results table.
--
--    No serial column: the sequence behind one lives in the temp schema and
--    would need its own grant to the impersonated role. Ordering comes from an
--    explicit CASE in step 13 instead, which also floats failures to the top.
-- ---------------------------------------------------------------------------

create temp table rls_results (
  check_group text,
  subject     text,
  expected    text,
  actual      text,
  verdict     text
);

grant select on rls_actors   to authenticated;
grant select on rls_scope    to authenticated;
grant select on rls_tables   to authenticated;
grant select on rls_personal to authenticated;
grant select on rls_a_plans  to authenticated;
grant select on rls_truth    to authenticated;
grant select on rls_iso_truth to authenticated;
grant select, insert on rls_results to authenticated;


-- ---------------------------------------------------------------------------
-- 7. Become the second account.
--
--    Both GUCs are set: current Supabase reads request.jwt.claims, older
--    definitions of auth.uid() read request.jwt.claim.sub.
-- ---------------------------------------------------------------------------

select set_config(
  'request.jwt.claims',
  json_build_object('sub', user_b, 'role', 'authenticated')::text,
  false
)
from rls_actors;

select set_config('request.jwt.claim.sub', user_b::text, false) from rls_actors;

set role authenticated;


-- ---------------------------------------------------------------------------
-- 8. GUARD: prove the impersonation actually took.
--
--    The most important check in the file. If auth.uid() is null, every policy
--    below denies everything, every count comes back 0, and the script reports
--    a flawless score while proving nothing at all. Stop loudly instead.
-- ---------------------------------------------------------------------------

do $$
declare
  claimed  uuid;
  expected uuid;
begin
  claimed := auth.uid();
  select user_b into expected from rls_actors;

  if claimed is null then
    raise exception 'auth.uid() is null — impersonation failed. Every result below would be a false PASS, so the script stops here.';
  end if;
  if claimed <> expected then
    raise exception 'auth.uid() returned % but should be %. Impersonation targeted the wrong user.', claimed, expected;
  end if;

  insert into rls_results
  values ('guard', 'auth.uid() is the second account', expected::text, claimed::text, 'PASS');
end
$$;


-- ---------------------------------------------------------------------------
-- 9. ISOLATION: in a workspace B does not belong to, B must see nothing.
--    Every workspace-scoped table, no exceptions.
-- ---------------------------------------------------------------------------

do $$
declare
  t       record;
  ws      uuid;
  visible bigint;
  truth   bigint;
begin
  select private_ws into ws from rls_scope;

  if ws is null then
    insert into rls_results
    values ('isolation', '(no unshared workspace)', 'n/a', 'n/a',
            'SKIP — the accounts share every workspace; nothing to isolate');
    return;
  end if;

  for t in select table_name from rls_tables loop
    select ws_rows into truth from rls_iso_truth where table_name = t.table_name;

    begin
      execute format('select count(*) from public.%I where workspace_id = %L', t.table_name, ws)
        into visible;
    exception when insufficient_privilege then
      insert into rls_results
      values ('isolation', t.table_name,
              '0 of ' || coalesce(truth, 0) || ' rows', 'permission denied',
              case when coalesce(truth, 0) = 0
                   then 'VACUOUS — no grant, and the table is empty here'
                   else 'PASS (no grant to authenticated)' end);
      continue;
    end;

    insert into rls_results
    values (
      'isolation', t.table_name,
      '0 of ' || coalesce(truth, 0) || ' rows',
      visible || ' visible',
      case
        when visible > 0            then 'FAIL — LEAK'
        when coalesce(truth, 0) = 0 then 'VACUOUS — table is empty in that workspace'
        else 'PASS'
      end
    );
  end loop;
end
$$;


-- ---------------------------------------------------------------------------
-- 10. PERSONAL BOUNDARY: inside a workspace they DO share, B must still not
--     see A's private surfaces — captures, daily plans, workspace-level notes
--     and reviews. Project notes are team knowledge and are meant to be shared.
-- ---------------------------------------------------------------------------

do $$
declare
  r       record;
  ws      uuid;
  visible bigint;
  truth   bigint;
begin
  select shared_ws into ws from rls_scope;

  if ws is null then
    insert into rls_results
    values ('boundary', '(no shared workspace)', 'n/a', 'n/a',
            'SKIP — accept the invitation first, then re-run');
    return;
  end if;

  for r in select * from rls_personal loop
    select a_rows into truth from rls_truth where table_name = r.table_name;

    begin
      execute format(
        'select count(*) from public.%I where workspace_id = %L and %s',
        r.table_name, ws, r.a_predicate
      ) into visible;
    exception when insufficient_privilege then
      insert into rls_results
      values ('boundary', r.table_name, '0 of A''s rows', 'permission denied',
              'PASS (no grant to authenticated)');
      continue;
    end;

    insert into rls_results
    values (
      'boundary',
      r.table_name,
      '0 of A''s ' || coalesce(truth, 0) || ' rows',
      visible || ' visible',
      case
        when visible > 0            then 'FAIL — LEAK'
        when coalesce(truth, 0) = 0 then 'VACUOUS — A has no rows here to hide'
        else 'PASS'
      end
    );
  end loop;
end
$$;


-- ---------------------------------------------------------------------------
-- 11. SHARING: the things that are SUPPOSED to cross the boundary.
--     A boundary that blocks everything is not correct, it is just broken.
-- ---------------------------------------------------------------------------

do $$
declare
  ws      uuid;
  a       uuid;
  visible bigint;
begin
  select shared_ws into ws from rls_scope;
  select user_a into a from rls_actors;

  if ws is null then
    insert into rls_results values ('sharing', '(no shared workspace)', 'n/a', 'n/a', 'SKIP');
    return;
  end if;

  select count(*) into visible from public.workspaces where id = ws;
  insert into rls_results
  values ('sharing', 'the shared workspace row itself', '1', visible || ' visible',
          case when visible = 1 then 'PASS' else 'FAIL — B cannot load the workspace' end);

  select count(*) into visible from public.profiles where id = a;
  insert into rls_results
  values ('sharing', 'A''s profile (needed for member list and avatars)', '1', visible || ' visible',
          case when visible = 1 then 'PASS' else 'FAIL — members will render with no name' end);

  select count(*) into visible from public.projects where workspace_id = ws;
  insert into rls_results
  values ('sharing', 'projects in the shared workspace', '> 0', visible || ' visible',
          case when visible > 0 then 'PASS' else 'VACUOUS — create a project first' end);

  select count(*) into visible from public.work_items where workspace_id = ws;
  insert into rls_results
  values ('sharing', 'work items in the shared workspace', '> 0', visible || ' visible',
          case when visible > 0 then 'PASS' else 'VACUOUS — create a task first' end);

  select count(*) into visible
    from public.notes
   where workspace_id = ws and project_id is not null and created_by = a;
  insert into rls_results
  values ('sharing', 'A''s PROJECT notes (team knowledge)', '> 0', visible || ' visible',
          case when visible > 0 then 'PASS'
               else 'VACUOUS — have A write a note inside a project first' end);
end
$$;


-- ---------------------------------------------------------------------------
-- 12. WRITE PATHS. Reads are only half of it: a policy can hide a row from
--     SELECT and still allow an UPDATE that overwrites it.
--
--     Each probe runs in its own subtransaction and ends by raising a private
--     SQLSTATE, which rolls the write back. plpgsql variables survive that
--     rollback — only database changes are undone — so the row counts are
--     still readable afterwards and get recorded outside the probe.
-- ---------------------------------------------------------------------------

do $$
declare
  ws       uuid;
  b        uuid;
  updated  bigint := 0;
  inserted bigint := 0;
  target_rows bigint;
  blocked_update text := null;
  blocked_insert text := null;
begin
  select private_ws into ws from rls_scope;
  select user_b into b from rls_actors;

  if ws is null then
    insert into rls_results values ('writes', '(no unshared workspace)', 'n/a', 'n/a', 'SKIP');
    return;
  end if;

  -- Probe 1: can B edit rows in a workspace it does not belong to?
  begin
    update public.work_items
       set title = title || ' [SHOULD NEVER PERSIST]'
     where workspace_id = ws;
    get diagnostics updated = row_count;
    raise exception using errcode = 'ORB01', message = 'undo probe';
  exception
    when sqlstate 'ORB01' then null;                 -- our signal: write undone
    when others then blocked_update := sqlerrm; updated := 0;
  end;

  -- Probe 2: can B grant itself ownership of someone else's workspace?
  begin
    insert into public.workspace_members (workspace_id, user_id, role)
    values (ws, b, 'owner');
    get diagnostics inserted = row_count;
    raise exception using errcode = 'ORB01', message = 'undo probe';
  exception
    when sqlstate 'ORB01' then null;
    when others then blocked_insert := sqlerrm; inserted := 0;
  end;

  select ws_rows into target_rows from rls_iso_truth where table_name = 'work_items';

  insert into rls_results
  values ('writes', 'update work items in a workspace B is not in',
          '0 of ' || coalesce(target_rows, 0) || ' rows touched',
          coalesce(blocked_update, updated || ' rows touched'),
          case
            when updated > 0                  then 'FAIL — B can edit another workspace'
            when coalesce(target_rows, 0) = 0 then 'VACUOUS — no work items there to overwrite'
            else 'PASS'
          end);

  insert into rls_results
  values ('writes', 'B adds itself as owner of A''s workspace', '0 rows inserted',
          coalesce(blocked_insert, inserted || ' rows inserted'),
          case when inserted = 0 then 'PASS' else 'FAIL — PRIVILEGE ESCALATION' end);
end
$$;


-- ---------------------------------------------------------------------------
-- 13. Safety net: confirm step 12's probes really were rolled back.
--
--     The rollback relies on plpgsql subtransaction semantics. Those are
--     reliable, but "reliable" is what this whole file exists to stop us
--     assuming. Counted without RLS, so nothing can hide.
-- ---------------------------------------------------------------------------

reset role;

do $$
declare
  residue bigint;
begin
  select count(*) into residue
  from public.work_items
  where title like '%[SHOULD NEVER PERSIST]%';

  insert into rls_results
  values ('cleanup', 'probe writes rolled back', '0 rows', residue || ' rows',
          case when residue = 0 then 'PASS'
               else 'FAIL — RUN THE REPAIR AT THE BOTTOM OF THIS FILE' end);
end
$$;


-- ---------------------------------------------------------------------------
-- 14. TRIGGERS: the signal-raising triggers, unreachable from vitest because
--     it has no database. These do not probe an existing boundary — they
--     perform the write that should raise a signal and assert that it did
--     (or, for self-assignment, that it did not).
--
--     "Ground truth first" means something different here than above: it is
--     not "how many rows exist to leak", it is "did the write I just made
--     actually take effect". An insert that silently affected zero rows (no
--     project to hang a task on, say) would make a "no signal" assertion
--     vacuously true, so that is checked and reported before the signal
--     count is trusted. The same is true of the UPDATE that actually raises
--     the signal — setting assigned_to, editing a note body again — so its
--     row count is captured too and reported as VACUOUS, not a false PASS,
--     if that update silently touched nothing.
--
--     Runs as the admin role — reset in step 13, above, and never re-
--     impersonated, since these triggers fire unconditionally and do not
--     depend on RLS. auth.uid() is pointed at A explicitly (session-level,
--     overriding step 7's B) so the trigger's actor-vs-recipient logic can be
--     exercised deliberately in both directions.
--
--     Each probe writes inside its own subtransaction and rolls back via the
--     ORB01 signal, exactly as step 12 does — and, like step 12, also catches
--     `others`, so a genuine trigger bug degrades into a labelled FAIL in the
--     report instead of aborting the whole script (and taking 14c and the
--     final report down with it). Probe rows are marked with a
--     '[RLS PROBE - TRIGGERS]' title prefix so the safety net below (14c) can
--     find them if a rollback ever fails to take.
-- ---------------------------------------------------------------------------

select set_config(
  'request.jwt.claims',
  json_build_object('sub', user_a, 'role', 'authenticated')::text,
  false
)
from rls_actors;

select set_config('request.jwt.claim.sub', user_a::text, false) from rls_actors;

-- 14a. Assignment: raises a signal for the assignee, none for a self-assign.
do $$
declare
  ws          uuid;
  a           uuid;
  b           uuid;
  task_id     uuid;
  task_rows   bigint := 0;
  assign_rows bigint := 0;
  signal_rows bigint;
  probe_error text := null;
begin
  select shared_ws into ws from rls_scope;
  select user_a into a from rls_actors;
  select user_b into b from rls_actors;

  if ws is null then
    insert into rls_results values
      ('triggers', 'assignment raises a signal for the assignee', 'n/a', 'n/a',
       'SKIP — accept the invitation first, then re-run'),
      ('triggers', 'assigning to yourself raises nothing', 'n/a', 'n/a',
       'SKIP — accept the invitation first, then re-run');
    return;
  end if;

  -- Probe: A creates a task, then assigns it to B.
  begin
    insert into public.work_items (workspace_id, project_id, title, created_by)
    select ws, p.id, '[RLS PROBE - TRIGGERS] assignment', a
    from public.projects p
    where p.workspace_id = ws
    limit 1
    returning id into task_id;

    get diagnostics task_rows = row_count;

    if task_rows > 0 then
      update public.work_items set assigned_to = b where id = task_id;
      get diagnostics assign_rows = row_count;

      select count(*) into signal_rows
      from public.signals
      where work_item_id = task_id and recipient_id = b and kind = 'assigned';
    end if;

    raise exception using errcode = 'ORB01', message = 'undo probe';
  exception
    when sqlstate 'ORB01' then null;
    when others then probe_error := sqlerrm;
  end;

  -- FAIL must outrank VACUOUS: a wrong signal count only means something once
  -- both the insert and the assign UPDATE are confirmed to have landed.
  insert into rls_results
  values (
    'triggers', 'assignment raises a signal for the assignee',
    '1 signal for B',
    case when task_rows = 0 then 'no project to hang a task on'
         else coalesce(signal_rows, 0) || ' signals' end,
    case
      when probe_error is not null then 'FAIL — ' || probe_error
      when task_rows > 0 and assign_rows > 0 and signal_rows <> 1
           then 'FAIL — expected exactly one assigned signal for B, got ' || coalesce(signal_rows, 0)
      when task_rows = 0   then 'VACUOUS — shared workspace has no project to create a task in'
      when assign_rows = 0 then 'VACUOUS — the update under test affected no rows'
      else 'PASS'
    end
  );

  -- Probe: A creates a task, then assigns it to A (self-assignment).
  task_id     := null;
  task_rows   := 0;
  assign_rows := 0;
  signal_rows := null;
  probe_error := null;

  begin
    insert into public.work_items (workspace_id, project_id, title, created_by)
    select ws, p.id, '[RLS PROBE - TRIGGERS] self-assign', a
    from public.projects p
    where p.workspace_id = ws
    limit 1
    returning id into task_id;

    get diagnostics task_rows = row_count;

    if task_rows > 0 then
      update public.work_items set assigned_to = a where id = task_id;
      get diagnostics assign_rows = row_count;

      select count(*) into signal_rows
      from public.signals
      where work_item_id = task_id;
    end if;

    raise exception using errcode = 'ORB01', message = 'undo probe';
  exception
    when sqlstate 'ORB01' then null;
    when others then probe_error := sqlerrm;
  end;

  insert into rls_results
  values (
    'triggers', 'assigning to yourself raises nothing',
    '0 signals',
    case when task_rows = 0 then 'no project to hang a task on'
         else coalesce(signal_rows, 0) || ' signals' end,
    case
      when probe_error is not null then 'FAIL — ' || probe_error
      when task_rows > 0 and assign_rows > 0 and signal_rows <> 0
           then 'FAIL — self-assignment raised ' || coalesce(signal_rows, 0) || ' signal(s)'
      when task_rows = 0   then 'VACUOUS — shared workspace has no project to create a task in'
      when assign_rows = 0 then 'VACUOUS — the update under test affected no rows'
      else 'PASS'
    end
  );
end
$$;


-- 14b. Mentions: editing a note body twice raises the mention signal once —
--      the old-body diffing in private.signal_mentions(). Guarded on the
--      trigger's presence: 202608180004_mention_triggers.sql may not be
--      applied yet, and an absent trigger should read as a clear SKIP, not a
--      confusing FAIL that looks like a bug in the trigger itself.
do $$
declare
  ws             uuid;
  a              uuid;
  b              uuid;
  note_row_id    uuid;
  note_rows      bigint := 0;
  edit_rows      bigint := 0;
  signal_rows    bigint;
  trigger_exists boolean;
  probe_error    text := null;
begin
  select exists (
    select 1 from pg_trigger
    where tgname = 'notes_signal_mentions'
      and tgrelid = 'public.notes'::regclass
      and not tgisinternal
  ) into trigger_exists;

  if not trigger_exists then
    insert into rls_results values
      ('triggers', 'editing a note twice raises only one mention signal', 'n/a', 'n/a',
       'SKIP — notes_signal_mentions trigger not present; apply 202608180004_mention_triggers.sql');
    return;
  end if;

  select shared_ws into ws from rls_scope;
  select user_a into a from rls_actors;
  select user_b into b from rls_actors;

  if ws is null then
    insert into rls_results values
      ('triggers', 'editing a note twice raises only one mention signal', 'n/a', 'n/a',
       'SKIP — accept the invitation first, then re-run');
    return;
  end if;

  -- Probe: A creates a note mentioning B, then edits the body again while
  -- keeping the same mention. The second edit must not re-notify B.
  begin
    insert into public.notes (workspace_id, note_type, title, body, created_by)
    values (
      ws, 'idea', '[RLS PROBE - TRIGGERS] mention',
      'cc orbit:user/' || b::text || ' — first draft', a
    )
    returning id into note_row_id;

    get diagnostics note_rows = row_count;

    if note_rows > 0 then
      update public.notes
         set body = 'cc orbit:user/' || b::text || ' — edited, still mentioned'
       where id = note_row_id;
      get diagnostics edit_rows = row_count;

      select count(*) into signal_rows
      from public.signals
      where note_id = note_row_id and recipient_id = b and kind = 'mentioned';
    end if;

    raise exception using errcode = 'ORB01', message = 'undo probe';
  exception
    when sqlstate 'ORB01' then null;
    when others then probe_error := sqlerrm;
  end;

  -- The second UPDATE is the actual event under test — the diffing in
  -- private.signal_mentions() only runs because of it. If it silently
  -- touched nothing, the 1-signal count would be entirely a leftover of the
  -- INSERT, and "PASS" would mean the diffing was never exercised.
  insert into rls_results
  values (
    'triggers', 'editing a note twice raises only one mention signal',
    '1 signal for B',
    case when note_rows = 0 then 'note insert failed'
         else coalesce(signal_rows, 0) || ' signals' end,
    case
      when probe_error is not null then 'FAIL — ' || probe_error
      when note_rows > 0 and edit_rows > 0 and signal_rows <> 1
           then 'FAIL — expected exactly one mentioned signal after two edits, got ' || coalesce(signal_rows, 0)
      when note_rows = 0 then 'VACUOUS — could not create the probe note'
      when edit_rows = 0 then 'VACUOUS — the update under test affected no rows'
      else 'PASS'
    end
  );
end
$$;


-- ---------------------------------------------------------------------------
-- 14c. Safety net for the trigger probes above, extending the idea from
--      step 13: if a subtransaction rollback did not take, the probe rows
--      (and the signals the triggers raised for them) would still be here.
--      Counted without RLS, so nothing can hide.
-- ---------------------------------------------------------------------------

do $$
declare
  leftover_items   bigint;
  leftover_notes   bigint;
  leftover_signals bigint;
begin
  select count(*) into leftover_items
  from public.work_items
  where title like '[RLS PROBE - TRIGGERS]%';

  select count(*) into leftover_notes
  from public.notes
  where title like '[RLS PROBE - TRIGGERS]%';

  select count(*) into leftover_signals
  from public.signals
  where work_item_id in (select id from public.work_items where title like '[RLS PROBE - TRIGGERS]%')
     or note_id in (select id from public.notes where title like '[RLS PROBE - TRIGGERS]%');

  insert into rls_results
  values (
    'cleanup', 'trigger probe writes rolled back',
    '0 work items, 0 notes, 0 signals',
    leftover_items || ' work items, ' || leftover_notes || ' notes, ' || leftover_signals || ' signals',
    case when leftover_items = 0 and leftover_notes = 0 and leftover_signals = 0
         then 'PASS'
         else 'FAIL — RUN THE REPAIR AT THE BOTTOM OF THIS FILE (trigger probes)'
    end
  );
end
$$;


-- ---------------------------------------------------------------------------
-- 14e. VIEWER IS UNREACHABLE: 202608200002_role_model.sql added a CHECK on
--      both workspace_members.role and workspace_invitations.role forbidding
--      'viewer'. A count of zero rows only shows nobody has tried; the second
--      probe proves the database itself refuses the value.
--
--      Runs as the admin role (unchanged from 14a-14d), so nothing here is
--      about RLS — the CHECK applies regardless of who is writing.
-- ---------------------------------------------------------------------------

do $$
declare
  holders integer;
  outcome text := 'accepted';
begin
  select
    (select count(*) from public.workspace_members where role = 'viewer')
    + (select count(*) from public.workspace_invitations where role = 'viewer')
  into holders;

  insert into rls_results
  values (
    'grants',
    'nobody holds the viewer role',
    '0 rows',
    holders || ' rows',
    case when holders = 0 then 'PASS' else 'FAIL — viewer is reachable after all' end
  );

  -- A count of zero could mean the constraint works or merely that nobody has
  -- tried. Prove it actually refuses, inside a subtransaction so nothing
  -- persists.
  --
  -- workspace_members.user_id references auth.users(id), so a fabricated
  -- uuid there would raise a foreign-key violation before the CHECK ever
  -- runs, which would look identical to the constraint firing and prove
  -- nothing. workspace_invitations carries the same role CHECK but its
  -- columns have no such reference — email is free text and token only needs
  -- to be unique — so the probe lands here instead.
  begin
    insert into public.workspace_invitations (workspace_id, email, role, token, expires_at)
    select
      w.id,
      'rls-probe-' || gen_random_uuid()::text || '@example.com',
      'viewer',
      replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
      now() + interval '7 days'
    from public.workspaces w
    limit 1;
    outcome := 'accepted';
    raise exception using errcode = 'ORB01';
  exception
    when sqlstate 'ORB01' then null;                      -- insert succeeded, rolled back
    when check_violation then outcome := 'rejected';
    when others then outcome := 'inconclusive: ' || sqlerrm;
  end;

  insert into rls_results
  values (
    'grants',
    'the database refuses a viewer invitation',
    'rejected by CHECK',
    outcome,
    case
      when outcome = 'rejected' then 'PASS'
      when outcome = 'accepted' then 'FAIL — the CHECK constraint is not enforcing'
      else 'VACUOUS — ' || outcome
    end
  );
end
$$;


-- ---------------------------------------------------------------------------
-- 14f. DELETE POLICY: 202608200002_role_model.sql widened the DELETE policy on
--      workspace_members — role <> 'owner' no longer excludes owners, so an
--      owner can now remove a co-owner's membership. That widening shipped
--      with only the viewer-role checks above (14e); the policy change itself
--      was never exercised. Two probes close the gap:
--
--        - an owner removing a co-owner while another owner survives must be
--          allowed. That's the whole point of the change.
--        - an owner removing the workspace's last owner must still be
--          refused — by the trigger, since the policy no longer excludes
--          owners at all. Only the trigger's own message counts as proof;
--          a different rejection (a stale grant, an unrelated constraint)
--          would look identical to a real pass and prove nothing.
--
--      Discovery runs as admin so it is not itself filtered by the policy
--      under test; the found actor is then impersonated for the actual probe
--      (check 2 only — see check 1's own comment below for why it differs).
-- ---------------------------------------------------------------------------

create temp table rls_owner_probe as
with one_owner as (
  select wm.workspace_id, wm.user_id as actor
  from public.workspace_members wm
  where wm.role = 'owner'
    and not exists (
      select 1 from public.workspace_members other
      where other.workspace_id = wm.workspace_id
        and other.role = 'owner'
        and other.user_id <> wm.user_id
    )
),
promote_candidate as (
  -- A one-owner workspace paired with a real auth.users account that is not
  -- already a member of it, so check 1 can manufacture its own two-owner
  -- condition instead of hunting for a workspace that already has one — the
  -- fixture this project never had, which is why the check used to SKIP.
  select o.workspace_id, o.actor as original_owner, u.id as new_owner
  from one_owner o
  join auth.users u on u.id <> o.actor
  where not exists (
    select 1 from public.workspace_members m
    where m.workspace_id = o.workspace_id and m.user_id = u.id
  )
  order by o.workspace_id, u.id
  limit 1
),
last_owner_candidate as (
  select workspace_id, actor
  from one_owner
  order by workspace_id
  limit 1
)
select
  pc.workspace_id      as promote_ws,
  pc.original_owner    as promote_original_owner,
  pc.new_owner         as promote_new_owner,
  lo.workspace_id      as one_owner_ws,
  lo.actor             as one_owner_actor
from (select 1) x
left join promote_candidate pc on true
left join last_owner_candidate lo on true;

grant select on rls_owner_probe to authenticated;

-- Check 1: an owner's membership can be deleted when another owner remains.
--
-- Runs as the admin role — deliberately NOT impersonated, unlike check 2
-- below. The probe first has to CREATE the condition it tests (insert a
-- second owner into a workspace that starts with exactly one); doing that
-- insert plus the delete that follows it as admin means both bypass RLS
-- entirely. That is fine, and not an oversight: the behaviour under test
-- here is the TRIGGER's willingness to let an owner go while another
-- remains, not the DELETE policy's `using` clause. This check is not proof
-- the RLS policy was exercised — check 2 is the one that impersonates a real
-- owner and evaluates the policy itself.
do $$
declare
  ws             uuid;
  original_owner uuid;
  new_owner      uuid;
  inserted       bigint := 0;
  deleted        bigint := 0;
  probe_error    text := null;
  failed_stage   text := null;
begin
  select promote_ws, promote_original_owner, promote_new_owner
    into ws, original_owner, new_owner
  from rls_owner_probe;

  if ws is null then
    insert into rls_results values (
      'grants', 'an owner''s membership can be deleted when another owner remains',
      'n/a', 'n/a',
      'SKIP — no one-owner workspace has an eligible auth.users account to promote'
    );
    return;
  end if;

  begin
    failed_stage := 'insert';
    insert into public.workspace_members (workspace_id, user_id, role)
    values (ws, new_owner, 'owner');
    get diagnostics inserted = row_count;

    failed_stage := 'delete';
    delete from public.workspace_members
     where workspace_id = ws and user_id = original_owner and role = 'owner';
    get diagnostics deleted = row_count;

    failed_stage := null;
    raise exception using errcode = 'ORB01', message = 'undo probe';
  exception
    when sqlstate 'ORB01' then null;                 -- our signal: write undone
    when others then probe_error := sqlerrm;
  end;

  insert into rls_results
  values (
    'grants',
    'an owner''s membership can be deleted when another owner remains',
    '1 row deleted',
    case
      when probe_error is not null then probe_error
      else deleted || ' rows deleted'
    end,
    case
      -- Failed before the delete was ever attempted: the probe never reached
      -- the behaviour under test, so this proves nothing either way.
      when probe_error is not null and failed_stage = 'insert'
        then 'VACUOUS — could not create the second owner: ' || probe_error
      -- Failed while removing the original owner: the delete was refused.
      when probe_error is not null and failed_stage = 'delete'
        then 'FAIL — the DELETE policy still excludes owners: ' || probe_error
      when probe_error is not null
        then 'VACUOUS — ' || probe_error
      when deleted = 1 then 'PASS'
      else 'VACUOUS — the delete affected no rows'
    end
  );
end
$$;

reset role;

-- Check 2: the last owner cannot be removed — the trigger must catch it.
select set_config(
  'request.jwt.claims',
  json_build_object('sub', one_owner_actor, 'role', 'authenticated')::text,
  false
)
from rls_owner_probe;

select set_config('request.jwt.claim.sub', one_owner_actor::text, false) from rls_owner_probe;

set role authenticated;

do $$
declare
  ws          uuid;
  actor       uuid;
  deleted     bigint := 0;
  probe_error text := null;
begin
  select one_owner_ws, one_owner_actor into ws, actor from rls_owner_probe;

  if ws is null then
    insert into rls_results values (
      'grants', 'the last owner cannot be deleted',
      'n/a', 'n/a', 'SKIP — no single-owner workspace found'
    );
    return;
  end if;

  begin
    delete from public.workspace_members
     where workspace_id = ws and user_id = actor and role = 'owner';
    get diagnostics deleted = row_count;
    raise exception using errcode = 'ORB01', message = 'undo probe';
  exception
    when sqlstate 'ORB01' then null;                 -- our signal: write undone
    when others then probe_error := sqlerrm;
  end;

  insert into rls_results
  values (
    'grants',
    'the last owner cannot be deleted',
    'A workspace needs at least one owner',
    coalesce(probe_error, deleted || ' rows deleted, no error'),
    case
      when probe_error = 'A workspace needs at least one owner' then 'PASS'
      when probe_error is not null then 'VACUOUS — blocked for an unrelated reason: ' || probe_error
      when deleted = 1 then 'FAIL — the last owner was removed'
      else 'VACUOUS — the delete was filtered out before it could reach the trigger'
    end
  );
end
$$;

reset role;


-- ---------------------------------------------------------------------------
-- 14g. MILESTONE LINK TARGET: 202608200004_note_links_milestones.sql gave
--      note_links a fourth target column and widened two guards to match —
--      the one-target CHECK's num_nonnulls count, and the unique index's
--      coalesce. The widened coalesce gives a milestone link a non-null index
--      key, so two links from one note to different milestones can coexist.
--      This check proves both inserts are accepted — a real guarantee that
--      rules out an index defined NULLS NOT DISTINCT or a wrong coalesce.
--      Postgres unique indexes treat NULL as distinct from NULL by default,
--      so an un-widened index would not reject the second link. The
--      one-target CHECK would have rejected a milestone-only row before the
--      index ever saw it (it counted zero of the three nonnull targets), so
--      the check failure mode is not "coalesce to null", it is "narrow
--      coalesce does not allow two different targets at all".
--      Neither is reachable from vitest (no database) or caught by a
--      TypeScript type check (both are runtime constraints).
--
--      Runs as the admin role, unchanged from 14a-14f — these probes exercise
--      the CONSTRAINTS (the CHECK and the unique index), not RLS policies.
--      A milestone-only insert succeeding here says nothing about whether an
--      authenticated user is allowed to make it; that boundary is
--      "Authors can record their note links" from 202608100007_note_links.sql
--      and is not under test in this section.
--
--      Fixture (a note and three milestones) is created fresh in this probe
--      rather than hunted for, so the checks never SKIP for want of data —
--      only a workspace with no project at all (needed to hang a milestone
--      on) produces a SKIP. Distinct milestones back each check (ms1 for the
--      first, ms2/ms3 for the second) so the first check's own insert can
--      never be mistaken for the second check's collision.
-- ---------------------------------------------------------------------------

do $$
declare
  ws            uuid;
  proj          uuid;
  a             uuid;
  note_id       uuid;
  ms1           uuid;
  ms2           uuid;
  ms3           uuid;
  fixture_error text := null;
  probe1_state  text := null;
  probe1_error  text := null;
  probe2_state  text := null;
  probe2_error  text := null;
  link1_rows    bigint := 0;
  link2a_rows   bigint := 0;
  link2b_rows   bigint := 0;
begin
  select user_a into a from rls_actors;

  select p.workspace_id, p.id into ws, proj
  from public.projects p
  order by p.workspace_id
  limit 1;

  if ws is null then
    insert into rls_results values
      ('schema', 'note_links accepts a milestone-only target', 'n/a', 'n/a',
       'SKIP — no workspace has a project to hang a milestone on'),
      ('schema', 'two milestone links from one note do not collide', 'n/a', 'n/a',
       'SKIP — no workspace has a project to hang a milestone on');
    return;
  end if;

  -- Fixture (a note and three milestones) plus both probes happen inside ONE
  -- subtransaction, so the fixture rows persist across both checks and
  -- everything — fixture included — is undone by a single ORB01 raise at the
  -- end of this block. The two check probes nested inside it each catch their
  -- own ORB01 too, so check 1's insert can never be mistaken for check 2's.
  --
  -- Deliberately NOT the same shape as step 12/14a: those roll back a single
  -- write each and report immediately after. Here the fixture has to survive
  -- across two checks, so the rls_results inserts happen AFTER this whole
  -- block ends, using variables captured from it — never inside it, where
  -- they would roll back along with the probe and the verdict would silently
  -- vanish (the mistake this file's history already made once).
  begin
    insert into public.notes (workspace_id, title, created_by)
    values (ws, '[RLS PROBE - MILESTONE LINKS] note', a)
    returning id into note_id;

    insert into public.milestones (workspace_id, project_id, title, created_by)
    values (ws, proj, '[RLS PROBE - MILESTONE LINKS] milestone 1', a)
    returning id into ms1;

    insert into public.milestones (workspace_id, project_id, title, created_by)
    values (ws, proj, '[RLS PROBE - MILESTONE LINKS] milestone 2', a)
    returning id into ms2;

    insert into public.milestones (workspace_id, project_id, title, created_by)
    values (ws, proj, '[RLS PROBE - MILESTONE LINKS] milestone 3', a)
    returning id into ms3;

    -- Check 1 probe: a milestone-only link (only target_milestone_id set).
    -- Nested subtransaction so its own rollback can't be mistaken for check
    -- 2's collision test below.
    begin
      insert into public.note_links (workspace_id, note_id, target_milestone_id, created_by)
      values (ws, note_id, ms1, a);
      get diagnostics link1_rows = row_count;
      raise exception using errcode = 'ORB01', message = 'undo probe 1';
    exception
      when sqlstate 'ORB01' then null;                          -- accepted, rolled back
      when check_violation  then probe1_state := 'check_violation'; probe1_error := sqlerrm;
      when others           then probe1_state := 'other';           probe1_error := sqlerrm;
    end;

    -- Check 2 probe: two DIFFERENT milestones linked from the same note.
    begin
      insert into public.note_links (workspace_id, note_id, target_milestone_id, created_by)
      values (ws, note_id, ms2, a);
      get diagnostics link2a_rows = row_count;

      insert into public.note_links (workspace_id, note_id, target_milestone_id, created_by)
      values (ws, note_id, ms3, a);
      get diagnostics link2b_rows = row_count;

      raise exception using errcode = 'ORB01', message = 'undo probe 2';
    exception
      when sqlstate 'ORB01' then null;                          -- both accepted, rolled back
      when unique_violation then probe2_state := 'unique_violation'; probe2_error := sqlerrm;
      when others           then probe2_state := 'other';            probe2_error := sqlerrm;
    end;

    raise exception using errcode = 'ORB01', message = 'undo fixture';
  exception
    when sqlstate 'ORB01' then null;                            -- fixture undone
    when others           then fixture_error := sqlerrm;
  end;

  if fixture_error is not null then
    insert into rls_results values
      ('schema', 'note_links accepts a milestone-only target', 'n/a', 'n/a',
       'SKIP — could not create fixture note/milestones: ' || fixture_error),
      ('schema', 'two milestone links from one note do not collide', 'n/a', 'n/a',
       'SKIP — could not create fixture note/milestones: ' || fixture_error);
    return;
  end if;

  -- Results, inserted OUTSIDE the fixture block above so they survive its
  -- rollback.
  insert into rls_results
  values (
    'schema',
    'note_links accepts a milestone-only target',
    'insert accepted',
    case when probe1_error is not null then probe1_error else link1_rows || ' row inserted' end,
    case
      -- A check_violation is the one-target CHECK rejecting a legitimate
      -- milestone-only row: it did not widen.
      when probe1_state = 'check_violation' then 'FAIL — the one-target check does not count milestones'
      -- Any other error (a foreign key, a not-null) means the probe never
      -- reached the CHECK at all, so this proves nothing about it either way.
      when probe1_state = 'other' then 'VACUOUS — ' || probe1_error
      when link1_rows = 1 then 'PASS'
      else 'VACUOUS — the insert affected no rows'
    end
  );

  insert into rls_results
  values (
    'schema',
    'a note can link two different milestones',
    'both inserts accepted',
    case
      when probe2_error is not null then probe2_error
      else (link2a_rows + link2b_rows) || ' rows inserted'
    end,
    case
      -- A unique_violation on two DIFFERENT milestones from the same note means
      -- the index or its coalesce rejected a legitimate second link.
      when probe2_state = 'unique_violation' then 'FAIL — the index or coalesce rejected the second link'
      when probe2_state = 'other' then 'VACUOUS — ' || probe2_error
      when link2a_rows = 1 and link2b_rows = 1 then 'PASS'
      else 'VACUOUS — an insert affected no rows'
    end
  );
end
$$;


-- ---------------------------------------------------------------------------
-- 15. Report. Failures first within each group, then anything vacuous.
-- ---------------------------------------------------------------------------

select
  check_group as "check",
  subject,
  expected,
  actual,
  verdict
from rls_results
order by
  case check_group
    when 'guard'     then 1
    when 'isolation' then 2
    when 'boundary'  then 3
    when 'sharing'   then 4
    when 'writes'    then 5
    when 'triggers'  then 6
    when 'grants'    then 7
    when 'schema'    then 8
    else 9
  end,
  case
    when verdict like 'FAIL%'    then 0
    when verdict like 'VACUOUS%' then 1
    when verdict like 'SKIP%'    then 2
    else 3
  end,
  subject;

-- Summary line.
select
  count(*) filter (where verdict like 'FAIL%')    as failures,
  count(*) filter (where verdict like 'VACUOUS%') as proved_nothing,
  count(*) filter (where verdict like 'SKIP%')    as skipped,
  count(*) filter (where verdict like 'PASS%')    as passed
from rls_results;


-- ---------------------------------------------------------------------------
-- REPAIR — only if a 'probe writes rolled back' or 'trigger probe writes
-- rolled back' check FAILED.
-- ---------------------------------------------------------------------------
--
-- Uncomment and run to strip the marker step 12 appends.
-- update public.work_items
--    set title = replace(title, ' [SHOULD NEVER PERSIST]', '')
--  where title like '%[SHOULD NEVER PERSIST]%';
--
-- Uncomment and run to remove step 14's probe rows. Deleting the work items
-- and notes cascades to any signals still referencing them (signals'
-- work_item_id/note_id foreign keys are ON DELETE CASCADE), so nothing else
-- to clean up separately.
-- delete from public.work_items where title like '[RLS PROBE - TRIGGERS]%';
-- delete from public.notes      where title like '[RLS PROBE - TRIGGERS]%';
