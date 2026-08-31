# Note Links and Backlinks Design

**Date:** 2026-08-10
**Status:** Approved

Obsidian-inspired linking, piece 3 of a six-part decomposition. Pieces 4
(unlinked mentions) and 5 (derived graph) build on this; pieces 1 (real tags),
2 (markdown) and 6 (search operators) are independent.

## Problem

Notes attach to a project or a work item by foreign key, and nothing else links
to anything. A decision recorded once cannot be pointed at the three tasks it
constrains, and standing on a task there is no way to ask what has been written
about it.

Orbit Flo is a project tool, not a wiki, so the Obsidian idea worth importing
is not note-taking aesthetics. It is **"what does this touch?"**

## Decisions

- Typing `[[` is the trigger; the stored form is a markdown link with an app
  URI.
- Links are authored in **note bodies only**, and may target **notes, work
  items, and projects**.
- **Milestones are not targets.** They have no detail view anywhere in the app,
  so a backlink panel would have nowhere to live — you could link to one and
  never see it referenced. Adding them means first giving milestones a detail
  surface, which is its own piece of work.
- Note bodies render as **plain text with links resolved**, not markdown. Full
  markdown remains piece 2.

## The stored form

```
[Polish the release path](orbit:task/8f3c1d2e-...)
```

`[[` only opens the picker. What lands in the body is ordinary markdown with an
`orbit:` URI, which means:

- No custom syntax to parse or maintain, and it is already valid markdown if
  piece 2 ever adds a renderer.
- The id resolves, so renaming a task never breaks a reference.
- The bracket text is a snapshot the author may edit freely; it is a label, not
  the lookup key.

URI grammar: `orbit:<kind>/<uuid>` where kind is `note`, `task`, or `project`.
`task` rather than `work_item` because that is the word the UI uses everywhere.

## The link table

Backlinks must not require scanning every note body, so links are extracted on
save into a table:

```sql
public.note_links (
  id                  uuid primary key,
  workspace_id        uuid not null,
  note_id             uuid not null,          -- the source
  target_note_id      uuid,
  target_work_item_id uuid,
  target_project_id   uuid,
  created_by          uuid,
  created_at, updated_at
)
```

**Four nullable foreign keys with a check that exactly one is set**, rather
than a `(target_type, target_id)` pair. A polymorphic pair cannot have
referential integrity, and this codebase has already spent two PRs removing
orphaned rows and dangling columns. With real foreign keys, deleting a task
removes its inbound links by cascade and nothing is left pointing at nothing.

`notes` currently has only `id` as its primary key, unlike `projects` and
`work_items` which both carry `unique (id, workspace_id)`. The migration adds
that constraint to `notes` so the composite foreign keys can match the house
pattern of scoping every reference by workspace.

Uniqueness is a single expression index rather than a four-column constraint:

```sql
create unique index note_links_unique_target_idx
on public.note_links (note_id, coalesce(target_note_id, target_work_item_id, target_project_id));
```

Exactly one target is non-null, so the coalesce is the target id. This states
"one link per note per target" directly and does not depend on NULL-distinctness
semantics.

## Broken links are kept, not swept

When a target is deleted the link row cascades away, but the `orbit:` markup
stays in the body. It then renders as a visibly broken link.

That is deliberate. Silently rewriting text somebody wrote is worse than
showing them that what they referenced is gone, and it is what Obsidian does.

## Visibility

`note_links` inherits its visibility from the **source note**, not from the
workspace. Notes split by scope — a project note is shared, a workspace note is
private to its author — so a member-only policy would leak that some private
note references a given task.

A security-definer helper mirrors the notes select rule, the same shape as
`private.owns_daily_plan` and `private.shares_workspace_with`:

```sql
private.can_read_note(target_note_id uuid) returns boolean
-- is_workspace_member(workspace_id)
-- and (project_id is not null or created_by = auth.uid())
```

Select and delete policies use it. There is no insert or update policy and no
insert grant is needed beyond the reconciler's, which runs as the note's author.

## Reconciliation

Links are derived from the body whenever a note is written. `saveNoteLinks`
compares the targets parsed out of the body against the rows already stored,
inserts what is new, and deletes what is gone. It runs inside `createNote` and
`updateNote` so no caller can forget it.

Client-side rather than a database trigger: parsing markdown in plpgsql would
be miserable to write and worse to test, and every write already goes through
one queries module.

A reconcile failure does not fail the note write. The note is the user's
content; the links are derived. It surfaces as a non-blocking message rather
than losing what they typed.

## Components

`src/features/links/orbit-link.ts` — pure, and the heart of the feature:

```ts
export type LinkKind = "note" | "task" | "project";
export type OrbitLink = { kind: LinkKind; id: string; label: string };

formatOrbitLink(kind, id, label): string      // "[label](orbit:task/uuid)"
extractOrbitLinks(body: string): OrbitLink[]  // deduped, in document order
splitByOrbitLinks(body: string): Segment[]    // text and link segments, for rendering
```

`link-autocomplete.tsx` — watches a textarea for `[[`, searches notes, tasks
and projects, and on selection replaces the trigger with the formatted link.
The editor stays a plain textarea; there is no rich-text editor.

`linked-text.tsx` — renders a body as text with `orbit:` links resolved to
in-app navigation. It builds React elements and never sets HTML, so there is no
injection surface. An unresolved target renders as a broken link.

`note-links.queries.ts` — `saveNoteLinks`, and `listBacklinks(kind, id)`
returning the notes that reference a thing.

`backlinks-panel.tsx` — a "Linked from" list, mounted on the task detail modal,
the note list, and the project brief.

## Error handling

- A target that no longer exists renders as a broken link and is excluded from
  backlink results, because its row is already gone.
- The autocomplete degrades to a plain textarea if its search fails; typing
  `[[` simply does nothing rather than blocking the field.
- A failed backlinks query renders nothing rather than an error, since backlinks
  are supplementary to whatever screen hosts them.

## Testing

`orbit-link.test.ts` — formatting, extraction of one and many links,
deduplication, ignoring ordinary markdown links and bare `orbit:` text, and
segment splitting for rendering.

`note-links.queries.test.ts` — reconciliation inserts only what is new and
deletes only what is gone; `listBacklinks` filters by the right target column.

`link-autocomplete.test.tsx` — `[[` opens the picker, selection inserts the
formatted link at the trigger, Escape closes it.

`linked-text.test.tsx` — a link renders as a link, an unresolved one renders as
broken, and text that looks like HTML renders as text.

`backlinks-panel.test.tsx` — lists sources, and renders nothing when empty.

RLS is not testable here, as ever: no database in the vitest environment.

## Out of scope

- Markdown rendering beyond links — piece 2.
- Unlinked mentions — piece 4.
- A derived graph view — piece 5.
- Linking from task descriptions, comments, or project briefs.
- Milestones as targets.
- Renaming a target updating the label text in bodies. The label is a snapshot
  by design.
