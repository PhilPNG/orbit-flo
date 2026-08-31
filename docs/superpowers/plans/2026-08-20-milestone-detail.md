# Milestones First-Class Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give milestones a page of their own, so they can be `[[` link targets, appear in the link graph, and show what points at them.

**Architecture:** `note_links` gains a fourth target column and `LinkKind` a fourth value, which makes the compiler enumerate every consumer. Search gains milestones so the `[[` picker can find one. A flat, lazy route at `/w/:workspaceId/milestones/:milestoneId` renders a read-only page with a backlinks panel.

**Tech Stack:** Postgres 15 + Supabase, React 19, TypeScript, TanStack Query v5, Vitest + Testing Library.

## Global Constraints

- Run tests with `npm test -- --maxWorkers=2`.
- End every commit message with: `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`
- The route MUST be lazy via `src/app/route-loaders.ts`. A non-lazy route pulls the real Supabase client into `App.test.tsx`, which throws without env vars — green locally, red in CI. `App.test.tsx` also mocks `./route-loaders` wholesale, so a new loader needs a stub there too.
- The page is **read-only**. `milestone-manager.tsx` owns milestone editing; do not add a second editor.
- Migrations are applied with `npx supabase db push --yes`, which the implementer MAY run for this project.

---

## File Structure

**Create:** `supabase/migrations/202608200004_note_links_milestones.sql`, `src/features/projects/milestone.queries.ts` (+ test), `src/features/projects/milestone-page.tsx` (+ test).

**Modify:** `src/features/links/orbit-link.ts`, `note-links.queries.ts`, `linked-text.tsx`, `link-graph.ts`, `link-graph.queries.ts`, `src/features/search/search.queries.ts`, `search-query.ts`, `src/app/route-loaders.ts`, `src/app/routes.tsx`, `src/app/App.test.tsx`, `docs/verification/rls-assertions.sql`.

## Facts you will need

- `LinkKind` is declared at `src/features/links/orbit-link.ts:1` alongside a `linkKinds` array and an `orbitLinkPattern` regex that names the kinds explicitly. All three must widen together.
- `targetColumns` in `note-links.queries.ts:12` is a plain object map keyed by `LinkKind`. Widening the type makes it non-exhaustive and the compiler will say so.
- `linked-text.tsx` has ONE regex, `orbitHref`, used by both the anchor branch and the `urlTransform` prop. Widening it fixes both; fixing only the branch leaves react-markdown stripping the scheme so the link renders with no href and silently disappears.
- `link-graph.ts:21` is `const columnOrder: LinkKind[] = ["project", "note", "task"];`.
- `SearchResultType` is `"task" | "note" | "project"` at `search.queries.ts:7`. `searchWorkspace` runs one query per kind, each `.limit(10)`.
- `BacklinksPanel` takes `{ kind: LinkKind; id: string }` and needs no change beyond the widened type.
- `milestones` columns: `id, workspace_id, project_id, title, description, target_date, completed_at, sort_order, created_by, created_at, updated_at`, with `unique (id, workspace_id)`.

---

## Task 1: Migration

**Files:** Create `supabase/migrations/202608200004_note_links_milestones.sql`

**Interfaces:** Produces the column `note_links.target_milestone_id`.

- [ ] **Step 1: Write the migration**

