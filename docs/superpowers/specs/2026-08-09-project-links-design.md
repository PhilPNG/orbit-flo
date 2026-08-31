# Mission Links Design

**Date:** 2026-08-09
**Status:** Approved

## Problem

Two tables from the original scaffold (`202606280001`) have schema, indexes,
triggers, grants, and RLS but no code that touches them.

`subtasks` is a duplicate. `work_item_checklist_items` carries the same columns
— `workspace_id`, `work_item_id`, `title`, `is_done`, `sort_order`,
`created_by` — behind a complete feature: list, create, toggle, delete, and
done/total rollups on the kanban cards. Building on `subtasks` would produce a
second checklist.

`project_links` is a genuine gap. It stores typed links per project
(`repository`, `documentation`, `design`, `deployment`, `issue_tracker`,
`other`) with a label and URL. A project today has exactly one link: the single
`projects.repository_url` column shown on the projects list card.

A third orphan turned up while designing the panel. `project_briefs.links`
(`jsonb not null default '[]'`, added in `202607010002`) is carried by
`ProjectBriefValues` and written back by `saveProjectBrief`, but no UI ever
sets it — `ProjectBriefPanel.updateValue` is typed
`keyof Omit<ProjectBriefValues, "links">`. It is round-tripped and never
edited. Since the links panel lives inside the project brief, leaving it would
put a dead links column directly beside the live links UI.

## Decisions

- Drop `subtasks`.
- Drop `project_briefs.links`, behind a guard that fails the migration if any
  row holds data.
- Build a mission links panel on `project_links`.
- Migrate `projects.repository_url` into `project_links` and drop the column,
  so a project's URLs live in one place.
- Project creation keeps its Repository URL field, writing a link instead of a
  column. The projects list card keeps showing the repository link.

## What already exists server-side

`project_links` needs no schema work. The initial migration provides the table
with a composite FK to `(projects.id, workspace_id)` on cascade delete, the
`set_project_links_updated_at` trigger, a `project_id` index, column-level
grants (`insert(workspace_id, project_id, link_type, label, url, created_by)`,
`update(link_type, label, url)`), and RLS.

Note the RLS asymmetry, inherited and left as is: members may select, insert,
and update links, but **delete is restricted to owner and admin**. In a
personal workspace the user is the owner, so delete works. Changing the policy
is out of scope.

## Migration

`supabase/migrations/202608090002_project_links_and_subtasks.sql`:

1. Backfill — for every project with a non-empty `repository_url`, insert a
   `project_links` row with `link_type = 'repository'`, `label = 'Repository'`,
   the URL, and the project's `created_by`.
2. `alter table public.projects drop column repository_url;` — this also
   removes the column from the `projects` insert and update grants.
3. `drop table public.subtasks;` — this takes its trigger, policies, and grants
   with it.
4. A `do` block that raises when any `project_briefs` row holds a non-empty
   `links` array, then `alter table public.project_briefs drop column links;`.
   No UI ever wrote the column, so every row should be `'[]'`; if that
   assumption is wrong the push fails loudly instead of discarding data.

The user applies it with `npx supabase db push`.

## URL safety

`normalizeRepositoryUrl` already rejects anything whose protocol is not
`http:` or `https:`. That check is what stops a `javascript:` URL becoming a
clickable anchor, and it becomes more important once arbitrary user-supplied
links are rendered, not just one repo URL.

It moves into the links module as `normalizeLinkUrl(value)`, throwing
`Links must start with http:// or https://.`, applied on every link write.
A `safeLinkUrl(value)` helper guards render time — returning `null` rather
than throwing — because rows can arrive from SQL or another client without
passing through the writer. `normalizeRepositoryUrl` and `safeRepositoryUrl`
are deleted.

Anchors render with `target="_blank"` and `rel="noreferrer"`.

## Data layer

New `src/features/projects/project-links.queries.ts`:

```ts
export type ProjectLink = Database["public"]["Tables"]["project_links"]["Row"];
export type LinkType = Database["public"]["Enums"]["link_type"];

export const linkTypes: readonly LinkType[];
export function linkTypeLabel(type: LinkType): string;
export function normalizeLinkUrl(value?: string | null): string;
export function safeLinkUrl(value: string): string | null;

listProjectLinks(client, { workspaceId, projectId }): Promise<ProjectLink[]>
createProjectLink(client, { workspaceId, projectId, userId, linkType, label, url }): Promise<ProjectLink>
updateProjectLink(client, { id, workspaceId, linkType, label, url }): Promise<ProjectLink>
deleteProjectLink(client, { id, workspaceId }): Promise<void>
listRepositoryLinks(client, { workspaceId, projectIds }): Promise<Map<string, string>>
```

`listProjectLinks` orders by `link_type` then `created_at`, giving a stable
order without a `sort_order` column.

