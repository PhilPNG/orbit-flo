# Two-account verification checklist

PRs #31–#36 built workspace switching, the personal boundary, profiles,
invitations, membership and assignment. Every test covering them mocks
Supabase, so the RLS policies — the actual security boundary — have never been
executed. This checklist executes them.

Budget about 20 minutes. Run [`rls-assertions.sql`](rls-assertions.sql) at the
two points marked below; it catches leaks the UI cannot show you, because the
UI only ever renders what it asked for.

## Automated: `tests/e2e/collaboration.spec.ts`

Most of what follows now runs as an e2e test. It creates two throwaway accounts,
drives both browsers, and deletes the accounts afterwards.

```
npm run e2e -- collaboration.spec.ts
```

**It needs a service role key**, because creating and deleting test accounts is
an admin operation. Add it to `.env.local` (already gitignored via `*.local`),
alongside the credentials that are there:

```
E2E_SUPABASE_SERVICE_ROLE_KEY=<Dashboard → Settings → API → service_role>
```

The `E2E_` prefix is deliberate — Vite only exposes `VITE_*` to the client, so
this key reaches the dev server process and never the browser bundle. Do not
rename it.

Without the key the spec **skips** rather than fails, so CI stays green without
secrets.

**What it does to your project:** creates two `orbit-e2e-…@example.com`
accounts (`example.com` is reserved and undeliverable, so no mail can escape),
makes a project, a task, a note and a capture inside the throwaway workspace,
then deletes both accounts — which cascades the workspaces and everything in
them. It also deletes leftover `orbit-e2e-` accounts at the *start* of the run,
so a crashed run does not poison the next one. It never touches your own data.

Seeding goes through a client signed in as the test owner, not the service role,
so every insert passes the same policies the app runs under. A row the service
role could write but a member could not would quietly invalidate everything
asserted on top of it.

What the spec does **not** cover, and the manual pass below still does: the
owner one-way door, removal, re-invitation, expiry, and the switcher.

## Setup for the manual pass

Two browser profiles, not two tabs — Supabase stores the session in
`localStorage`, so two tabs in one profile share one account and the whole
exercise becomes theatre.

- **A** — your normal account, in your normal browser.
- **B** — a second real email, in a private window or a separate browser
  profile. It must be an address you can receive at, because
  `accept_workspace_invitation` compares the invited address to the signed-in
  one and refuses a mismatch.

Before starting, sign in as **B** once so a row exists in `auth.users`; the SQL
script needs it and will stop with a clear message if it is missing.

Have **A** create, in the workspace you will share:
- a project with at least one task,
- a note **inside that project**,
- a note on **Brainstorm** with no project,
- a capture in the Inbox,
- something on Today.

The last three exist so the boundary checks have something to hide. Without
them the script reports `VACUOUS`, which is not a pass.

---

## 1. Baseline isolation — before any invitation

**Run `rls-assertions.sql` now.** At this point A and B share nothing.

- [ ] Every `isolation` row reads `PASS`. A single `FAIL — LEAK` means B can
      read a table scoped to a workspace it has no membership in.
- [ ] The `guard` row is present. If the script stopped with *"auth.uid() is
      null"*, the impersonation did not take and nothing below it would have
      meant anything.
- [ ] `boundary` rows read `SKIP` — expected, there is no shared workspace yet.
- [ ] Both `writes` rows read `PASS`. The second one is privilege escalation:
      B inserting itself as `owner` of A's workspace.
- [ ] The `cleanup` row reads `PASS`. Step 12 attempts two writes on purpose
      and rolls them back; this confirms the rollback took. If it fails, the
      repair statement is commented out at the bottom of the SQL file.

### First run, 2026-08-12

Executed against the linked project with
`npx supabase db query --linked -f docs/verification/rls-assertions.sql`.
Result: **0 failures, 0 vacuous, 2 skipped, 35 passed.**

That decomposes as 1 guard + 31 isolation + 2 writes + 1 cleanup passing, with
`boundary` and `sharing` skipping because no two accounts shared a workspace
yet. The guard passing is the important part: `auth.uid()` resolved to the
second account, so those 31 zeros are real denials rather than the null-uid
artifact that would make everything trivially pass.

**But the isolation group had no vacuity check at the time.** Ground truth for
that workspace was 1 project, 4 work items, 7 daily plans, 11 mind maps and 6
board columns — with `notes`, `captures` and `milestones` empty. So roughly six
of the 31 were load-bearing and the rest were green because the table was
empty. The write probe was genuinely meaningful: it tried to rewrite 4 real
work items and touched none.

The script now applies the same vacuity detection to `isolation` and to the
write probe that it always applied to `boundary`. Re-running will reclassify
the empty-table rows as `VACUOUS`, which is the honest label — expect the
`passed` count to drop, and that is an improvement in the report, not a
regression in the database.

---

## 2. Invitation

As **A**, Settings → *Invite people*.

- [ ] Enter B's address, role `member`, *Create invite*. The row appears with
      an expiry roughly seven days out.
- [ ] Click the copy button. You get a `/invite/<token>` URL — **the app never
      sends an email.** Paste it to B yourself.
