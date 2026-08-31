# A guard that runs itself

## The problem

Four merged PRs closed four privilege layers:

| PR | What it closed |
|---|---|
| #46 | `anon` could execute security-definer functions |
| #50 | `anon` held table privileges on 33 tables in `public` |
| #52 | the `viewer` role existed and could be assigned |
| #54 | `authenticated` could rewrite identity and provenance columns |

Every one of them is verified by `docs/verification/rls-assertions.sql`, which
someone has to remember to run by hand.

That is not a guard. It is a snapshot, and it is already stale the moment a
migration lands. Worse, the failure it protects against is *silent and
automatic*: Supabase's platform default privileges — owned by `supabase_admin`,
unalterable by `postgres` — grant `ALL` on every newly created `public` table to
`anon` and `authenticated`. A migration that creates a table is over-granted the
instant it runs, and nothing in the database objects. The harness is the only
thing that notices, and only if a human runs it.

CI today runs `vitest` and `npm run build`. Neither touches a database.

## Scope

**This spec covers the hermetic catalog checks only.** Seeding two auth users
and enough fixture data to make the behavioural RLS groups non-vacuous is a
larger project and gets its own spec. See "What this deliberately does not
cover".

## The decision: assert the catalog, in CI, on a real Supabase stack

### Why a plain Postgres container will not do

These checks are *about* the `anon` and `authenticated` roles and about
Supabase's platform default privileges. A vanilla `postgres:17` image has
neither. `has_table_privilege('anon', …)` would raise "role does not exist"; and
if CI papered over that by creating bare roles itself, every check would pass
trivially — a green guard proving nothing, which is the precise failure mode
this harness's `VACUOUS` vocabulary was invented to name.

So the job runs against the Supabase CLI's local stack, which ships the same
roles and the same default privileges as the hosted platform.

**That parity is an assumption, not a fact, until measured.** It is the single
load-bearing premise of this whole design, and the red-proof below exists to
settle it.

### What actually runs

Of the 13 checks currently labelled `grants` in `rls-assertions.sql`, seven are
pure catalog inspection and move to the new file:

| Check | Mechanism | Covers |
|---|---|---|
| `anon` holds no privilege on any public table | `has_table_privilege` over `pg_class` | #50 |
| no security-definer function is anon-callable | `has_function_privilege` over `pg_proc` | #46 |
| `preview_workspace_invitation` stays anon-callable | `has_function_privilege` | #46 (canary) |
| `authenticated` can still read every public table | `has_table_privilege` | #54 (canary) |
| `authenticated` cannot rewrite identity or provenance columns | `has_column_privilege` | #54 |
| `authenticated` can edit every non-protected column | `has_column_privilege` | #54 (inverse) |
| every table still has some updatable column | `has_column_privilege` | #54 (inverse) |

Three of those seven are deliberately **inverse** checks. An over-broad revoke
and a no-op revoke look identical from a green migration, and a no-op revoke is
exactly the bug PR #54 shipped with and caught. Asserting only "the protected
columns are locked" would pass with all 193 content columns silently unwritable.

Five checks stay in `rls-assertions.sql` because they need a workspace, a
project, or fixtures they build themselves: `the last owner cannot be deleted`,
`… membership can be deleted when another owner remains`, `the database refuses
a viewer invitation`, `note_links accepts a milestone-only target`, and `a note
can link two different milestones`. The last two also get relabelled out of the
`grants` group — they exercise a CHECK constraint and a unique index, and were
filed under `grants` by accident.

### One check is replaced rather than moved

`nobody holds the viewer role` counts rows in `workspace_members` and
`workspace_invitations` with `role = 'viewer'`. On a freshly migrated database
that count is zero because the tables are empty, so it would report `PASS` while
proving nothing — a vacuous check wearing a passing verdict.

The hermetic file asserts the mechanism instead: **both role columns carry a
CHECK constraint forbidding `viewer`**, read from `pg_constraint`. That is
stronger than the row count even on a populated database, because it proves the
database will refuse such a row rather than that nobody has happened to write
one. The row-count version stays in the manual harness, where there is real data
to count.

That brings the hermetic file to **eight checks**, covering all four PRs.

## Design

### Two files, no duplication

- `docs/verification/grants-assertions.sql` — hermetic. No accounts, no seed
  data, no `SET ROLE`. Runnable against any migrated database. What CI runs.
- `docs/verification/rls-assertions.sql` — unchanged in purpose: the two-account
  behavioural harness, keeping its `REPLACE_WITH_…` placeholders.

Each check exists in exactly one file. A full manual sweep becomes two commands
instead of one, which is the cost of the split and is worth it: the hermetic
file can now be run anywhere, by anyone, with no setup.

