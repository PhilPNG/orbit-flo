-- 33 of the 34 tables in `public` granted SELECT, INSERT, UPDATE and DELETE to
-- `anon` — every table except `signals`, the one place a migration revoked it
-- explicitly. Several of those migrations carry comments asserting the
-- opposite ("no insert grant: the functions below own both, which is the whole
-- point"). The comments were wrong.
--
-- Nothing was exploitable. Every public table has RLS enabled with at least one
-- policy, and default-deny is what has actually been holding the line. But that
-- leaves the whole model resting on a single layer, with the layer beneath it
-- answering "yes" to anonymous callers on 33 tables. One policy written a
-- little too loosely, or one table added without RLS, turns a mistake into a
-- public hole rather than a private one.
--
-- WHERE THE GRANTS COME FROM, and why this cannot be fixed at the source.
--
-- Not from any migration in this repo — none of them grant to `anon`. They come
-- from Supabase's platform layer, via default privileges owned by
-- `supabase_admin`, which grants everything on new tables, sequences and
-- functions to anon, authenticated and service_role. Changing that is out of
-- reach: `postgres` is not a member of `supabase_admin`, and
-- `alter default privileges for role supabase_admin ...` fails with
-- "permission denied to change default privileges". Verified 2026-08-20.
--
-- So a REVOKE fixes the tables that exist and cannot stop the next one
-- arriving pre-granted. What makes that acceptable is that revokes stick:
-- `signals` was revoked on 2026-08-18 and three migrations have been pushed
-- since without the grant returning. The residual risk is a NEW table, which
-- is why docs/verification/rls-assertions.sql now fails when anon holds
-- anything on a public table.

revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;

-- PUBLIC separately, because revoking from `anon` does not touch a privilege
-- held via PUBLIC, and vice versa. This project has already been caught by
-- exactly that asymmetry once, in 202608130001.
revoke all on all tables in schema public from public;
revoke all on all sequences in schema public from public;

-- `authenticated` and `service_role` are deliberately untouched. The defect is
-- that ANONYMOUS callers hold grants; narrowing what signed-in users may reach
-- is a separate, much larger change, and RLS already governs which rows they
-- see. service_role in particular must keep everything — the e2e admin client
-- runs as it.
--
-- Function privileges are also untouched. 202608130001 already revoked anon on
-- every security-definer function, and `preview_workspace_invitation` keeps its
-- anon access on purpose: /invite/:token renders before sign-in.

do $$
declare
  leaked text;
begin
  select string_agg(c.relname, ', ' order by c.relname)
  into leaked
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind = 'r'
    and (
      has_table_privilege('anon', c.oid, 'SELECT')
      or has_table_privilege('anon', c.oid, 'INSERT')
      or has_table_privilege('anon', c.oid, 'UPDATE')
      or has_table_privilege('anon', c.oid, 'DELETE')
    );

  if leaked is not null then
    raise exception 'anon still holds table privileges in public: %', leaked;
  end if;
end
$$;

-- The other half of the check: prove the revoke did not take anything from the
-- roles the app actually runs as. A REVOKE that overreaches would break every
-- signed-in request, and a revoke that changed nothing would be silent — this
-- distinguishes the two.
do $$
declare
  authenticated_readable integer;
  service_writable integer;
  total integer;
begin
  select
    count(*) filter (where has_table_privilege('authenticated', c.oid, 'SELECT')),
    count(*) filter (where has_table_privilege('service_role', c.oid, 'INSERT')),
    count(*)
  into authenticated_readable, service_writable, total
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r';

  if authenticated_readable <> total then
    raise exception
      'authenticated can now read only % of % public tables; the revoke overreached',
      authenticated_readable, total;
  end if;

  if service_writable <> total then
    raise exception
      'service_role can now write only % of % public tables; the e2e admin client will break',
      service_writable, total;
  end if;
end
$$;
