# Profiles Design

**Date:** 2026-08-09
**Status:** Approved

Sub-project C of the collaboration arc. Unblocks D (invitations), E (membership
management), and F (assignment).

## Problem

Supabase does not expose `auth.users` to clients, so `created_by` is an opaque
uuid everywhere it appears. Nothing in the app displays who created or owns
anything, because nothing can. A member list, an assignee, a comment author,
and an invitation "from" line all need the same missing thing: a public
projection of the user.

## The table

```sql
public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
)
```

**No `avatar_url` column.** Sub-project F may want image avatars, but adding a
column now that nothing writes would recreate exactly the orphan pattern PRs
#29 and #32 spent their time removing. Initials derived from `display_name`
need no storage and no upload path. If F wants images, it adds the column and
the upload together.

`display_name` is `not null` because the trigger below always supplies one —
a nameless profile is worse than a defaulted one.

## Population

A profile must exist for every user without the client doing anything, so it is
a trigger on `auth.users`:

```sql
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(split_part(new.email, '@', 1), ''),
      'Pilot'
    )
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();
```

The name falls back through OAuth's `full_name`, then the email local part,
then `Pilot`. `on conflict do nothing` keeps the trigger idempotent, which
matters because the same migration backfills existing users with the identical
expression.

## Visibility

You may read a profile if it is yours or you share a workspace with its owner.
That needs a helper beside the existing ones:

```sql
create or replace function private.shares_workspace_with(target_user_id uuid)
returns boolean
language sql
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.workspace_members mine
    join public.workspace_members theirs on theirs.workspace_id = mine.workspace_id
    where mine.user_id = (select auth.uid())
      and theirs.user_id = target_user_id
  );
$$;
```

Security definer, revoked from `public`, granted to `authenticated` — the same
shape as `is_workspace_member` and `owns_daily_plan`.

Policies:

- **select** — `id = auth.uid() or private.shares_workspace_with(id)`
- **update** — `id = auth.uid()`, with the same `with check`
- **no insert or delete policy.** The trigger owns creation and the cascade
  owns deletion; a client has no business doing either.

Grants: `select` on the table, and `update(display_name)` only — so a client
cannot write `id`, `created_at`, or `updated_at` even if a policy would let it.

## Client

`src/features/profiles/profiles.queries.ts`:

```ts
export type Profile = { id: string; displayName: string };

listWorkspaceProfiles(client, workspaceId): Promise<Map<string, Profile>>
getProfile(client, userId): Promise<Profile | null>
updateDisplayName(client, input: { userId: string; displayName: string }): Promise<Profile>
```

`listWorkspaceProfiles` selects from `workspace_members` joined to `profiles`
for one workspace and returns a `Map` keyed by user id, because every consumer
(member list, assignee chip, comment author) needs lookup by id rather than a
list. It returns an empty map for a workspace with no members rather than
throwing.

`updateDisplayName` trims and rejects a blank name with `Names cannot be empty.`

## `MemberAvatar`

`src/features/profiles/member-avatar.tsx` — a circle with up to two initials,
a background colour chosen deterministically from the user id so the same
person is the same colour everywhere, and the display name as its accessible
name.

Initials come from the display name: first letters of the first two
whitespace-separated words, or the first two characters of a single word,
uppercased. An empty name cannot occur (`not null` plus a trim on write), but
the helper still returns `?` rather than an empty circle if one somehow does.

The colour palette reuses the existing label colours — cyan, blue, violet,
emerald, amber, rose — indexed by a simple character-sum hash of the id, so it
stays inside the design language rather than introducing new hues.

`initialsFor(name)` and `avatarToneFor(id)` are exported as pure functions and
tested directly; the component test covers rendering and the accessible name.

## Surfaces in this sub-project

Two, both in Settings, so the feature is real and verifiable rather than a
foundation nothing reads:

- **Your name** — a field in the existing account panel, saving through
  `updateDisplayName`.
- The account panel's "Signed in as" line gains the avatar and display name
  above the email it already shows.

Avatars on work items, member lists, and mentions belong to E and F.

## Error handling

- A failed profile load leaves Settings showing the email alone rather than
  breaking the page; identity is decoration there, not function.
- A failed rename leaves the field dirty and shows the Supabase message, like
  the workspace rename beside it.
- `listWorkspaceProfiles` failing degrades a consumer to ids rather than
  failing the screen. No consumer exists yet, but the contract is set now.

## Testing

`profiles.queries.test.ts`:
- `listWorkspaceProfiles` selects from `workspace_members` scoped to the
  workspace and returns a map keyed by user id.
- It returns an empty map, not a throw, when there are no rows.
- `updateDisplayName` trims, and rejects a blank name without writing.

`member-avatar.test.tsx`:
- `initialsFor` handles two words, one word, extra whitespace, and a single
  character.
- The same id always yields the same tone; different ids can differ.
- The component exposes the display name as its accessible name.

`settings-page.test.tsx`: renaming calls `updateDisplayName` with the trimmed
name, and a load failure still renders the email.

**RLS is not testable here** — no database in the vitest environment. Whether a
non-co-member is actually blocked is argued from the policy, not demonstrated,
exactly as in sub-project B.

## Migration

`supabase/migrations/202608100003_profiles.sql`: table, trigger function and
trigger, backfill, `shares_workspace_with`, policies, grants.

## Out of scope

- Image avatars and any storage bucket.
- Editing anyone else's profile.
- Any surface outside Settings.
- Presence, last-seen, or activity.
