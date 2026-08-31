-- ============================================================================
-- Orbit Flo — privilege assertions (hermetic)
--
-- WHAT THIS FILE IS
--   Ten checks that read only the system catalogs. No accounts, no seed
--   data, no SET ROLE, no writes. It produces identical verdicts against an
--   empty freshly migrated database and against the live project, which is
--   what lets CI run it on every pull request.
--
--   This is the guard for four merged fixes:
--     #46  anon could execute security-definer functions
--     #50  anon held table privileges on 33 tables in public
--     #52  the viewer role existed and could be assigned
--     #54  authenticated could rewrite identity and provenance columns
--
-- WHY IT HAS TO BE AUTOMATIC
--   Supabase's platform default privileges are owned by supabase_admin and
--   cannot be altered by postgres. They grant ALL on every newly created
--   public table to anon and authenticated. A migration that creates a table
--   is over-granted the instant it runs and nothing in the database objects.
--   Ending every table-creating migration with a revoke is a habit; this file
--   is what notices when the habit lapses.
--
-- HOW TO RUN
--   In CI, and locally against a throwaway database:
--     psql "$DB_URL" -v ON_ERROR_STOP=1 -f docs/verification/grants-assertions.sql
--
--   Against the live project (safe — this file never writes):
--     npx supabase db query --linked -f docs/verification/grants-assertions.sql
--
-- HOW IT REPORTS
--   It prints one row per check, failures first, then raises an exception if
--   any verdict is not PASS or if fewer checks ran than expected. The exit
--   code lives in the SQL rather than in a wrapper so that both invocations
--   above fail loudly instead of printing a table you have to read carefully.
--
--   PASS            the privilege boundary is where it should be
--   FAIL — …        it is not
--   VACUOUS — …     the check ran but proved nothing
--   SKIP — …        preconditions absent
--
--   In THIS file, only PASS is acceptable. There are no preconditions that can
--   legitimately be absent, so VACUOUS and SKIP fail the build exactly as FAIL
--   does. The vocabulary is kept anyway so a check that degrades says why,
--   rather than reporting a failure for the wrong reason.
--
-- WHAT THIS FILE DOES NOT COVER
--   Row-level security. Every policy, every isolation boundary, and every
--   trigger side effect needs two signed-in accounts and real data; those live
--   in docs/verification/rls-assertions.sql and are still run by hand. Running
--   this file green does NOT mean the RLS boundaries were verified.
-- ============================================================================

create temp table grant_results (
  check_group text,
  subject     text,
  expected    text,
  actual      text,
  verdict     text
);

-- ---------------------------------------------------------------------------
-- 0. THE MIGRATED SCHEMA IS PRESENT.
--
--    Runs first, before anything else, regardless of later reordering. Every
--    check below assumes the schema exists; on an empty or half-migrated
--    database they would otherwise measure nothing and report a false PASS
--    via their coalesce(n, 0) defaults. This check exists so that failure
--    mode is named instead of accidental.
-- ---------------------------------------------------------------------------

do $$
declare
  -- This is a FLOOR, not the exact schema size. The table count only grows
  -- over time, so pinning it to today's exact count (34) would make this
  -- check fail on every future migration that adds a table. Its job is only
  -- to catch an empty or half-migrated database, not to track the schema.
  min_public_tables constant integer := 30;
  n_tables integer;
begin
  select count(*)
  into n_tables
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind in ('r', 'p');

  insert into grant_results
  values (
    'grants',
    'the migrated schema is present',
    '>= ' || min_public_tables || ' public tables',
    n_tables || ' public tables',
    case when n_tables >= min_public_tables then 'PASS'
         else 'FAIL — only ' || n_tables || ' public tables found; the database is empty or half-migrated, so every check below would measure nothing' end
  );
end
$$;

