# Narrowing what `authenticated` may rewrite

## The gap

Every table in `public` grants table-wide `UPDATE` to `authenticated`, courtesy
of Supabase's platform default privileges. RLS decides which **rows** a signed-in
user may touch. Nothing decides which **columns**.

So a member who may legitimately update a row may also rewrite that row's
identity and provenance: its `id`, its `workspace_id`, who created it, and when.
Across 34 tables that is roughly 156 columns — 33 `id`, 32 `workspace_id`,
27 `created_by`, 64 timestamps.

This is the third layer of the same story. PR #50 found 33 tables granting
everything to `anon` and revoked it. PR #53 found a column-scoped grant on
`note_links` that restricted nothing, because a table-wide grant sat underneath
it. This is the table-wide grant underneath.

## What this is worth, stated plainly

**It is integrity and defence-in-depth. It does not close a live escalation.**

I traced the attacks before writing this:

- Rewriting `created_by` is authorship forgery, not access escalation. Every
  policy that gates *access* on `created_by` — `captures`, `daily_plans`,
  workspace-level `notes` — also requires `created_by = (select auth.uid())` in
  its `USING`, so you can only rewrite rows you already own. The one place a
  member can update someone else's row is a project-scoped note, which is shared
  team knowledge by design; forging its author is dishonest, not privileged.
- Rewriting `workspace_id` is bounded by the `WITH CHECK`, which requires
  membership of the destination. You can move your own content between your own
  workspaces.
- `workspace_members.role` is already gated on the owner role, so no
  self-promotion exists here.

What the change does buy: the database stops permitting a class of write the
application never performs. A future policy written slightly too loosely can
then not be compounded by column rewriting, and provenance becomes something
the schema enforces rather than something the client is trusted not to touch.

That is a smaller claim than "closes a hole", and it is the accurate one.

## The assumption this rests on, measured

A `BEFORE UPDATE` trigger sets `updated_at` on most of these tables. If column
privileges applied to what a trigger assigns, revoking `update(updated_at)`
would break **every update in the application**.

They do not. Verified against the live database: with
`update(updated_at)` revoked on `public.notes`, an `authenticated` session
successfully ran `update notes set title = title`, and the grant was then
restored. Column privileges are checked against the statement's `SET` list, not
against a trigger's assignment to `NEW`.

This was probed rather than reasoned because it is the single assumption that
would take the whole application down if wrong.

## Design

### What is revoked

**This is not what shipped.** The paragraph below is the original draft —
`revoke update(col) ... from authenticated` — and the migration's own
deviation comment at the top of
`supabase/migrations/202608200006_authenticated_column_grants.sql` explains
why it had to change: a column-level revoke removes only a column-level ACL
entry, and every table here except `public.signals` held its `UPDATE` grant
at the table level instead, so the column-level revoke was a no-op that the
assertion caught on the first push. What actually shipped, for every table
where `authenticated` holds table-wide `UPDATE` and that has at least one of
the five protected columns: **revoke the table-wide `UPDATE` outright, then
grant column-level `UPDATE` back for every column except the five
identity/provenance ones.** Read the migration's deviation comment for the
full account; it is not restated here.

Original draft, kept for history: `UPDATE` on these column names, wherever
they appear on a base table in `public` — `id`, `workspace_id`, `created_by`,
`created_at`, `updated_at`. Both the original and the shipped version loop
over `information_schema.columns` rather than listing ~156 columns by hand —
a transcription error across that many names is close to certain; a loop
cannot make one.

### What is deliberately untouched

- **SELECT** — narrowing reads is a per-table audit with real breakage risk, and
  RLS already governs which rows come back.
- **INSERT** — rows are created *by* setting `workspace_id` and `created_by`.
  Revoking those would prevent every insert. Inserts are gated by `WITH CHECK`.
- **DELETE** — has no column dimension.
- **Content columns** — titles, bodies, statuses, dates, assignees. These are
  what the client legitimately edits.

