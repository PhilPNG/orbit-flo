# Signals — activity notifications and @-mentions

## The problem

The collaboration arc (PRs #30–#36) made Orbit Flo multi-user without making it
communicative. Someone can assign you a task, comment on your work, change your
role, or accept your invitation, and **nothing tells you any of it happened**.
You find out by chance, or by re-checking pages you have already read.

This is a hole the feature set created for itself: before collaboration there
was nobody else to hear from. It is the one area where the app is currently
worse than it was.

It cannot be solved by deriving from existing data. `work_items.assigned_to`
records who is assigned *now*, never that it changed or by whom, and no table
carries that history. The trail has to be written when the event happens.

## Scope

**In:** an activity trail, a personal notification inbox, and the `@`-mention
feature that feeds one of its event types.

**Out:** task descriptions gaining markdown or link support (a third text
surface, worth doing later for consistency); email or push delivery; digests;
per-signal mute rules.

## Product shape

A **personal notification inbox**, not a workspace activity feed. Rows are
addressed to a recipient and carry unread state. It answers *what needs my
attention* rather than *what has the team been doing*.

## Architecture: triggers, not application code

Every signal is written by a database trigger.

A notification you *sometimes* get is worse than none, because you stop trusting
it and go back to checking manually. A trigger fires on every path that changes
the data — the UI, an RPC, a future import, a fix run by hand in the SQL editor.
Application code has to remember, and in this codebase it has already failed to:
`linkMention` writes a note body without going through `createNote` and had to
be taught to call `saveNoteLinks` itself, or the mention vanished without
becoming a backlink. Trigger-written signals cannot reproduce that bug.

Triggers also handle edits for free. Adding a mention by editing a note a week
later fires the `UPDATE` trigger; application code would need to remember that
second path, which is the same trap again.

The house style already leans this way: `enforce_owner_survives`,
`set_updated_at` and `handle_new_user` are all triggers enforcing invariants.

**The cost, stated plainly:** none of this is reachable from vitest, which has
no database. That is mitigated, not waved away — see Testing.

## Data model

```sql
create type public.signal_kind as enum (
  'assigned', 'unassigned', 'commented', 'mentioned',
  'invitation_accepted', 'role_changed', 'removed_from_workspace'
);

create table public.signals (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces(id) on delete cascade,
  recipient_id  uuid not null references auth.users(id) on delete cascade,
  actor_id      uuid references public.profiles(id) on delete set null,
  kind          public.signal_kind not null,
  work_item_id  uuid,
  note_id       uuid,
  comment_id    uuid references public.work_item_comments(id) on delete cascade,
  read_at       timestamptz,
  created_at    timestamptz not null default now(),
  foreign key (work_item_id, workspace_id)
    references public.work_items(id, workspace_id) on delete cascade,
  foreign key (note_id, workspace_id)
    references public.notes(id, workspace_id) on delete cascade
);

create index signals_recipient_unread_idx
  on public.signals (recipient_id, read_at, created_at desc);
```

### Why the two user columns point at different tables

`actor_id` references `profiles` so the list can embed `profiles(display_name)`
and render "Alice assigned you...". `recipient_id` references `auth.users`,
because it is always the current user and never needs embedding.

Pointing both at `profiles` would give one table two foreign keys to it and make
the `profiles(...)` embed ambiguous. That is not hypothetical: a missing
`workspace_members -> profiles` key broke the Settings member list (fixed in
#48), and the reverse problem — two keys to the same table — is why the link
graph fetches titles by id instead of joining.

### Other schema decisions

- Target columns use the house composite pattern, so a signal cannot point at a
  row in a different workspace.
- `comment_id` is a plain reference: `work_item_comments` has no
  `(id, workspace_id)` unique constraint to hang a composite key on.
- `read_at` is per-row rather than a read cursor, so "mark this read", "mark all
  read" and leaving one deliberately unread are all expressible.
- The index covers `(recipient_id, read_at)` because every query filters on both.

### Access

RLS for select, update and delete:

```sql
recipient_id = (select auth.uid())
  and private.is_workspace_member(workspace_id)
```

**No insert policy and no insert grant.** Triggers own creation, matching the
deliberate gap in `workspace_members` and `workspace_invitations`.

Grants are `select, delete` plus `update(read_at)` only, so a client can mark
something read but cannot rewrite who did what.

## Triggers

| Kind | Fires on | Recipient |
|---|---|---|
| `assigned` / `unassigned` | `work_items` insert, and update where `assigned_to is distinct from` old | new assignee / previous assignee |
| `commented` | `work_item_comments` insert | the task's assignee and its creator |
| `mentioned` | `notes` and `work_item_comments` insert/update of body | each newly mentioned member |
| `invitation_accepted` | `workspace_invitations` update setting `accepted_at` | `invited_by` |
| `role_changed` | `workspace_members` update of `role` | the member |
| `removed_from_workspace` | `workspace_members` delete | the removed member |

Three rules every trigger follows:

1. **Never signal your own action.** Skip when the recipient is `auth.uid()`.
   Assigning yourself a task, commenting on your own task, and leaving a
   workspace voluntarily all stay silent.
2. **`is distinct from`, never `<>`.** Assignment moves to and from null
   constantly and `<>` is null-propagating: `null <> 'x'` is null, not true, so
   a first assignment would raise nothing at all.
3. **Mentions diff against the old body.** Only users in the new body and not in
   the old are signalled, or every later edit re-notifies everyone named.

`invitation_accepted` goes to the **inviter**, not the joiner. Whoever clicked
Accept already knows; the person currently learning nothing is who sent it.

Mention extraction verifies each id is a member of the workspace before writing.
A pasted or stale uuid otherwise creates rows nobody can read.

Recipients are deduplicated per event: a task whose assignee is also its creator
produces one `commented` row, not two.

## @-mentions

### Storage

`[@Ada Lovelace](orbit:user/<uuid>)` — ordinary markdown carrying the id,
matching `[Label](orbit:task/<uuid>)`. Renames never break a mention, and the
existing `urlTransform` allowlist already permits the `orbit:` scheme.

### The shared-helper trap

`extractOrbitLinks` gains a `user` kind, and `saveNoteLinks` consumes that same
function to reconcile `note_links` — a table with columns for notes, tasks and
projects and **none for users**. `saveNoteLinks` must filter `user` out
explicitly, with a test pinning it, or saving a note containing a mention tries
to persist a link it has no column for.

Users therefore stay out of the link graph, which is correct: the graph answers
"what does this touch", and a person is not a document.

### Editor

`LinkingTextarea` gains `@` alongside `[[`, with candidates drawn from workspace
members.

**`@` triggers only at a word boundary** — start of line, or preceded by
whitespace. Otherwise typing any email address opens the mention menu.

Candidates are workspace members only: correct behaviour, and a privacy boundary
against discovering users by typing.

### Rendering

`LinkedText` renders `orbit:user/...` as a **non-navigating chip**, not an
anchor. There is no user profile page, and a link that looks clickable and does
nothing is a lie.

### Surfaces

Note bodies get mentions for free — they already use these components. Comments
switch from a plain textarea and plain text to `LinkingTextarea` and
`LinkedText`, which **also gives comments markdown rendering** as a deliberate
side effect.

## Interface

### Route and navigation

`/w/:workspaceId/signals`, with **Signals** in the primary nav using lucide's
`RadioTower` — the vocabulary here is observatory, not inbox.

On mobile it lives in the More sheet, and **the unread marker surfaces on the
More button itself**. A notification discoverable only two taps deep with no
indicator is not a notification.

**The unread marker must not be cyan.** The house rule is that cyan means
interactive; unread is a state, not an affordance. Unread rows get a raised
surface and a non-cyan marker.

### Rows and actions

Actor avatar via the existing `MemberAvatar`, a sentence, relative time, and a
link to the target. Clicking navigates and marks that row read. A **Mark all
read** action clears the rest. No per-row dismiss: mark-all suffices, and a
delete affordance raises the question of whether it is recoverable.

`buildSignalSentence(kind, actorName, targetTitle)` is a pure function. All the
branching lives there, testable without a database.

A signal whose target was deleted still renders, with the target named as
"a deleted task" rather than vanishing — the cascade removes the row, so this
only covers the window between render and refetch.

### Queries

- `signalsQueryKey(workspaceId)` — the list, newest first, capped at 50.
- `unreadCountQueryKey(workspaceId)` — `count: 'exact', head: true` for the nav
  badge, separate from the list because the badge renders on every page.
- **Cross-workspace unread for the switcher dot** —
  `select workspace_id from signals where read_at is null`, counted client-side.
  No RPC and no grouping: RLS already restricts rows to the recipient, so that
  query *is* "my unread everywhere" by construction.

## Traps this feature walks into

Both are recorded from having been hit before.

**The capture harness.** The nav badge is a shell-level query and the
visual-review route asserts zero Supabase calls, so every new shell query must
be seeded in `createVisualQueryClient`. This has broken four times.

**The CI env gotcha.** `SignalsPage` must be lazy-loaded or stubbed in
`App.test.tsx`. A non-lazy route pulls in the real Supabase client, which throws
without env vars: green locally, red in CI. This has caught us twice.

## Testing

Three layers, because no single one reaches everything.

- **vitest** — `buildSignalSentence`; mention extraction including the
  `saveNoteLinks` user-filter; the `@` word-boundary rule; components against
  mocked queries.
- **SQL assertions** — triggers are unreachable from vitest, so they are checked
  the way RLS is, in the `docs/verification` harness: assign a task and assert a
  row exists for the assignee and not for the actor; edit a note twice and
  assert the second edit raises nothing; assign a task to yourself and assert
  silence.
- **e2e** — extend `collaboration.spec.ts`: the owner assigns a task to the
  teammate, and the teammate's browser shows the signal. The two-account harness
  already exists from #47.

## Risks

- **Trigger correctness is the whole feature.** A wrong `is distinct from`, or a
  missing self-check, produces either silence or noise, and both destroy trust
  in the inbox. The SQL assertions exist specifically for this.
- **Comment triggers fan out.** A task with an assignee and a different creator
  raises two rows per comment. Recipients are deduplicated and the author is
  always excluded, but a busy task is still chatty.
- **Mention diffing on update is the subtlest logic here.** Getting it wrong
  means every note edit re-notifies everyone named in the note.