```sql
-- Milestones were left out of the link system because they had no page to host
-- a backlink panel. They are getting one, so note_links gains a fourth target.
--
-- The four-nullable-columns shape is kept deliberately. From the original
-- migration: "a polymorphic pair cannot have referential integrity, and
-- deleting a target must take its inbound links with it rather than leave rows
-- pointing at nothing." That holds for a fourth column as much as the first
-- three.

alter table public.note_links add column target_milestone_id uuid;

alter table public.note_links
  add constraint note_links_target_milestone_fkey
  foreign key (target_milestone_id, workspace_id)
  references public.milestones(id, workspace_id) on delete cascade;

-- Both existing guards must widen with it, and each fails silently in its own
-- direction if missed.
--
-- The check counts non-nulls among three columns. A milestone-only row has zero
-- of those three, so the old check would reject every milestone link.
alter table public.note_links drop constraint note_links_one_target;

alter table public.note_links
  add constraint note_links_one_target check (
    num_nonnulls(target_note_id, target_work_item_id, target_project_id, target_milestone_id) = 1
  );

-- The unique index keys on a coalesce of the target columns. Without the new
-- column every milestone link from one note coalesces to the same null and the
-- second collides with the first.
drop index note_links_unique_target_idx;

create unique index note_links_unique_target_idx
on public.note_links (
  note_id,
  coalesce(target_note_id, target_work_item_id, target_project_id, target_milestone_id)
);

-- Assert rather than assume. A constraint that failed to widen would only
-- surface the first time somebody linked a milestone.
do $$
declare
  check_src text;
  index_src text;
begin
  select pg_get_constraintdef(oid) into check_src
  from pg_constraint
  where conname = 'note_links_one_target'
    and conrelid = 'public.note_links'::regclass;

  if check_src is null or check_src not like '%target_milestone_id%' then
    raise exception 'note_links_one_target does not count target_milestone_id: %', check_src;
  end if;

  select indexdef into index_src
  from pg_indexes
  where schemaname = 'public' and indexname = 'note_links_unique_target_idx';

  if index_src is null or index_src not like '%target_milestone_id%' then
    raise exception 'note_links_unique_target_idx does not include target_milestone_id: %', index_src;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'note_links_target_milestone_fkey'
      and conrelid = 'public.note_links'::regclass
  ) then
    raise exception 'the milestone foreign key was not created';
  end if;
end
$$;
```

- [ ] **Step 2: Apply it**

Run in the foreground: `npx supabase db push --yes`
Expected: `Finished supabase db push.`

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/202608200004_note_links_milestones.sql
git commit -m "feat: let note_links target a milestone"
```

---

## Task 2: LinkKind gains milestone

**Files:** Modify `src/features/links/orbit-link.ts`, `note-links.queries.ts`, `linked-text.tsx`, `link-graph.ts`, `link-graph.queries.ts`; tests `orbit-link.test.ts`, `link-graph.test.ts`, `linked-text.test.tsx`

**Interfaces:** Produces `LinkKind` including `"milestone"`, and `targetColumnFor("milestone") === "target_milestone_id"`.

- [ ] **Step 1: Write the failing tests**

Add to `src/features/links/orbit-link.test.ts`:

```ts
  it("extracts a milestone link", () => {
    const links = extractOrbitLinks(
      "ships at [Beta](orbit:milestone/11111111-1111-1111-1111-111111111111)",
    );
    expect(links).toEqual([
      { kind: "milestone", id: "11111111-1111-1111-1111-111111111111", label: "Beta" },
    ]);
  });
```

Add to `src/features/links/link-graph.test.ts`:

```ts
  it("gives milestones their own column", () => {
    const graph = buildLinkGraph(
      [{ noteId: "n1", targetKind: "milestone", targetId: "m1" }],
      {
        note: new Map([["n1", "A note"]]),
        task: new Map(),
        project: new Map(),
        milestone: new Map([["m1", "Beta"]]),
      },
    );

    const milestone = graph.nodes.find((node) => node.kind === "milestone");
    const note = graph.nodes.find((node) => node.kind === "note");

    expect(milestone?.label).toBe("Beta");
    // Distinct columns keep the layout readable and deterministic.
    expect(milestone?.position.x).not.toBe(note?.position.x);
  });
```

Add to `src/features/links/linked-text.test.tsx`, inside the existing describe:

```tsx
  it("renders a milestone link", () => {
    // orbitHref feeds both the anchor branch and urlTransform. If only the
    // branch were widened, react-markdown would strip the scheme and the link
    // would vanish with no href at all.
    renderBody("[Beta](orbit:milestone/11111111-1111-1111-1111-111111111111)");
    expect(screen.getByRole("link", { name: "Beta" })).toBeInTheDocument();
  });
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npm test -- --maxWorkers=2 orbit-link link-graph linked-text`
Expected: FAIL — the pattern does not match `milestone`, `GraphTitles` has no
`milestone` map, and the link renders as plain text.

- [ ] **Step 3: Widen the type and the pattern**

In `src/features/links/orbit-link.ts`:

```ts
export type LinkKind = "note" | "task" | "project" | "milestone";
```

```ts
const linkKinds: readonly LinkKind[] = ["note", "task", "project", "milestone"];
```

```ts
const orbitLinkPattern =
  /\[([^\]]*)\]\(orbit:(note|task|project|milestone)\/([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})\)/g;
