-- The one function in this schema that is deliberately callable by `anon`
-- has never been granted to `anon` by any migration.
--
-- 202608100004 created preview_workspace_invitation, revoked it from PUBLIC,
-- and granted EXECUTE to `authenticated` only. 202608130001 then revoked anon
-- EXECUTE from every security-definer function EXCEPT this one, and its
-- comment records that the exception is deliberate: /invite/:token has to
-- render before sign-in, so a signed-out recipient can see who invited them
-- and to what.
--
-- But "not revoked" is not "granted". On the hosted project anon holds EXECUTE
-- here only because Supabase's platform default privileges grant EXECUTE on
-- every new function to anon, authenticated and service_role at creation time
-- — the same silent mechanism that granted nine tables nobody ever granted
-- (see 202608200007). Replay these migrations onto a database without that
-- platform layer and the invite page is broken for exactly the users it exists
-- for, with nothing in the schema explaining why.
--
-- Measured 2026-08-20 on a clean local stack: after replaying every migration,
-- has_function_privilege('anon', 'public.preview_workspace_invitation(text)',
-- 'EXECUTE') is false.
--
-- A capability this deliberate should be stated, not inherited. Granting it
-- explicitly also means the grant sits next to the reasoning, so a later
-- reader tightening anon privileges finds an intentional line to weigh rather
-- than an accident to clean up.
--
-- No-op on hosted, where anon already holds it.
grant execute on function public.preview_workspace_invitation(text) to anon;

-- Assert in both directions. This is a boundary: too little breaks the invite
-- page for signed-out recipients, too much re-opens the hole 202608130001
-- closed.
do $$
declare
  exposed text;
begin
  if not has_function_privilege(
       'anon', 'public.preview_workspace_invitation(text)', 'EXECUTE') then
    raise exception
      'anon still cannot execute preview_workspace_invitation; the invite page will not render before sign-in';
  end if;

  -- And nothing else opened up. Same query 202608130001 asserts with.
  select string_agg(p.proname, ', ' order by p.proname)
  into exposed
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.prosecdef
    and has_function_privilege('anon', p.oid, 'EXECUTE')
    and p.proname <> 'preview_workspace_invitation';

  if exposed is not null then
    raise exception
      'anon can execute security-definer functions it must not: %', exposed;
  end if;
end
$$;
