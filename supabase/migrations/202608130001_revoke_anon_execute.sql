-- Every security-definer function in this schema was written with the pair
--
--   revoke all on function ... from public;
--   grant execute on function ... to authenticated;
--
-- and the comments above them say, in effect, "only signed-in users can call
-- this". That is not what happened. Supabase grants EXECUTE on public
-- functions to `anon` and `authenticated` through ALTER DEFAULT PRIVILEGES, and
-- revoking from PUBLIC does not remove a role-specific grant. Verified
-- 2026-08-13 on the linked project: has_function_privilege('anon', ...) was
-- true for all eight.
--
-- Nothing was exploitable — each function checks auth.uid() and then membership
-- before it does anything, and `security definer` bypassing RLS is exactly why
-- those checks are there. But the API surface did not match the intent, and a
-- future function written to this pattern would inherit the same false comfort.
-- Close it explicitly.

-- 1. Functions that require a signed-in caller. `anon` reaching these can only
--    ever produce "Authentication required"; it should not reach them at all.
--
--    PUBLIC is revoked alongside `anon` even though these six already had it
--    revoked in their original migrations. Postgres grants EXECUTE to PUBLIC by
--    default, and PUBLIC covers every role — so revoking `anon` alone is a
--    no-op wherever the PUBLIC grant survives. Repeating it here makes this
--    migration self-contained rather than dependent on what came before.
revoke execute on function public.accept_workspace_invitation(text) from public, anon;
revoke execute on function public.create_workspace(text) from public, anon;
revoke execute on function public.create_personal_workspace(text) from public, anon;
revoke execute on function public.create_workspace_invitation(uuid, text, public.workspace_role) from public, anon;
revoke execute on function public.find_unlinked_mentions(text, uuid) from public, anon;
revoke execute on function public.replace_mind_map_graph(
  uuid, uuid, text, text, public.mind_map_view, jsonb, jsonb
) from public, anon;

-- 2. preview_workspace_invitation deliberately KEEPS anon execute.
--
--    /invite/:token is an unguarded route and the preview query runs before
--    sign-in, so the recipient sees which workspace they were invited to and by
--    whom before being asked to authenticate. Revoking anon here would replace
--    that with "This invitation could not be found" for every signed-out
--    recipient — the normal case.
--
--    It leaks only to a caller already holding a 256-bit token: workspace name,
--    inviter display name, invited email. That is precisely what the recipient
--    needs, and the original migration's comment claiming it is
--    authenticated-only was wrong about the mechanism, not the intent.
comment on function public.preview_workspace_invitation(text) is
  'Anon-callable by design: the invite landing page renders before sign-in. Requires a valid token.';

-- 3. handle_new_user is a trigger function and nothing should ever call it
--    directly. Postgres refuses to invoke a trigger function outside a trigger,
--    so this was never exploitable, but it has no business being in the REST
--    surface at all.
--
--    This cannot break signup. Postgres checks EXECUTE on a trigger function
--    when the trigger is created, not each time it fires, and the insert into
--    auth.users is performed by supabase_auth_admin rather than anon or
--    authenticated — neither of the roles being revoked here is the one that
--    fires it.
--
--    PUBLIC matters most here: unlike the six above, handle_new_user never had
--    a `revoke all ... from public` in the migration that created it, so the
--    default PUBLIC grant was still standing. The first version of this
--    migration revoked only anon and authenticated, and the check at the bottom
--    caught that it had changed nothing.
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- 4. set_updated_at is the one function here with a mutable search_path. It is
--    security invoker, so this is hygiene rather than a live escalation path —
--    but it runs as a trigger on nearly every table in the schema, which is the
--    last place to leave search_path resolution up to the caller.
alter function public.set_updated_at() set search_path = public, pg_temp;

-- Verify, so this migration proves its own effect rather than asserting it.
do $$
declare
  leaked text;
begin
  select string_agg(p.proname, ', ' order by p.proname) into leaked
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.prosecdef
    and has_function_privilege('anon', p.oid, 'EXECUTE')
    and p.proname <> 'preview_workspace_invitation';

  if leaked is not null then
    raise exception
      'still anon-executable after revoke: %. A security-definer function added later needs its own revoke.',
      leaked;
  end if;
end
$$;
