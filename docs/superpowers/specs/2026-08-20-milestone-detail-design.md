# Milestones become first-class

## The problem

Milestones are the only entity in Orbit Flo with no page of their own. They
appear across the calendar, the dashboard, the project timeline, the maps
inspector and the task modal — always as a label or a row inside something
else, never as a thing you can open.

That absence is why the Obsidian arc deliberately excluded them. The note-links
spec says: *"Milestones are deliberately not link targets (no detail view to
host a backlink panel)."* Every other entity — note, task, project — can be
linked with `[[`, appears in the link graph, and shows what points at it.
Milestones cannot and do not.

## Decisions made without you

You were asleep and had pre-approved this work, so the questions I would
normally have asked are answered below with the reasoning. Each is reversible
and worth a glance.

### The route is flat, not nested under the project

`/w/:workspaceId/milestones/:milestoneId`, not
`/w/:workspaceId/projects/:projectId/milestones/:milestoneId`.

Milestones belong to a project, so nesting is the more honest URL. But an
`orbit:milestone/<uuid>` link carries only the milestone id, and a nested route
needs a project id the link does not have. Resolving one from the other would
mean a lookup before every navigation, or storing a project id inside the link —
which would break the moment a milestone moved.

The flat route makes the link the source of truth. The page still shows and
links to its parent project, so the relationship is visible even though the URL
does not encode it.

### The page is read-only

`milestone-manager.tsx` already owns milestone creation and editing inside the
project workspace. Adding a second editing surface would mean two places to
change one thing, and two places to keep in step.

The page shows the title, description, target date, completion state, the work
items in the milestone, a backlinks panel, and a link to the parent project —
with an **Open in project** action for anyone who arrived wanting to edit. If
in-place editing turns out to be wanted, it is additive later; removing a
duplicated editor would not be.

### Search gains milestones, because otherwise the target is theoretical

`SearchResultType` is `"task" | "note" | "project"`. The `[[` picker draws its
candidates from `searchWorkspace`, so without a fourth kind **no one could ever
create a milestone link by typing** — the target would exist only for links
written by hand.

So this is not optional scope. Milestones join search, which also makes them
reachable from the command palette and gives `type:milestone` meaning as a
search operator, consistent with the three kinds that already work.

## Design

### Schema

`note_links` gains a fourth target column:

```sql
alter table public.note_links add column target_milestone_id uuid;

alter table public.note_links
  add constraint note_links_target_milestone_fkey
  foreign key (target_milestone_id, workspace_id)
  references public.milestones(id, workspace_id) on delete cascade;
```

`milestones` already carries `unique (id, workspace_id)`, so the composite key
works without touching that table.

Two existing guards must widen with it, and both would fail silently if missed:

- the check `num_nonnulls(target_note_id, target_work_item_id, target_project_id) = 1`
  becomes a four-way `num_nonnulls`. Left alone it would reject every milestone
  link, because a row with only `target_milestone_id` set has zero non-nulls
  among the three it counts.
- the unique index on
  `(note_id, coalesce(target_note_id, target_work_item_id, target_project_id))`
  must include the new column. Left alone, every milestone link from one note
  would collapse to the same `null` key and the second would collide.

The four-nullable-columns shape is kept deliberately. The original migration
explains why: *"a polymorphic pair cannot have referential integrity, and
deleting a target must take its inbound links with it rather than leave rows
pointing at nothing."* That reasoning holds for a fourth column as much as the
first three.

### `LinkKind` gains a fourth value

`"note" | "task" | "project"` becomes `"note" | "task" | "project" | "milestone"`.
TypeScript then forces every consumer to handle it — `targetColumnFor`'s map
becomes non-exhaustive, and the compiler says so. That is the intended
mechanism: the type finds the call sites rather than a search.

The ripple is known and bounded: `orbit-link.ts`'s pattern, `targetColumnFor`,
`saveNoteLinks`' insert shape, `linked-text.tsx`'s `orbitHref` regex and
`pathFor`, and `link-graph.ts`.

**`linked-text.tsx`'s `orbitHref` regex feeds two places** — the anchor branch
and the `urlTransform` prop. Widening the one regex fixes both; fixing only the
branch leaves react-markdown stripping the scheme and the link silently
vanishing. That has cost this project a debugging cycle before.

### The link graph gets a fourth column

`buildLinkGraph` lays nodes out in three columns by kind. A fourth kind needs a
fourth column, or milestone nodes land nowhere. The layout stays deterministic —
columns by kind, ordered by degree — which is what keeps the graph from
rearranging itself on every refetch.

### The page

`/w/:workspaceId/milestones/:milestoneId`, lazy-loaded like every other route.

- **Header** — title, target date, and a completion pill using the existing
  `StatusPill` vocabulary.
- **Description** — rendered with `LinkedText`, so a milestone description gets
  the same markdown and links that notes, comments and task descriptions now
  have.
- **Work items** — the tasks whose `milestone_id` is this milestone, each
  linking to the task.
- **Backlinks** — the existing `BacklinksPanel`, which already takes a kind and
  an id and needs only the new kind to work here.
- **Open in project** — a link to the parent project, which is where editing
  lives.

A milestone that does not exist, or that RLS hides, renders the same
"not found" state rather than an error — a member of another workspace should
learn nothing from the difference.

## Files

**Migration** — `supabase/migrations/202608200004_note_links_milestones.sql`

**Create** — `src/features/projects/milestone-page.tsx` and its test;
`src/features/projects/milestone.queries.ts` and its test

**Modify** — `src/features/links/orbit-link.ts`,
`src/features/links/note-links.queries.ts`, `src/features/links/linked-text.tsx`,
`src/features/links/link-graph.ts`, `src/features/links/link-graph.queries.ts`,
`src/features/search/search.queries.ts`, `src/features/search/search-query.ts`,
`src/app/route-loaders.ts`, `src/app/routes.tsx`

## Testing

- **vitest** — `extractOrbitLinks` recognises a milestone link; `targetColumnFor`
  maps the new kind; `buildLinkGraph` places milestones in their own column and
  stays deterministic; `parseSearchQuery` accepts `type:milestone`; the page
  renders a milestone with its tasks and backlinks, and renders not-found for a
  missing id.
- **SQL assertions** — the `note_links` check accepts a milestone-only row and
  still rejects a two-target row, and the unique index permits two different
  milestone links from one note. Both inside rolled-back probes, following the
  harness conventions.
- **e2e** — none. `collaboration.spec.ts` is about the privacy boundary and this
  adds no policy.

## Risks

- **The `num_nonnulls` check and the unique index are the sharp edges.** Both
  fail silently in opposite directions if missed — the check rejects every
  milestone link, the index collapses them into one. The SQL assertions exist
  for exactly these two.
- **Search results are capped at ten per kind.** Adding a fourth kind does not
  change that, but it does mean a workspace with many milestones will see them
  compete for the picker's six visible slots. Acceptable at this size; worth
  revisiting if the picker starts feeling crowded.
- **This adds surface area rather than removing an inconsistency**, which is
  what made it last of the three. Nothing is broken by its absence; the argument
  for it is that milestones being un-linkable is a hole in a system that
  otherwise links everything.