```

- [ ] **Step 4: Follow the compiler**

`npm run build` now reports every consumer that does not handle the new kind.
Fix each:

In `note-links.queries.ts`, extend the map:

```ts
const targetColumns = {
  note: "target_note_id",
  task: "target_work_item_id",
  project: "target_project_id",
  milestone: "target_milestone_id",
} as const;
```

and add the column to `saveNoteLinks`' insert and to `targetKeyOf`, matching how
the other three are handled there.

In `linked-text.tsx`, widen the single regex:

```ts
const orbitHref = /^orbit:(note|task|project|user|milestone)\/([0-9a-fA-F-]{36})$/;
```

and add a case to `pathFor`:

```ts
  if (kind === "milestone") return workspacePath(workspaceId, `/milestones/${id}`);
```

In `link-graph.ts`:

```ts
const columnOrder: LinkKind[] = ["project", "milestone", "note", "task"];
```

and add `milestone: new Map()` wherever `GraphTitles` is constructed.

In `link-graph.queries.ts`, add a `milestoneIds` set, select `target_milestone_id`,
fetch `milestones` titles by id alongside the other three, and populate
`titles.milestone`. Follow the existing shape exactly — the file deliberately
fetches titles by id rather than embedding, because `note_links` references some
tables more than once and naming auto-generated composite constraints is fragile.

- [ ] **Step 5: Run the tests**

Run: `npm test -- --maxWorkers=2 orbit-link link-graph linked-text note-links`
Expected: PASS.

- [ ] **Step 6: Full suite and build, then commit**

```bash
npm test -- --maxWorkers=2 && npm run build
git add src/features/links/
git commit -m "feat: make milestones a link kind"
```

---

## Task 3: Search finds milestones

**Files:** Modify `src/features/search/search.queries.ts`, `search-query.ts`; tests `search.queries.test.ts`, `search-query.test.ts`

**Interfaces:** Produces `SearchResultType` including `"milestone"`.

Without this the `[[` picker can never surface a milestone, so the link target
would exist only for links written by hand.

- [ ] **Step 1: Write the failing tests**

Add to `src/features/search/search-query.test.ts`:

```ts
  it("accepts type:milestone", () => {
    expect(parseSearchQuery("type:milestone beta").types).toContain("milestone");
  });
```

Add to `src/features/search/search.queries.test.ts` a case mirroring the
existing per-kind cases, asserting a milestone row is returned as
`{ type: "milestone", title: <its title> }`. Follow the mocking style already in
that file rather than inventing one.

- [ ] **Step 2: Run them and watch them fail**

Run: `npm test -- --maxWorkers=2 search`
Expected: FAIL — `"milestone"` is not a `SearchResultType`.

- [ ] **Step 3: Implement**

In `search.queries.ts`:

```ts
export type SearchResultType = "task" | "note" | "project" | "milestone";
```

Add a fourth branch to `searchWorkspace` querying `milestones` for
`id, title, project_id`, filtered with the same ILIKE-escaped term and
`.limit(10)` the other kinds use, mapped to `{ type: "milestone", id, title }`.
Gate it behind the same `wants("milestone")` check the others use.

In `search-query.ts`, add `"milestone"` to the recognised `type:` values.

- [ ] **Step 4: Run the tests, then the suite and build, then commit**

```bash
npm test -- --maxWorkers=2 search && npm test -- --maxWorkers=2 && npm run build
git add src/features/search/
git commit -m "feat: find milestones in search"
```

---

## Task 4: The milestone page

**Files:** Create `src/features/projects/milestone.queries.ts` (+ test) and `src/features/projects/milestone-page.tsx` (+ test); modify `src/app/route-loaders.ts`, `src/app/routes.tsx`, `src/app/App.test.tsx`

**Interfaces:**
- Consumes `BacklinksPanel` from `../links/backlinks-panel`, `LinkedText` from `../links/linked-text`.
- Produces `loadMilestonePage` and the route `/w/:workspaceId/milestones/:milestoneId`.

- [ ] **Step 1: Write the query module**

`src/features/projects/milestone.queries.ts`:

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../lib/supabase/database.types";

type Client = SupabaseClient<Database>;

export type MilestoneDetail = {
  id: string;
  projectId: string;
  projectName: string | null;
  title: string;
  description: string;
  targetDate: string | null;
  completedAt: string | null;
  tasks: Array<{ id: string; title: string }>;
};

export const milestoneQueryKey = (workspaceId: string, milestoneId: string) =>
  ["milestone", workspaceId, milestoneId] as const;

/**
 * Returns null rather than throwing when the milestone is absent OR hidden by
 * RLS. A member of another workspace must not be able to tell those apart.
 */
export async function loadMilestone(
  client: Client,
  input: { workspaceId: string; milestoneId: string },
): Promise<MilestoneDetail | null> {
  const { data, error } = await client
    .from("milestones")
    .select("id, project_id, title, description, target_date, completed_at")
    .eq("workspace_id", input.workspaceId)
    .eq("id", input.milestoneId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const row = data as {
    id: string;
    project_id: string;
    title: string;
    description: string | null;
    target_date: string | null;
    completed_at: string | null;
  };

  // Two by-id reads rather than embeds: note_links already proved that naming
  // auto-generated composite constraints is fragile, and these are cheap.
  const [project, tasks] = await Promise.all([
    client.from("projects").select("name").eq("id", row.project_id).maybeSingle(),
    client
      .from("work_items")
      .select("id, title")
      .eq("workspace_id", input.workspaceId)
      .eq("milestone_id", row.id)
      .order("sort_order", { ascending: true }),
  ]);

  if (project.error) throw project.error;
  if (tasks.error) throw tasks.error;

  return {
    id: row.id,
    projectId: row.project_id,
    projectName: (project.data as { name: string } | null)?.name ?? null,
    title: row.title,
    description: row.description ?? "",
    targetDate: row.target_date,
    completedAt: row.completed_at,
    tasks: (tasks.data ?? []) as Array<{ id: string; title: string }>,
  };
}
```

- [ ] **Step 2: Write the page test**

`src/features/projects/milestone-page.test.tsx`: mock `../../lib/supabase/client`,
`../workspaces/workspace-context` (`useWorkspaceId: () => "workspace-1"`) and
`./milestone.queries`, render inside `QueryClientProvider` and `MemoryRouter`
with an initial entry of `/w/workspace-1/milestones/m1`, and assert:

- the title and a task title both render
- a description containing `**bold**` renders as markdown, not raw
- `loadMilestone` resolving `null` renders a not-found state and no title

Follow the harness style in `src/features/signals/signals-page.test.tsx`.

- [ ] **Step 3: Write the page**

`src/features/projects/milestone-page.tsx` renders, inside the app shell
conventions used by other pages:

- `PageHeader` with the milestone title, the target date, and a completion pill
- the description via `<LinkedText body={milestone.description} />`
- the task list, each linking to `workspacePath(workspaceId, `/projects?task=${task.id}`)`
- `<BacklinksPanel id={milestone.id} kind="milestone" />`
- an **Open in project** link to `workspacePath(workspaceId, `/projects/${milestone.projectId}`)`
- an `EmptyState` titled "Milestone not found" when `loadMilestone` returns null

Read `src/features/signals/signals-page.tsx` for the page conventions and
`src/components/minimal-layout.tsx` for the real `PageHeader` props before
using them.

- [ ] **Step 4: Register the lazy route**

In `src/app/route-loaders.ts`:

```ts
export const loadMilestonePage = () =>
  import("../features/projects/milestone-page").then((m) => ({ default: m.MilestonePage }));
```

In `src/app/routes.tsx`, add `const MilestonePage = lazy(loadMilestonePage);` and
the child route inside the `/w/:workspaceId` block:

```tsx
<Route element={<MilestonePage />} path="milestones/:milestoneId" />
```

**`App.test.tsx` mocks `./route-loaders` wholesale.** Add a `loadMilestonePage`
stub there matching the shape of the others, or `lazy()` resolves to `undefined`
and throws at import time.

- [ ] **Step 5: Run tests, CI-parity check, build**

```bash
npm test -- --maxWorkers=2 milestone-page
npm test -- --maxWorkers=2
npm run build
```

Then rename `.env.local` aside and run `npm test -- --maxWorkers=2 App.test`,
restoring it afterwards. That reproduces CI, where no Supabase env vars exist.

- [ ] **Step 6: Commit**

```bash
git add src/features/projects/ src/app/
git commit -m "feat: add a milestone detail page"
```

---

## Task 5: SQL assertions

**Files:** Modify `docs/verification/rls-assertions.sql`

- [ ] **Step 1: Add two checks to the `grants` group**

Follow the file's conventions exactly: results into
`rls_results (check_group, subject, expected, actual, verdict)`, vocabulary
`PASS` / `FAIL — …` / `VACUOUS — …` / `SKIP — …`, every write rolled back via
`raise exception using errcode = 'ORB01'` caught by `when sqlstate 'ORB01'`,
and the `rls_results` inserts OUTSIDE the probe block.

- **the check accepts a milestone-only link** — insert a `note_links` row with
  only `target_milestone_id` set, using a real note and a real milestone in the
  same workspace. Accepted is PASS; a `check_violation` is
  `FAIL — the one-target check does not count milestones`; any other error is
  `VACUOUS` with `sqlerrm` in the actual column, since a foreign key rejecting it
  proves nothing about the check.
- **two milestone links from one note do not collide** — insert two rows from
  the same note to two different milestones. Both accepted is PASS; a
  `unique_violation` is `FAIL — the unique index still coalesces milestones to
  null`; anything else is `VACUOUS`.

If no workspace has a note and two milestones, report `SKIP` naming that rather
than `PASS` — a check that could not run has proven nothing.

- [ ] **Step 2: Run the harness**

Make a filled copy in the scratch directory replacing `REPLACE_WITH_YOUR_EMAIL`
with `philiprrodriguez@gmail.com` and `REPLACE_WITH_SECOND_EMAIL` with
`me@user.com` — do NOT commit real addresses. Run:

```bash
npx supabase db query --workdir "C:\src\Personal\ToDo\.worktrees\project-command-center" --linked -f <filled copy>
```

Truncate the copy before the `-- Summary line.` block to see per-check detail.

**Both checks must return PASS.** A `SKIP` means the fixture data was missing —
create a milestone and a note in a workspace and re-run rather than accepting it.

Then confirm nothing leaked:
`npx supabase db query --linked "select count(*) as links from public.note_links;"`
before and after must match.

- [ ] **Step 3: Commit**

```bash
git add docs/verification/rls-assertions.sql
git commit -m "test: assert note_links accepts milestone targets"
```

---

## Self-review notes

**Spec coverage.** Fourth target column, widened check, widened index → Task 1.
`LinkKind` and every consumer → Task 2. Search → Task 3. Route, page, backlinks
panel, read-only, not-found → Task 4. SQL assertions → Task 5. The flat route is
Task 4 step 4; the read-only decision is enforced by the page containing no
mutation.

**The compiler is the enumeration mechanism.** Task 2 step 4 deliberately says
"follow the compiler" rather than listing every site: widening `LinkKind` makes
`targetColumns` non-exhaustive and TypeScript names the call sites more reliably
than this plan could.

**Not covered.** No e2e — this adds no policy, and `collaboration.spec.ts` is
about the privacy boundary. The link graph's fourth column changes layout for
existing graphs; that is intended and covered by the determinism test.