### The exit code lives in the SQL

The harness today prints a verdict table and returns 0 regardless. CI cannot act
on that without parsing text.

Instead, `grants-assertions.sql` ends with two statements:

1. `select * from grant_results order by …` — prints every verdict, failures
   first, so a failing run shows *what* failed in the log.
2. a `do` block that raises an exception when either condition holds:
   - any verdict is not `PASS`
   - fewer than `EXPECTED_CHECKS` rows exist

`psql -v ON_ERROR_STOP=1` turns the raise into exit 1. No wrapper script, no
grep over stdout, and a human running the file through `supabase db query -f`
gets the same hard error rather than a table they have to read carefully.

The second condition is the file-level version of the vacuous trap: a script
that silently executed nothing would otherwise report a clean zero failures. The
threshold is a floor (`>= 8`), not equality, so adding a check does not require
editing the constant — but deleting one fails the build.

### Verdict vocabulary

The existing `PASS` / `FAIL —` / `VACUOUS —` / `SKIP —` vocabulary carries over
unchanged, so both files read alike. In the hermetic file there are no
preconditions that can legitimately be absent, so **only `PASS` is acceptable**;
`VACUOUS` and `SKIP` fail the build exactly as `FAIL` does. Keeping the
vocabulary rather than reducing it to a boolean means a check that *can* go
vacuous still says so instead of silently reporting failure for the wrong
reason.

### The CI job

A second job, `guards`, in `.github/workflows/ci.yml`, parallel to the existing
`verify` job:

1. `actions/checkout@v5`
2. `actions/setup-node@v5` with node 22 and npm cache
3. `npm ci` — the Supabase CLI is already a devDependency (`supabase@^2.113.0`),
   so no separate CLI install step is needed
4. start the local stack's database, excluding the services this job has no use
   for (studio, realtime, storage, edge functions, mail). The CLI's `-x` flag
   takes a comma-separated exclude list; the exact list is pinned during
   implementation by reading `npx supabase start --help` on the pinned version
5. `npx supabase db reset` — applies all 36 migrations explicitly, rather than
   relying on `start` having done so
6. `psql "$LOCAL_DB_URL" -v ON_ERROR_STOP=1 -f docs/verification/grants-assertions.sql`

`psql` is preinstalled on `ubuntu-latest`. The local database URL is the CLI's
fixed local value, not a secret.

Because `guards` runs in parallel with `verify` (~3m30s today), the added
wall-clock cost to a PR is roughly zero even though the job itself takes a few
minutes.

**This job needs no GitHub secrets and never contacts the linked project.** The
behavioural checks write probe rows and impersonate users; running that against
production data on every PR would be wrong regardless of how the credentials
were supplied.

### `supabase/config.toml`

The repo has `supabase/migrations` and nothing else — the project was linked
without ever being initialised for local development. `supabase start` requires
a `config.toml`, so one gets generated by `supabase init` and committed. It
holds ports and feature toggles, no secrets. A side benefit is that local
development against a throwaway database starts working for the first time.

## What the red-proof actually found

**The red-proof came back negative, and everything below "The red-proof" was
written before that was known.** Read this section first; it is what shipped.

**1. The premise was false as designed.** A fresh table on the CLI's local
stack arrives with `Dxtm` only — no SELECT/INSERT/UPDATE/DELETE for any API
role. The deliberately careless scratch table **passed** both checks. Local
Supabase does not apply the hosted platform's default privileges, so the guard
as specced would have been green and worthless forever.

**2. The job never even reached the guard**, and why turned out to matter more.
It died replaying migration `202608200001`, whose self-assertion requires
privileges no migration grants. That exposed the real bug: **this schema is not
reproducible from its own migrations.**

- **Nine tables** — `board_columns`, `labels`, `project_rituals`,
  `recurrence_rules`, `template_usage`, `work_item_attachments`,
  `work_item_checklist_items`, `work_item_comments`, `work_item_labels` — had
  never been granted to `authenticated` by any migration. `202608200007` fixes
  the *end state* — it does not fix the replay by itself, because it sorts
  after `202608200001` and that migration's self-assertion still aborts a
  plain `supabase db reset` before `202608200007` ever runs. The end state is
  only reached today when the platform default privileges are set first,
  which currently happens only inside the `guards` CI job's parity step, not
  locally.
- **`preview_workspace_invitation`**, the one function deliberately callable
  before sign-in, had never been granted to `anon` either. `202608100004`
  granted only `authenticated`; `202608130001` merely declined to revoke
  `anon`. *Not revoked is not granted.* On any rebuild the invite page would be
  broken for exactly the signed-out users it exists for. Fixed by
  `202608200008`. **The CI guard found this one**, which is the first time this
  tooling caught something nobody had gone looking for.