### Verification is two-directional

An over-broad revoke and a no-op revoke look identical from a green migration,
so the assertion checks both:

- none of the five column classes is updatable by `authenticated` on any public
  table
- `notes.title` **is** still updatable, as a canary for the revoke having
  overreached

A revoke of a privilege the role does not hold is a silent no-op, so asserting
the end state is the only way to know it did anything.

That line reads, in hindsight, as foreshadowing the exact bug this migration
shipped with — a column-level revoke that was a no-op against a table-wide
grant. It did not prevent the bug; the migration's own in-place assertion
did, by refusing to leave the push green when it found the columns still
writable. The reasoning was right and still not sufficient on its own —
worth stating plainly, since the temptation is to read a correct diagnosis as
protection.

### Drift detection

**This section originally described one check; four shipped, in the `grants`
group of `docs/verification/rls-assertions.sql`.** One check with a `count(*)
> 0` threshold cannot stand in for a re-grant spanning 33 tables and roughly
200 columns — it would still read PASS with the vast majority of them
silently broken. In order: (1) none of the five protected columns is
UPDATE-writable by `authenticated` on any public base table; (2) the inverse
of (1) — every *non*-protected column IS writable, `public.signals` excluded
by name — added after the final review found the original (2) asserting only
`count(*) > 0`, which would pass with 192 of ~193 columns silently
unwritable, and would not catch a column added to an existing table later
inheriting no grant at all; (3) no public table has zero updatable columns,
so one wounded table can't hide behind the other 32's healthy columns. All
three (and the migration's own loop) cover partitioned tables (`relkind in
('r', 'p')`), not just ordinary ones, since a partitioned table would
otherwise arrive with platform-default table-wide `UPDATE` and go unseen by
`relkind = 'r'` alone.

Supabase's platform defaults will grant a **new table** everything on
creation, exactly as they did for `anon`, and `postgres` cannot change those
defaults — verified when that was attempted for `anon`. So new tables will
arrive over-granted and nothing in the database will object. The harness is
what notices — see also the Risks section below for the parallel gap on
columns added to *existing* tables.

## Files

- Create `supabase/migrations/202608200006_authenticated_column_grants.sql`
- Modify `docs/verification/rls-assertions.sql`

No application code changes. The client never writes any of these five columns
on update — verified by grepping every `.update({ … })` payload in `src`, which
returned zero occurrences of all five.

## Testing

- **The migration asserts its own effect**, in both directions, and fails the
  push rather than silently changing nothing.
- **The harness** gains the drift check and must report `PASS`.
- **The collaboration e2e is the regression net.** It performs real writes as a
  real signed-in user — creating a project, a task, a note and a capture, then
  updating a work item's assignee — against the live database. If this revoke
  overreaches, those tests fail. They are the reason no separate integration
  test is needed.

## Risks

- **The blast radius is every signed-in write.** That is why the canary
  assertion exists, why the e2e is run before merge rather than after, and why
  the change is scoped to five column names instead of an attempt to
  enumerate what each table legitimately exposes.
- **A future feature that legitimately moves a row between workspaces** would
  need `update(workspace_id)` granted back on that table. Nothing does this
  today. The failure mode is a clear permission error at development time, not
  a silent one in production.
- **New tables arrive over-granted**, and only the harness notices. Ending any
  table-creating migration with the same revoke is the habit that avoids
  relying on someone running it.
- **A column added to an existing table inherits no grant at all**, protected
  or not — `alter table … add column` grants nothing, and the platform
  defaults that over-grant a new table don't apply to a new column on a table
  that already exists. Any migration that adds a column to an existing table
  must also `grant update(<column>) on <table> to authenticated`, or that
  column is silently read-only for every user. The "authenticated can edit
  every non-protected column" inverse check in `docs/verification/rls-assertions.sql`
  is what catches it.
