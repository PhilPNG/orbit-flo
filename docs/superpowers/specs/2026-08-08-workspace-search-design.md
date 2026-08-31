# Workspace Search (Ctrl+K)

**Date:** 2026-08-08 · **Branch:** `codex/workspace-search` · **Status:** Approved

## Problem

The command palette filters a hardcoded list of seven nav destinations. It cannot find a task, a note, or a project. With work items, notes, maps, meetings and milestones accumulating, the only way to find something is to remember which project it lives in and click through. Notes are the worst case: Brainstorm is a flat workspace-wide list with no per-project grouping.

## Scope

Searchable: `work_items`, `notes`, `projects`. The existing nav commands stay and still match first.

Matching: case-insensitive substring across title and body, with title matches ranked above body matches. No migration, no schema change.

| Type | Title field | Body field | Destination |
| --- | --- | --- | --- |
| Task | `work_items.title` | `work_items.description` | `/projects/{project_id}?task={id}` |
| Note | `notes.title` | `notes.body` | `/notes?note={id}` |
| Project | `projects.name` | `projects.description` | `/projects/{id}` |

## Architecture

### `src/features/search/search.queries.ts`

```ts
export type SearchResultType = "task" | "note" | "project";

export interface SearchResult {
  id: string;
  type: SearchResultType;
  title: string;
  subtitle: string | null;   // project name for tasks, note type for notes, status for projects
  to: string;                // destination path, already built
  matchedTitle: boolean;     // drives ranking
  updatedAt: string;
}

export function escapeSearchTerm(term: string): string;
export function rankSearchResults(results: SearchResult[]): SearchResult[];
export async function searchWorkspace(
  client: Client,
  workspaceId: string,
  term: string,
): Promise<SearchResult[]>;
```

`searchWorkspace` runs the three queries with `Promise.all`, each scoped by `workspace_id`. Each query orders by `updated_at` descending and takes `.limit(10)`; ranking then runs in TypeScript and the palette shows the top 5 per type.

The limit is deliberately larger than what is displayed. Ranking happens after the fetch, so limiting to 5 in SQL could discard a title match in favour of five body matches that happen to be newer.

Tasks select the related project name for their subtitle in the same round trip, using the existing foreign key:

```ts
.select("id, project_id, title, description, updated_at, projects(name)")
```

### Term escaping

PostgREST parses the `.or()` argument as a comma-and-parenthesis delimited list. A term containing `,` `(` `)` `%` or `\` either breaks the filter or silently changes which rows match. `escapeSearchTerm` strips those five characters before the filter string is built. This is the one piece of this feature that fails silently if it is wrong, so it gets direct unit tests.

Stripping rather than escaping means a term like `50%` searches for `50`. That is a deliberate trade: it never returns wrong rows, only broader ones, and percent signs are rare in titles.

Filter shape per type, using the escaped term:

```
.or(`title.ilike.%${safe}%,description.ilike.%${safe}%`)
```

### Ranking

`rankSearchResults` is a pure function over the combined array:

1. `matchedTitle === true` before `matchedTitle === false`
2. then `updatedAt` descending

Kept in TypeScript rather than SQL so it is directly testable and so the three queries stay independent.

### Palette changes (`src/components/command-palette.tsx`)

- Debounce the input by 200ms; run the search only at two or more characters.
- Fetch through react-query keyed `["workspace-search", workspaceId, term]`.
- Render results in labelled groups (Tasks, Notes, Missions) beneath the matching nav commands.
- Keep the existing quick-capture action as the fallback when nothing matches.
- Add ↑/↓/Enter navigation across the combined list of nav commands and results. The palette is mouse-only today, which is tolerable for seven fixed commands and not for a live result list. Enter activates the highlighted row; the highlight resets to the first row whenever the term changes.
- While a search is in flight, keep the previous results visible rather than flashing an empty state.

### Deep links

Both destinations carry the target in a query parameter, read with `useSearchParams` and cleared once consumed so the back button behaves.

- **Task** — `project-workspace-page.tsx` reads `?task=<id>`. When present and the work item is loaded, it sets `selectedWorkItemId`, which opens the existing card modal over whatever tab is active. If the id is not in the loaded set, the parameter is cleared and nothing opens.
- **Note** — `notes-page.tsx` reads `?note=<id>`. When present it resets the type filter to `all` (otherwise the target note can be filtered out of view), scrolls the note into view, and applies a brief highlight ring for two seconds.

## Testing

- `escapeSearchTerm`: strips each of the five characters; leaves ordinary terms untouched.
- `rankSearchResults`: title matches precede body matches; ties break by recency.
- `searchWorkspace`: chainable Supabase mock asserting workspace scoping, the `.or()` filter string for each type, and the limit.
- Palette: typing a term renders grouped results with correct destinations; fewer than two characters runs no search; ↑/↓/Enter moves and activates.
- Deep links: workspace page opens the modal for `?task=`; notes page clears the filter and highlights for `?note=`.

## Non-goals

Maps, meeting notes, task comments and milestones are not searchable in this pass — comments and meeting notes have no addressable destination yet, which would produce results that land you on a page still hunting. Also excluded: full-text ranking and stemming, search history, and saved searches. Substring matching over a personal workspace is adequate; if row counts ever reach the tens of thousands, the escape hatch is `tsvector` columns with GIN indexes behind the same `searchWorkspace` interface.