`listRepositoryLinks` returns project id to URL for the projects list card,
filtered to `link_type = 'repository'`, taking the first link per project. It
returns an empty map for an empty id list rather than issuing a query.

`normalizeLinkUrl` throws on empty input — a link with no URL is meaningless,
unlike the optional repository field it replaces.

## The panel

`src/features/projects/project-links-panel.tsx`, rendered inside the existing
collapsible project brief so links stay reachable from all eight workspace
tabs.

Each link is one row: a type icon, the label, the URL's hostname, and edit and
delete controls. Icons come from lucide — `GitBranch`, `BookOpen`, `Palette`,
`Cloud`, `CircleDot`, `Link2` — one per `link_type`, in the muted slate the
brief uses for secondary iconography.

The add form is a type select, a label field, and a URL field. **If the label
is left blank it falls back to the type's display name** ("Repository",
"Documentation", "Design", "Deployment", "Issue tracker", "Other"), since
`label` is `not null`. Editing reuses the same three fields inline on the row.

With no links, a single quiet line: *No links yet. Add the repository, docs, or
deployment.*

## Create flow

`CreateProjectInput` keeps `repositoryUrl`. `createProject` changes shape:

1. If a URL was given, normalize it before any write, so a malformed URL fails
   without creating a project. This preserves today's ordering. An absent or
   blank URL is still valid — the field is optional — and simply skips step 3.
2. Insert the project.
3. If a URL was given, insert the `repository` link.

If step 3 fails after step 2 succeeded, `createProject` returns the project and
reports the link failure separately rather than throwing. Throwing would leave
the user with a created project and an error that invites a retry, and the
retry would create a second project. The return type becomes
`{ project, linkError: string | null }`, and `ProjectsPage` surfaces
`linkError` as an inline alert reading *Project created, but the repository
link could not be saved.*

## Projects list card

`ProjectsPage` gains one query over the listed project ids, calling
`listRepositoryLinks`. The card renders exactly as it does today, reading from
that map instead of `project.repository_url`. The query is keyed on the project
ids so it refetches when the list changes.

## Types and fixtures

`database.types.ts` is hand-maintained. It loses the `subtasks` table block,
`repository_url` from the projects `Row`/`Insert`/`Update`, and `links` from
the `project_briefs` `Row`/`Insert`/`Update`.

`ProjectBriefValues` loses its `links` field, `valuesFromBrief` stops reading
it, and `saveProjectBrief` stops writing it. The existing panel test
*"preserves existing links when background updates arrive before saving edits"*
covers the `isDirty` guard using `links` as its payload; it is rewritten to
assert the same guard on `goal` so the behaviour stays covered.

Removing `repository_url` from `Row` breaks every fixture that sets it, which
must be updated in the same change:

- `src/dev/orbit-flo-visual-fixtures.ts`
- `src/features/calendar/calendar-page.test.tsx`
- `src/features/inbox/inbox-page.test.tsx`
- `src/features/projects/project-health.test.ts`
- `src/features/projects/projects-page.test.tsx`
- `src/features/projects/project-workspace-page.test.tsx`
- `src/features/daily/daily-mission-control-page.test.tsx`

## Error handling

- Link write failures inside the panel surface as an inline alert on the panel
  and leave the form populated so the user can retry without retyping.
- `normalizeLinkUrl` rejections surface as the thrown message next to the URL
  field; nothing is written.
- A delete refused by RLS surfaces the Supabase message. This only happens for
  a non-owner member, which cannot occur in a personal workspace today.
- `listRepositoryLinks` failing degrades the card to no link rather than
  failing the projects list.

## Testing

`project-links.queries.test.ts`:

- `normalizeLinkUrl` accepts `http:` and `https:`, and rejects `javascript:`,
  `ftp:`, empty input, and unparseable garbage.
- `safeLinkUrl` returns `null` instead of throwing for the same bad input.
- `createProjectLink` sends the normalized URL and the given type and label.
- `listProjectLinks` filters by workspace and project and orders by type.
- `listRepositoryLinks` maps project id to URL, keeps the first per project,
  and issues no query for an empty id list.

`project-links-panel.test.tsx`:

- Renders existing links with hostname and type icon.
- Adding a link with a blank label saves the type's display name.
- A `javascript:` URL surfaces the error and writes nothing.
- Delete removes the row.
- Anchors carry `rel="noreferrer"` and `target="_blank"`.

`projects.queries.test.ts`:

- `createProject` normalizes before inserting, so a bad URL creates no project.
- A successful create with a URL writes the project then the link.
- A link failure returns the project with `linkError` set rather than throwing.

`projects-page.test.tsx`: the existing repository-link assertion re-pointed at
the links query.

## Out of scope

- Reordering links. There is no `sort_order` column, and adding one for what
  is typically three or four rows is not worth the migration.
- Relaxing the owner/admin delete policy.
- Link previews, favicons, or reachability checks.