-- ---------------------------------------------------------------------------
-- 1-2. ANON HOLDS NOTHING (#50), and the revoke did not overreach.
-- ---------------------------------------------------------------------------

do $$
declare
  leaked   text;
  n_leaked integer;
  total    integer;
  readable integer;
begin
  select
    string_agg(c.relname, ', ' order by c.relname),
    count(*)
  into leaked, n_leaked
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    -- Partitioned tables (relkind = 'p') are included alongside ordinary
    -- tables ('r') because they arrive with the same platform-default
    -- table-wide grants as ordinary ones — this is what checks 6-8 already
    -- do, and this check needs the same coverage or a partitioned table
    -- over-granted to anon goes undetected.
    and c.relkind in ('r', 'p')
    and (
      has_table_privilege('anon', c.oid, 'SELECT')
      or has_table_privilege('anon', c.oid, 'INSERT')
      or has_table_privilege('anon', c.oid, 'UPDATE')
      or has_table_privilege('anon', c.oid, 'DELETE')
    );

  insert into grant_results
  values (
    'grants',
    'anon holds no privilege on any public table',
    '0 tables',
    coalesce(n_leaked, 0) || ' tables' || coalesce(': ' || leaked, ''),
    case when coalesce(n_leaked, 0) = 0 then 'PASS'
         else 'FAIL — revoke anon on these, they arrived pre-granted' end
  );

  -- The opposite error. A revoke that overreached would break every signed-in
  -- request, and would otherwise look identical to a clean pass above.
  select
    count(*),
    count(*) filter (where has_table_privilege('authenticated', c.oid, 'SELECT'))
  into total, readable
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind in ('r', 'p');

  insert into grant_results
  values (
    'grants',
    'authenticated can still read every public table',
    total || ' tables',
    readable || ' tables',
    case when readable = total then 'PASS' else 'FAIL — the revoke overreached' end
  );
end
$$;


-- ---------------------------------------------------------------------------
-- 3-4. SECURITY-DEFINER FUNCTIONS ARE NOT ANON-CALLABLE (#46).
--
--      A security definer function bypasses RLS entirely, so for it the grant
--      IS the boundary. preview_workspace_invitation is the one deliberate
--      exception: /invite/:token renders before sign-in.
-- ---------------------------------------------------------------------------

do $$
declare
  exposed text;
begin
  select string_agg(p.proname, ', ' order by p.proname)
  into exposed
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.prosecdef
    and has_function_privilege('anon', p.oid, 'EXECUTE')
    and p.proname <> 'preview_workspace_invitation';

  insert into grant_results
  values (
    'grants',
    'no security-definer function is anon-callable',
    'none but preview_workspace_invitation',
    coalesce(exposed, 'none'),
    case when exposed is null then 'PASS' else 'FAIL — revoke anon on these' end
  );

  insert into grant_results
  values (
    'grants',
    'preview_workspace_invitation stays anon-callable',
    'true',
    case when to_regprocedure('public.preview_workspace_invitation(text)') is null then 'function missing'
         else has_function_privilege('anon', 'public.preview_workspace_invitation(text)', 'EXECUTE')::text end,
    case when to_regprocedure('public.preview_workspace_invitation(text)') is null
           then 'FAIL — the function is missing entirely; the invite page cannot render for signed-out recipients'
         when has_function_privilege('anon', 'public.preview_workspace_invitation(text)', 'EXECUTE')
           then 'PASS'
         else 'FAIL — the invite page will break for signed-out recipients' end
  );
end
$$;

-- ---------------------------------------------------------------------------
-- 5. VIEWER IS UNREACHABLE (#52).
--
--    202608200002_role_model.sql added a CHECK on both workspace_members.role
--    and workspace_invitations.role forbidding 'viewer'. The enum VALUE stays,
--    because dropping one means recreating the type and every policy and
--    function depending on it.
--
--    HONEST SCOPE: this proves the constraints are ATTACHED, VALIDATED, on the
--    right table, and still reference 'viewer' in their definition — not that
--    they reject on insert. Proving refusal needs an insert probe, which needs
--    a real workspace row, which is not hermetic — that probe lives in
--    rls-assertions.sql and is still run by hand. What this catches is a
--    migration dropping, invalidating, or silently defanging the constraint
--    (e.g. redefining it to `check (true)` while keeping its name), which is
--    the drift that would actually happen.
--
--    The row-count version ('nobody holds the viewer role') stays in
--    rls-assertions.sql, where there is real data to count.
-- ---------------------------------------------------------------------------

do $$
declare
  found_valid integer;
begin
  select count(*)
  into found_valid
  from pg_constraint
  where conname in (
      'workspace_members_role_not_viewer',
      'workspace_invitations_role_not_viewer'
    )
    and contype = 'c'
    and convalidated
    and pg_get_constraintdef(oid) like '%viewer%'
    and conrelid in ('public.workspace_members'::regclass,
                     'public.workspace_invitations'::regclass);

  insert into grant_results
  values (
    'grants',
    'both role columns refuse viewer by constraint',
    '2 validated CHECK constraints',
    found_valid || ' validated CHECK constraints',
    case when found_valid = 2 then 'PASS'
         else 'FAIL — a role CHECK is missing, dropped, or NOT VALID; viewer is assignable again' end
  );
end
$$;

-- ---------------------------------------------------------------------------
-- 6-8. AUTHENTICATED CANNOT REWRITE IDENTITY OR PROVENANCE (#54), plus the two
--      inverse checks that make a green result mean something.
--
--      Checks 7 and 8 are not redundant with each other. Check 7 counts
--      COLUMNS and would still read clean if one table were wholly broken
--      among 33 healthy ones; check 8 counts TABLES so a single wounded table
--      cannot hide. public.signals is excluded from check 7 by name: it
--      legitimately exposes only read_at.
--
--      All three cover partitioned tables (relkind in ('r','p')), because a
--      partitioned table would otherwise arrive with platform-default
--      table-wide UPDATE and go unseen by relkind = 'r' alone.
-- ---------------------------------------------------------------------------

do $$
declare
  n_public_tables integer;
  writable        text;
  n_writable      integer;
  not_writable    text;
  n_not_writable  integer;
  starved_tables  text;
  n_starved       integer;
begin
  -- Captured once, up front, so checks 6-8 are honest about having measured
  -- nothing on an empty or half-migrated database, rather than relying on
  -- check 0 (or the accident that check 5's ::regclass cast used to raise
  -- first) to keep that case from ever reaching them.
  select count(*)
  into n_public_tables
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind in ('r', 'p');

  select
    string_agg(c.table_name || '.' || c.column_name, ', ' order by c.table_name, c.column_name),
    count(*)
  into writable, n_writable
  from information_schema.columns c
  join pg_class pc on pc.relname = c.table_name
  join pg_namespace n on n.oid = pc.relnamespace and n.nspname = 'public'
  where c.table_schema = 'public'
    and pc.relkind in ('r', 'p')
    and c.column_name in ('id', 'workspace_id', 'created_by', 'created_at', 'updated_at')
    and has_column_privilege('authenticated', ('public.' || quote_ident(c.table_name))::regclass, c.column_name, 'UPDATE');

  insert into grant_results
  values (
    'grants',
    'authenticated cannot rewrite identity or provenance columns',
    '0 columns',
    coalesce(n_writable, 0) || ' columns' || coalesce(': ' || writable, ''),
    case when n_public_tables = 0 then 'VACUOUS — no public tables exist to inspect'
         when coalesce(n_writable, 0) = 0 then 'PASS'
         else 'FAIL — revoke update on these; a new table arrives pre-granted' end
  );

  select
    string_agg(c.table_name || '.' || c.column_name, ', ' order by c.table_name, c.column_name),
    count(*)
  into not_writable, n_not_writable
  from information_schema.columns c
  join pg_class pc on pc.relname = c.table_name
  join pg_namespace n on n.oid = pc.relnamespace and n.nspname = 'public'
  where c.table_schema = 'public'
    and pc.relkind in ('r', 'p')
    and pc.relname <> 'signals'
    and c.column_name not in ('id', 'workspace_id', 'created_by', 'created_at', 'updated_at')
    and not has_column_privilege('authenticated', ('public.' || quote_ident(c.table_name))::regclass, c.column_name, 'UPDATE');

  insert into grant_results
  values (
    'grants',
    'authenticated can edit every non-protected column',
    '0 columns',
    coalesce(n_not_writable, 0) || ' columns' || coalesce(': ' || not_writable, ''),
    case when n_public_tables = 0 then 'VACUOUS — no public tables exist to inspect'
         when coalesce(n_not_writable, 0) = 0 then 'PASS'
         else 'FAIL — these columns cannot be edited; a column added later inherits no grant' end
  );

  select
    string_agg(pc.relname, ', ' order by pc.relname),
    count(*)
  into starved_tables, n_starved
  from pg_class pc
  join pg_namespace n on n.oid = pc.relnamespace and n.nspname = 'public'
  where pc.relkind in ('r', 'p')
    and not exists (
      select 1
      from information_schema.columns c
      where c.table_schema = 'public'
        and c.table_name = pc.relname
        and has_column_privilege('authenticated', ('public.' || quote_ident(c.table_name))::regclass, c.column_name, 'UPDATE')
    );

  insert into grant_results
  values (
    'grants',
    'every table still has some updatable column',
    '0 tables',
    coalesce(n_starved, 0) || ' tables' || coalesce(': ' || starved_tables, ''),
    case when n_public_tables = 0 then 'VACUOUS — no public tables exist to inspect'
         when coalesce(n_starved, 0) = 0 then 'PASS'
         else 'FAIL — these tables cannot be edited at all: ' || coalesce(starved_tables, '') end
  );
end
$$;

-- ---------------------------------------------------------------------------
-- 9. PLATFORM DEFAULT PRIVILEGES ARE IN PLACE.
--
--    This check exists to defend the three checks above it, not to test the
--    schema on its own. "anon holds no privilege on any public table",
--    "no security-definer function is anon-callable", and "authenticated
--    cannot rewrite identity or provenance columns" only detect anything
--    because something granted anon/authenticated first, so the revoke has
--    something to revoke. That grant is the CI step "Reproduce the platform
--    default privileges" (and, on hosted, the platform itself). Delete that
--    step, typo it, or reorder it after the guard, and all three checks above
--    read a clean PASS forever — not because the boundary holds, but because
--    there was never anything to catch. A green run of this FILE without THIS
--    check would be meaningless.
--
--    pg_default_acl holds one row per (role, schema, object type) that has an
--    ALTER DEFAULT PRIVILEGES entry — (defaclrole, defaclnamespace,
--    defaclobjtype) is its key, so that triple is the grouping unit below,
--    not the owning role or the literal acl text. The owning role is not
--    pinned (postgres today, but that is an implementation detail this check
--    should not break on), and the acl is read with aclexplode + grantee name
--    rather than string-matched, so a change in which exact privileges are
--    granted (arwdDxtm vs a subset) does not produce a false failure here —
--    only the presence or absence of a default grant to each role matters.
-- ---------------------------------------------------------------------------

do $$
declare
  tables_ok    boolean;
  functions_ok boolean;
begin
  select exists (
    select 1
    from pg_default_acl d
    cross join lateral aclexplode(d.defaclacl) as a
    where d.defaclobjtype = 'r'
    group by d.defaclrole, d.defaclnamespace, d.defaclobjtype
    having bool_or(a.grantee::regrole::text = 'anon')
       and bool_or(a.grantee::regrole::text = 'authenticated')
  ) into tables_ok;

  select exists (
    select 1
    from pg_default_acl d
    cross join lateral aclexplode(d.defaclacl) as a
    where d.defaclobjtype = 'f'
    group by d.defaclrole, d.defaclnamespace, d.defaclobjtype
    having bool_or(a.grantee::regrole::text = 'anon')
       and bool_or(a.grantee::regrole::text = 'authenticated')
  ) into functions_ok;

  insert into grant_results
  values (
    'grants',
    'platform default privileges are in place',
    'a default ACL granting to both anon and authenticated, for tables and for functions',
    'tables: ' || case when tables_ok then 'present' else 'MISSING' end ||
      ', functions: ' || case when functions_ok then 'present' else 'MISSING' end,
    case when tables_ok and functions_ok then 'PASS'
         else 'FAIL — the platform default privilege step is missing (no pg_default_acl row grants both anon and authenticated on ' ||
           case when not tables_ok and not functions_ok then 'tables or functions'
                when not tables_ok then 'tables'
                else 'functions' end ||
           '); without it, "anon holds no privilege on any public table", "no security-definer function is anon-callable", and "authenticated cannot rewrite identity or provenance columns" would all read a clean PASS while proving nothing' end
  );
end
$$;

-- ---------------------------------------------------------------------------
-- Report. Failures first, so a CI log shows the problem without scrolling.
-- ---------------------------------------------------------------------------

select
  subject,
  expected,
  actual,
  verdict
from grant_results
order by
  case
    when verdict like 'FAIL%'    then 0
    when verdict like 'VACUOUS%' then 1
    when verdict like 'SKIP%'    then 2
    else 3
  end,
  subject;


-- ---------------------------------------------------------------------------
-- Exit code. Raising here rather than in a wrapper means every way of running
-- this file fails loudly — psql -v ON_ERROR_STOP=1 exits non-zero, and a human
-- running it through `supabase db query` gets an error instead of a table they
-- have to read carefully.
--
-- The count floor is the file-level version of the trap this whole harness
-- exists to avoid: a script that silently executed nothing would otherwise
-- report a clean zero failures. It is a FLOOR, not an equality, so adding an
-- eleventh check needs no edit here — but deleting one fails the build.
-- ---------------------------------------------------------------------------

do $$
declare
  expected_checks constant integer := 10;
  n_total   integer;
  n_bad     integer;
  bad_list  text;
begin
  select count(*) into n_total from grant_results;

  if n_total < expected_checks then
    raise exception
      'grants-assertions ran % checks, expected at least % — the script did not execute in full',
      n_total, expected_checks;
  end if;

  select count(*), string_agg(subject || ' → ' || verdict, '; ' order by subject)
  into n_bad, bad_list
  from grant_results
  where verdict not like 'PASS%';

  if n_bad > 0 then
    raise exception 'grants-assertions: % of % checks did not pass — %',
      n_bad, n_total, bad_list;
  end if;

  raise notice 'grants-assertions: all % checks passed', n_total;
end
$$;
