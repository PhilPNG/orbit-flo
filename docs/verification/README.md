# Privilege and RLS verification

Two files. Different purposes, different cost to run.

- **`grants-assertions.sql`** — hermetic. Reads only system catalogs: no
  accounts, no seed data, no setup. Runs on every pull request (the `guards`
  job in `.github/workflows/ci.yml`) and can be pointed at the live project
  read-only:

  ```
  npx supabase db query --linked -f docs/verification/grants-assertions.sql
  ```

  It ends by raising an exception if any check is not `PASS`, so a failing
  run exits non-zero instead of printing a table you have to read carefully.

- **`rls-assertions.sql`** — the two-account behavioural harness. It needs
  two real signed-in accounts (`auth.users` must already have rows for both —
  sign in with each once first) and its two `REPLACE_WITH_YOUR_EMAIL` /
  `REPLACE_WITH_SECOND_EMAIL` placeholders filled in before it proves
  anything. Run it the same way:

  ```
  npx supabase db query --linked -f docs/verification/rls-assertions.sql
  ```

  See [`two-account-checklist.md`](two-account-checklist.md) for the full
  manual pass this file is part of.

**Running only `grants-assertions.sql` proves nothing about row-level
security.** It checks table- and function-level grants — who is allowed to
touch a table at all — not the RLS policies that decide which *rows* they can
see or write once granted. RLS is only exercised by `rls-assertions.sql`,
with two real accounts.

## Why this exists, and why it's not optional

Supabase's platform default privileges are owned by `supabase_admin`, not
`postgres`, so a migration cannot revoke what it never controls. Concretely:
a newly created table on the hosted platform arrives already granted `ALL`
to `anon` and `authenticated`, and a newly created function arrives already
`EXECUTE`-granted to all three API roles. Nothing in the database objects to
this — it is silent. A migration that creates a table or function is
over-granted the instant it runs unless something explicitly revokes and
re-grants afterward.

This already happened twice, for real, before this file existed:

- **Nine tables** (`board_columns`, `labels`, `project_rituals`,
  `recurrence_rules`, `template_usage`, `work_item_attachments`,
  `work_item_checklist_items`, `work_item_comments`, `work_item_labels`) had
  never been explicitly granted to `authenticated` by any migration —
  hosted only worked because the platform default silently covered the gap.
  Fixed in `202608200007`.
- `preview_workspace_invitation`, the one function meant to be callable
  before sign-in, had never been explicitly granted to `anon` — a prior
  migration merely declined to revoke it, and *not revoked is not granted*.
  On a clean rebuild the invite page would break for exactly the signed-out
  users it exists for. Fixed in `202608200008`.

Both would have shipped invisibly. "It works on hosted" is not evidence a
table's grants are correct — it may only mean the platform default is
carrying it. The recipes below are how you avoid adding a third case.

## Recipe: adding a new table

1. **Revoke `anon`** on the table explicitly. It should hold nothing.
2. **Grant `select, insert, delete` to `authenticated`** explicitly. Do not
   rely on the platform default — see above.
3. **Grant column-level `UPDATE` to `authenticated`** on every column
   *except* `id`, `workspace_id`, `created_by`, `created_at`, `updated_at`.
   Those five are identity/provenance columns and must stay unwritable by a
   normal user; everything else on the table should be editable or the row
   becomes silently frozen.
4. **`service_role` has a known gap** — its grants have the same
   reproducibility problem as the nine tables above and have not yet been
   fixed. Do not assume `service_role` access to a new table works just
   because it worked for an older one.
5. Run `grants-assertions.sql` afterward. `anon holds no privilege on any
   public table`, `authenticated cannot rewrite identity or provenance
   columns`, and `every table still has some updatable column` will catch a
   missed step.

## Recipe: adding a column to an existing table

**A new column inherits no grant at all — from anything.** Table-level grants
apply to columns that existed when the grant was issued; a column added
later is invisible to it. Unless you grant `UPDATE` on the new column to
`authenticated` explicitly, it is silently read-only for every user, forever,
with no error anywhere.

- If the column belongs in the identity/provenance set (rare for a column
  added after the fact), leave it unwritable on purpose.
- Otherwise, grant column-level `UPDATE` to `authenticated` for it in the
  same migration that adds it.
- Run `grants-assertions.sql` afterward — `every table still has some
  updatable column` and `authenticated can edit every non-protected column`
  are what would have caught this.

## When a check fails and you don't know the remedy

Each failing row in `grants-assertions.sql`'s output names *what* is wrong
(which table, which column, which function) but not *why* — that context
lives here. If a check fails and the recipe above doesn't explain it, read
the check's own comment block in `grants-assertions.sql`; each one records
what it protects and why it's shaped the way it is.