Both migrations are no-ops on hosted and repairs everywhere else. Both are
applied.

**3. Appending a migration did not fix the replay, and that was my error.**
`202608200007` sorts after `202608200001`, so the assertion fires long before
it runs. I reasoned about the end state and not about replay order.

**4. What actually made it work — and restored the original goal.** CI now
starts the stack with migrations hidden, sets the platform's default privileges
itself (`alter default privileges for role postgres grant all on tables` and
`grant execute on functions` to the three API roles), then applies migrations
with `psql` in filename order. Not `supabase db reset`, which recreates the
database and discards those defaults.

That restores parity in both directions: the replay succeeds, **and** a new
over-granted table is detectable again. Re-red-proofed after the change — the
scratch table produced exactly the two predicted failures naming
`scratch_redproof` and `scratch_redproof.id`.

**What is still not covered.** The guard runs against a local database, so it
proves migrations produce the intended end state. Drift on the *hosted* project
— a table over-granted there by platform defaults — is still only visible to a
run against the live project, which remains manual. The `service_role` grants
have the same reproducibility gap as the nine tables and are deliberately left
for a separate change.

## The red-proof

The guard does not ship until it has been watched failing.

1. Add a throwaway migration creating a scratch table with one column.
2. Run the job.
3. **Expect red**, with the failure naming that table under "anon holds no
   privilege on any public table".
4. Delete the migration and confirm green.

This is not routine QA. It is the only way to settle the load-bearing premise
that the local stack reproduces the hosted platform's default privileges. A
guard that cannot go red is indistinguishable from no guard, and this project
has already shipped one no-op privilege statement (#54) that only an end-state
assertion caught.

**If step 3 does not go red**, that is a finding to record, not a hiccup to work
around. It would mean the local stack does not apply platform default privileges
the way the hosted project does. The guard would still verify the end state that
migration `202608200006` explicitly produces — which is most of its value — but
it could not catch a newly created table arriving over-granted. In that case the
spec's claim narrows to what was measured, and the gap is written into the file
header rather than left implied.

## Files

- Create `docs/verification/grants-assertions.sql`
- Create `supabase/config.toml` (generated by `supabase init`)
- Modify `docs/verification/rls-assertions.sql` — remove the seven checks that
  move to the hermetic file, keep the `nobody holds the viewer role` row count
  (it is meaningful here, where there is data to count), relabel the two
  `note_links` probes out of the `grants` group, and point its header at the new
  file
- Modify `.github/workflows/ci.yml` — add the `guards` job

No application code changes. No schema changes. No new dependency.

## Testing

- **The red-proof above** is the primary test, and the only one that validates
  the design's central premise.
- **A green run on unmodified `main`** — all eight checks `PASS`, confirming the
  current schema is actually in the state PRs #46/#50/#52/#54 claim.
- **The floor assertion is red-proofed too**: temporarily lower the check count
  by commenting out a check and confirm the run fails on the count rather than
  passing with seven.
- **No vitest changes.** This job is orthogonal to the unit suite; nothing in
  `src/` moves.

## Risks

- **Local-vs-hosted parity is the whole design.** Mitigated by the red-proof,
  and by writing down the narrowed claim if the proof comes back negative.
- **`supabase start` is heavier than the rest of CI** — Docker image pulls on a
  cold runner. Accepted because the job runs in parallel. If it proves slow
  enough to matter, excluding more services is the first lever.
- **A drifting check count.** The floor catches deletion but not a check that
  silently stops asserting anything. That is what the `VACUOUS` verdict is for,
  and vacuous now fails the build.
- **The manual harness gets shorter but not simpler.** Splitting means a full
  sweep is two commands, and someone could run only the hermetic half and
  believe they had verified the RLS boundaries. Both file headers state plainly
  what they do and do not cover.

## What this deliberately does not cover

- **Seeded behavioural RLS checks.** The isolation, boundary, sharing, writes
  and triggers groups need two real auth users and fixture data shaped per
  check. That is a separate project, and the `VACUOUS` machinery exists because
  getting that data right is the hard part.
- **The e2e suite in CI.** It reads real credentials from `.env.local` and
  creates throwaway accounts against the linked project. Pointing it at a local
  stack is worthwhile and is its own piece of work.
- **New tables being over-granted at creation time.** The guard *detects* this
  after the fact; it does not prevent it. Ending every table-creating migration
  with the revoke remains a habit, not something enforced.
