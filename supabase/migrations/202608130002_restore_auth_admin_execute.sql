-- 202608130001 revoked EXECUTE on public.handle_new_user() from PUBLIC, which
-- was correct for the REST-facing roles and wrong for one role it caught by
-- accident: supabase_auth_admin.
--
-- supabase_auth_admin owns auth.users and is the role GoTrue runs as when it
-- inserts a new account, which fires on_auth_user_created -> handle_new_user.
-- It held EXECUTE only through the default PUBLIC grant, so revoking PUBLIC
-- took it away too. Verified after that migration:
-- has_function_privilege('supabase_auth_admin', ...) returned false.
--
-- Postgres checks EXECUTE on a trigger function when the trigger is created
-- rather than each time it fires, so signup most likely kept working. "Most
-- likely" is not a good enough basis for account creation — the failure mode is
-- that nobody can sign up, surfacing as a generic auth error — so grant it back
-- explicitly instead of relying on that.
--
-- This gives up nothing. The goal was to remove handle_new_user from the roles
-- reachable through PostgREST; supabase_auth_admin is internal and is not one
-- of them. anon and authenticated stay revoked.

grant execute on function public.handle_new_user() to supabase_auth_admin;

do $$
declare
  admin_ok  boolean;
  anon_ok   boolean;
  authed_ok boolean;
begin
  select
    has_function_privilege('supabase_auth_admin', p.oid, 'EXECUTE'),
    has_function_privilege('anon', p.oid, 'EXECUTE'),
    has_function_privilege('authenticated', p.oid, 'EXECUTE')
  into admin_ok, anon_ok, authed_ok
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'handle_new_user';

  if not admin_ok then
    raise exception 'supabase_auth_admin still cannot execute handle_new_user; signup would be at risk';
  end if;
  if anon_ok or authed_ok then
    raise exception 'handle_new_user is reachable from PostgREST again (anon=%, authenticated=%)', anon_ok, authed_ok;
  end if;
end
$$;