- [ ] Invite the same address again. Expected: *"That person is already a
      member"* only if they have accepted; otherwise the unique index on
      pending invitations rejects the duplicate. Either way it must not create
      a second live row silently.
- [ ] Enter something that is not an email. Expected: *"That does not look like
      an email address"* with no round trip.

### The wrong-recipient case

- [ ] Open the invite link **as A** (who is not the invited address). Expected:
      *"This invitation was sent to a different email address."* If A is able
      to accept an invitation addressed to B, the email check in
      `accept_workspace_invitation` is not doing its job.

### Accept

- [ ] Open the link as **B**, signed out. Expected: the preview names the
      workspace and who invited you, then routes through sign-in and returns to
      the invitation rather than dumping you on Today.
- [ ] Accept. B lands in the shared workspace.
- [ ] Reload the invite link and accept again. Expected: *"This invitation has
      already been used"* — an error, not a second membership row.
- [ ] As A, the invitation disappears from the pending list (it filters on
      `accepted_at is null`).

---

## 3. Personal boundary — the part that matters

Both accounts are now in one workspace. **Re-run `rls-assertions.sql`.**

- [ ] Every `boundary` row reads `PASS`. Any `VACUOUS` means you did not create
      that kind of data as A — go back and make some, then re-run. A vacuous
      row proves nothing.
- [ ] Every `sharing` row reads `PASS`. These are the things that are *supposed*
      to cross: the workspace row, A's profile, projects, tasks, and A's
      project-scoped notes. A boundary that blocks everything is broken, not
      safe.

Then confirm the UI agrees with the database, as **B**:

- [ ] Today is empty of A's plan. B sees their own day, not A's.
- [ ] Inbox does not contain A's captures.
- [ ] Brainstorm does not list A's workspace-level note, but **does** list the
      note A wrote inside the project.
- [ ] The project board shows A's tasks — shared work is shared.
- [ ] Settings → Members lists both people, each with a name and initials
      rather than a blank avatar. A blank name means the `profiles` select
      policy is failing even though the member row is visible.

---

## 4. Assignment

- [ ] As A, assign a task to B. B's avatar appears on the card.
- [ ] As B, the task appears under *My tasks*.
- [ ] As B, assign a task to A. Works in both directions.
- [ ] As B, unassign yourself from a task. It stays in the project rather than
      disappearing.

---

## 5. Roles

As **A** (owner), Settings → Members.

- [ ] Change B to `admin`. As B, *Invite people* now works.
- [ ] Change B back to `member`. As B, creating an invitation now fails with
      *"Only owners and admins can invite people"*. **Check this from B's side,
      not A's** — the demotion is meaningless if the RPC still lets B invite.
- [ ] As B (member), the role dropdown and remove button are absent for other
      members. B cannot manage membership from the UI.

### The owner one-way door

`invitableRoles` offers `owner`, but `assignableRoles` is only
`["admin", "member"]`, and the members list hides both the role select and the
remove button for anyone whose role is `owner`.

- [ ] Invite a third address as `owner` and accept it. Now confirm what the
      code implies: **neither owner can demote or remove the other from the
      UI.** The only exit is that owner choosing to leave.

This is a real dead-end, not a bug in your test. Note whether it bothers you —
the fix is either dropping `owner` from `invitableRoles` or adding an explicit
transfer-ownership control. Do not leave it as a surprise.

---

## 6. Removal and leaving

- [ ] As A, remove B. It happens on one click with **no confirmation** — decide
      whether that is acceptable for an action that revokes access.
- [ ] As B, the workspace vanishes from the switcher and B is redirected out of
      it rather than left on a page that 404s its queries.
- [ ] Re-invite B and accept, then as B use *Leave workspace*.
- [ ] As A (the only owner), try *Leave workspace*. Expected: *"A workspace
      needs at least one owner."* If A can leave, the workspace is stranded
      with nobody able to manage or delete it.

---

## 7. Workspace switching

- [ ] As B, the switcher lists B's personal workspace and the shared one, and
      not A's other workspaces.
- [ ] Switching changes the URL to `/w/<id>/…` and the page data changes with
      it. Watch for stale data from the previous workspace — that would mean a
      query key is missing its `workspaceId`.
- [ ] Paste A's *private* workspace URL into B's browser. Expected: B is
      bounced, not shown an empty shell of a workspace they cannot read.
- [ ] Reload deep on `/w/<id>/projects`. The workspace resolves rather than
      redirecting to Today.

---

## Recording the result

For each failure note: what you did, what you expected, what happened, and
which account you were signed in as. A leak found here is a migration fix, and
the migration needs to know exactly which policy let the row through.

If everything passes, say so explicitly somewhere durable — the value of this
pass is that the next change to a policy has a baseline to be checked against.

## What this does not cover

- **Expiry.** The seven-day window cannot be waited out. Test it by setting
  `expires_at` into the past on a pending row and then opening the link.
- **Concurrent edits.** Two people editing one task at the same time is
  untested and unhandled; last write wins.
- **Email delivery.** There is none. Invitations are links you distribute
  yourself, which is worth knowing before you rely on it.
