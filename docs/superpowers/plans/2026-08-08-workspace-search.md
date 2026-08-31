# Workspace Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Ctrl+K find tasks, notes and projects across the workspace, and land the user on the thing they picked.

**Architecture:** One new query module owns escaping, fetching and ranking as separately testable pieces. The command palette consumes it through react-query and renders grouped results. Two pages gain query-parameter deep links so a result opens the actual item.

**Tech Stack:** React 19, react-router-dom 7 (`useSearchParams`), @tanstack/react-query, Supabase PostgREST, vitest.

**Spec (normative):** `docs/superpowers/specs/2026-08-08-workspace-search-design.md`

## Global Constraints

- Worktree `C:\src\Personal\ToDo\.worktrees\project-command-center`, branch `codex/workspace-search`.
- No migration and no schema change. Substring matching only.
- Searchable types: `work_items`, `notes`, `projects`. Nav commands stay and match first.
- Fetch `.limit(10)` per type ordered by `updated_at` descending; display the top 5 per type after ranking.
- `escapeSearchTerm` strips exactly these five characters: `,` `(` `)` `%` `\`
- Minimum query length is 2 characters. Debounce is 200ms.
- Suite green per task (`npx vitest run --maxWorkers=2` under load). Commit per task.

## File Structure

| File | Responsibility |
| --- | --- |
| `src/features/search/search.queries.ts` (create) | Escaping, the three fetches, mapping to `SearchResult`, ranking |
| `src/features/search/search.queries.test.ts` (create) | Unit tests for escaping and ranking; query-shape tests |
| `src/components/command-palette.tsx` (modify) | Debounced search, grouped results, keyboard navigation |
| `src/components/command-palette.test.tsx` (modify) | Grouped result rendering and keyboard behaviour |
| `src/features/projects/project-workspace-page.tsx` (modify) | Read `?task=` and open the card modal |
| `src/features/notes/notes-page.tsx` (modify) | Read `?note=`, reset filter, scroll and highlight |

---

### Task 1: Escaping and ranking (TDD)

**Files:**
- Create: `src/features/search/search.queries.ts`
- Create: `src/features/search/search.queries.test.ts`

**Interfaces — Produces:**

```ts
export type SearchResultType = "task" | "note" | "project";

export interface SearchResult {
  id: string;
  type: SearchResultType;
  title: string;
  subtitle: string | null;
  to: string;
  matchedTitle: boolean;
  updatedAt: string;
}

export function escapeSearchTerm(term: string): string;
export function rankSearchResults(results: SearchResult[]): SearchResult[];
```

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from "vitest";
import { escapeSearchTerm, rankSearchResults, type SearchResult } from "./search.queries";

function result(overrides: Partial<SearchResult> = {}): SearchResult {
  return {
    id: "a",
    type: "task",
    title: "Task",
    subtitle: null,
    to: "/projects/p1?task=a",
    matchedTitle: false,
    updatedAt: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("escapeSearchTerm", () => {
  it("strips characters that break the PostgREST or() filter", () => {
    expect(escapeSearchTerm("a,b(c)d%e\\f")).toBe("abcdef");
  });

  it("leaves ordinary terms untouched", () => {
    expect(escapeSearchTerm("launch checklist")).toBe("launch checklist");
  });

  it("trims surrounding whitespace", () => {
    expect(escapeSearchTerm("  orbit  ")).toBe("orbit");
  });
});

describe("rankSearchResults", () => {
  it("puts title matches above body matches", () => {
    const ranked = rankSearchResults([
      result({ id: "body", matchedTitle: false }),
      result({ id: "title", matchedTitle: true }),
    ]);

    expect(ranked.map((entry) => entry.id)).toEqual(["title", "body"]);
  });

  it("breaks ties by most recently updated", () => {
    const ranked = rankSearchResults([
      result({ id: "older", matchedTitle: true, updatedAt: "2026-08-01T00:00:00.000Z" }),
      result({ id: "newer", matchedTitle: true, updatedAt: "2026-08-07T00:00:00.000Z" }),
    ]);

    expect(ranked.map((entry) => entry.id)).toEqual(["newer", "older"]);
  });

  it("does not mutate the input array", () => {
    const input = [result({ id: "one" }), result({ id: "two", matchedTitle: true })];
    rankSearchResults(input);

    expect(input.map((entry) => entry.id)).toEqual(["one", "two"]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/features/search/search.queries.test.ts`
Expected: FAIL — cannot resolve `./search.queries`.

- [ ] **Step 3: Implement the two pure functions**

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../lib/supabase/database.types";

type Client = SupabaseClient<Database>;

export type SearchResultType = "task" | "note" | "project";

export interface SearchResult {
  id: string;
  type: SearchResultType;
  title: string;
  subtitle: string | null;
  to: string;
  matchedTitle: boolean;
  updatedAt: string;
}

export const searchKeys = {
  workspace: (workspaceId: string, term: string) => ["workspace-search", workspaceId, term] as const,
};

export const minSearchLength = 2;

// PostgREST parses or() as a comma and parenthesis delimited list, so these
// characters would break the filter or silently change which rows match.
const unsafeFilterCharacters = /[,()%\\]/g;

export function escapeSearchTerm(term: string): string {
  return term.replace(unsafeFilterCharacters, "").trim();
}

export function rankSearchResults(results: SearchResult[]): SearchResult[] {
  return [...results].sort((a, b) => {
    if (a.matchedTitle !== b.matchedTitle) return a.matchedTitle ? -1 : 1;
    return b.updatedAt.localeCompare(a.updatedAt);
  });
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/features/search/search.queries.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add src/features/search
git commit -m "Add search term escaping and result ranking"
```

---

### Task 2: `searchWorkspace` fetch (TDD)

**Files:**
- Modify: `src/features/search/search.queries.ts`
- Modify: `src/features/search/search.queries.test.ts`

**Interfaces:**
- Consumes: `escapeSearchTerm`, `rankSearchResults`, `SearchResult` from Task 1.
- Produces: `searchWorkspace(client: Client, workspaceId: string, term: string): Promise<SearchResult[]>`

- [ ] **Step 1: Write the failing tests**

Append to `search.queries.test.ts`, and add `vi` to the vitest import:

```ts
function createSearchClient() {
  const calls: Array<{ table: string; or: string; limit: number }> = [];

  const client = {
    from: vi.fn((table: string) => {
      const builder = {
        select: vi.fn((..._args: unknown[]) => builder),
        eq: vi.fn((..._args: unknown[]) => builder),
        order: vi.fn((..._args: unknown[]) => builder),
        or: vi.fn((filter: string) => {
          calls.push({ table, or: filter, limit: 0 });
          return builder;
        }),
        limit: vi.fn((count: number) => {
          calls[calls.length - 1].limit = count;
          return Promise.resolve({ data: [], error: null });
        }),
      };
      return builder;
    }),
  };

  return { client, calls };
}

describe("searchWorkspace", () => {
  it("queries all three types, scoped and limited", async () => {
    const { client, calls } = createSearchClient();

    await searchWorkspace(client as never, "workspace-1", "orbit");

    expect(calls.map((entry) => entry.table).sort()).toEqual(["notes", "projects", "work_items"]);
    expect(calls.every((entry) => entry.limit === 10)).toBe(true);
  });

  it("builds an or() filter over the title and body of each type", async () => {
    const { client, calls } = createSearchClient();

    await searchWorkspace(client as never, "workspace-1", "orbit");

    const byTable = Object.fromEntries(calls.map((entry) => [entry.table, entry.or]));
    expect(byTable.work_items).toBe("title.ilike.%orbit%,description.ilike.%orbit%");
    expect(byTable.notes).toBe("title.ilike.%orbit%,body.ilike.%orbit%");
    expect(byTable.projects).toBe("name.ilike.%orbit%,description.ilike.%orbit%");
  });

  it("escapes the term before building the filter", async () => {
    const { client, calls } = createSearchClient();

    await searchWorkspace(client as never, "workspace-1", "a,b(c)");

    expect(calls[0].or).toContain("%abc%");
    expect(calls[0].or).not.toContain(",b(");
  });

  it("returns nothing for a term shorter than the minimum", async () => {
    const { client, calls } = createSearchClient();

    const results = await searchWorkspace(client as never, "workspace-1", "a");

    expect(results).toEqual([]);
    expect(calls).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/features/search/search.queries.test.ts`
Expected: FAIL — `searchWorkspace is not a function`.

- [ ] **Step 3: Implement `searchWorkspace`**

Append to `search.queries.ts`:

```ts
interface TaskRow {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  updated_at: string;
  projects: { name: string } | null;
}

interface NoteRow {
  id: string;
  title: string;
  body: string | null;
  note_type: string;
  updated_at: string;
}

interface ProjectRow {
  id: string;
  name: string;
  description: string | null;
  status: string;
  updated_at: string;
}

function matchesTitle(title: string, term: string) {
  return title.toLowerCase().includes(term.toLowerCase());
}

export async function searchWorkspace(
  client: Client,
  workspaceId: string,
  term: string,
): Promise<SearchResult[]> {
  const safe = escapeSearchTerm(term);
  if (safe.length < minSearchLength) return [];

  const [tasks, notes, projects] = await Promise.all([
    client
      .from("work_items")
      .select("id, project_id, title, description, updated_at, projects(name)")
      .eq("workspace_id", workspaceId)
      .or(`title.ilike.%${safe}%,description.ilike.%${safe}%`)
      .order("updated_at", { ascending: false })
      .limit(10),
    client
      .from("notes")
      .select("id, title, body, note_type, updated_at")
      .eq("workspace_id", workspaceId)
      .or(`title.ilike.%${safe}%,body.ilike.%${safe}%`)
      .order("updated_at", { ascending: false })
      .limit(10),
    client
      .from("projects")
      .select("id, name, description, status, updated_at")
      .eq("workspace_id", workspaceId)
      .or(`name.ilike.%${safe}%,description.ilike.%${safe}%`)
      .order("updated_at", { ascending: false })
      .limit(10),
  ]);

  if (tasks.error) throw tasks.error;
  if (notes.error) throw notes.error;
  if (projects.error) throw projects.error;

  const taskResults: SearchResult[] = ((tasks.data ?? []) as unknown as TaskRow[]).map((row) => ({
    id: row.id,
    type: "task",
    title: row.title,
    subtitle: row.projects?.name ?? null,
    to: `/projects/${row.project_id}?task=${row.id}`,
    matchedTitle: matchesTitle(row.title, safe),
    updatedAt: row.updated_at,
  }));

  const noteResults: SearchResult[] = ((notes.data ?? []) as unknown as NoteRow[]).map((row) => ({
    id: row.id,
    type: "note",
    title: row.title,
    subtitle: row.note_type,
    to: `/notes?note=${row.id}`,
    matchedTitle: matchesTitle(row.title, safe),
    updatedAt: row.updated_at,
  }));

  const projectResults: SearchResult[] = ((projects.data ?? []) as unknown as ProjectRow[]).map((row) => ({
    id: row.id,
    type: "project",
    title: row.name,
    subtitle: row.status,
    to: `/projects/${row.id}`,
    matchedTitle: matchesTitle(row.name, safe),
    updatedAt: row.updated_at,
  }));

  return rankSearchResults([...taskResults, ...noteResults, ...projectResults]);
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/features/search/search.queries.test.ts`
Expected: PASS, 10 tests.

- [ ] **Step 5: Commit**

```bash
git add src/features/search
git commit -m "Search tasks, notes, and projects by substring"
```

---

### Task 3: Palette results and keyboard navigation

**Files:**
- Modify: `src/components/command-palette.tsx`
- Modify: `src/components/command-palette.test.tsx`

**Interfaces:**
- Consumes: `searchWorkspace`, `searchKeys`, `minSearchLength`, `SearchResult` from Tasks 1-2.

**Implementation notes.** Add a `debouncedQuery` state updated by a `useEffect` with a 200ms `setTimeout` keyed on `trimmedQuery`, clearing the timer on cleanup. Feed it to `useQuery({ queryKey: searchKeys.workspace(workspaceId ?? "", debouncedQuery), queryFn: () => searchWorkspace(supabase, workspaceId ?? "", debouncedQuery), enabled: Boolean(workspaceId && user && debouncedQuery.length >= minSearchLength), placeholderData: (previous) => previous })`. `placeholderData` is what keeps the previous results on screen instead of flashing empty while typing.

Group the results with `results.filter((entry) => entry.type === "task").slice(0, 5)` and the same for `"note"` and `"project"`, under headings `Tasks`, `Notes` and `Missions`.

Build a flat `navigableItems` array of `{ key, to }` — the filtered nav commands first, then the grouped results in display order — and track `highlightIndex` state. Reset it to 0 in the same `useEffect` that sets `debouncedQuery`. In the palette's existing `handleKeyDown`, add `ArrowDown` / `ArrowUp` to move the index (clamped) and `Enter` to `openRoute(navigableItems[highlightIndex].to)`. Apply `aria-selected` and a highlight class to the active row.

- [ ] **Step 1: Write the failing tests**

Add to `command-palette.test.tsx`, mocking the query module:

```ts
vi.mock("../features/search/search.queries", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../features/search/search.queries")>()),
  searchWorkspace: searchMocks.searchWorkspace,
}));
```

with `const searchMocks = vi.hoisted(() => ({ searchWorkspace: vi.fn() }));` near the other hoisted mocks, and these tests:

```ts
it("shows grouped results for a search term", async () => {
  const user = userEvent.setup();
  searchMocks.searchWorkspace.mockResolvedValue([
    { id: "t1", type: "task", title: "Wire the timeline", subtitle: "PocketPup", to: "/projects/p1?task=t1", matchedTitle: true, updatedAt: "2026-08-07T00:00:00.000Z" },
    { id: "n1", type: "note", title: "Timeline idea", subtitle: "idea", to: "/notes?note=n1", matchedTitle: true, updatedAt: "2026-08-06T00:00:00.000Z" },
  ]);

  renderCommandPalette();
  await user.click(screen.getByRole("button", { name: "Open command palette" }));
  await user.type(screen.getByLabelText("Search commands"), "timeline");

  expect(await screen.findByText("Wire the timeline")).toBeVisible();
  expect(screen.getByText("Timeline idea")).toBeVisible();
  expect(screen.getByRole("heading", { name: "Tasks" })).toBeVisible();
  expect(screen.getByRole("heading", { name: "Notes" })).toBeVisible();
});

it("does not search below the minimum term length", async () => {
  const user = userEvent.setup();
  searchMocks.searchWorkspace.mockResolvedValue([]);

  renderCommandPalette();
  await user.click(screen.getByRole("button", { name: "Open command palette" }));
  await user.type(screen.getByLabelText("Search commands"), "t");

  await waitFor(() => {
    expect(searchMocks.searchWorkspace).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/components/command-palette.test.tsx`
Expected: FAIL — the result text is not found.

- [ ] **Step 3: Implement the palette changes** per the implementation notes above.

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/components/command-palette.test.tsx`
Expected: PASS, all existing tests plus the two new ones.

- [ ] **Step 5: Commit**

```bash
git add src/components/command-palette.tsx src/components/command-palette.test.tsx
git commit -m "Show workspace search results in the command palette"
```

---

### Task 4: Task deep link

**Files:**
- Modify: `src/features/projects/project-workspace-page.tsx`
- Modify: `src/features/projects/project-workspace-page.test.tsx`

**Implementation.** Import `useSearchParams` from `react-router-dom` alongside the existing `useParams`. Add, after `workItems` is derived:

```tsx
const [searchParams, setSearchParams] = useSearchParams();
const requestedTaskId = searchParams.get("task");

useEffect(() => {
  if (!requestedTaskId) return;
  if (workItemsQuery.isPending) return;

  if (workItems.some((item) => item.id === requestedTaskId)) {
    setSelectedWorkItemId(requestedTaskId);
  }

  const next = new URLSearchParams(searchParams);
  next.delete("task");
  setSearchParams(next, { replace: true });
}, [requestedTaskId, workItems, workItemsQuery.isPending, searchParams, setSearchParams]);
```

Place this with the other hooks, above every early return — the page has crashed before (React error #310) from a hook placed after a guard.

- [ ] **Step 1: Write the failing test**

```tsx
it("opens the task named by the task search parameter", async () => {
  workItemMocks.listWorkItems.mockResolvedValue([workItem({ id: "work-item-1", title: "Wire timeline" })]);

  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={["/projects/project-1?task=work-item-1"]}>
        <Routes>
          <Route element={<ProjectWorkspacePage />} path="/projects/:projectId" />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );

  expect(await screen.findByRole("dialog", { name: /Task details for Wire timeline/i })).toBeVisible();
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/features/projects/project-workspace-page.test.tsx`
Expected: FAIL — the dialog is never found.

- [ ] **Step 3: Implement** the effect above.

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/features/projects/project-workspace-page.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/projects/project-workspace-page.tsx src/features/projects/project-workspace-page.test.tsx
git commit -m "Open a task from a search deep link"
```

---

### Task 5: Note deep link, then verify

**Files:**
- Modify: `src/features/notes/notes-page.tsx`
- Modify: `src/features/notes/notes-page.test.tsx`

**Implementation.** Import `useSearchParams` and `useRef`. Add `const noteRefs = useRef(new Map<string, HTMLLIElement>())` and `const [highlightedNoteId, setHighlightedNoteId] = useState<string | null>(null)`. Give each `<li>` `ref={(element) => { if (element) noteRefs.current.set(note.id, element); else noteRefs.current.delete(note.id); }}` and, when highlighted, the class `ring-2 ring-cyan-300/60`.

```tsx
const [searchParams, setSearchParams] = useSearchParams();
const requestedNoteId = searchParams.get("note");

useEffect(() => {
  if (!requestedNoteId || notesQuery.isPending) return;
  if (!notes.some((note) => note.id === requestedNoteId)) return;

  setActiveFilter("all");
  setHighlightedNoteId(requestedNoteId);
  noteRefs.current.get(requestedNoteId)?.scrollIntoView({ block: "center" });

  const next = new URLSearchParams(searchParams);
  next.delete("note");
  setSearchParams(next, { replace: true });

  const timer = window.setTimeout(() => setHighlightedNoteId(null), 2000);
  return () => window.clearTimeout(timer);
}, [requestedNoteId, notes, notesQuery.isPending, searchParams, setSearchParams]);
```

`scrollIntoView` is not implemented in jsdom, so the test stubs it.

- [ ] **Step 1: Write the failing test**

```tsx
it("reveals and highlights the note named by the note search parameter", async () => {
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
  notesMocks.listNotes.mockResolvedValue([note({ id: "note-1", title: "Turn this idea into work", note_type: "idea" })]);

  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={["/notes?note=note-1"]}>
        <NotesPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );

  const heading = await screen.findByText("Turn this idea into work");
  expect(heading.closest("li")).toHaveClass("ring-2");
});
```

`renderNotesPage` does not wrap in a router, so this test builds its own; add `MemoryRouter` to the react-router-dom import in the test file.

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/features/notes/notes-page.test.tsx`
Expected: FAIL — no `ring-2` class.

- [ ] **Step 3: Implement** the effect and refs above.

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/features/notes/notes-page.test.tsx`
Expected: PASS.

- [ ] **Step 5: Full verification**

```bash
npx vitest run --maxWorkers=2
npm run build
```

Expected: all tests pass; build clean. Then check in the browser that Ctrl+K finds a task and opens its modal, and finds a note and highlights it.

- [ ] **Step 6: Commit and push**

```bash
git add src/features/notes/notes-page.tsx src/features/notes/notes-page.test.tsx
git commit -m "Reveal a note from a search deep link"
git push -u origin codex/workspace-search
```

## Self-Review (completed)

**Spec coverage.** Scope table → Task 2. Escaping → Task 1, enforced in Task 2. Ranking → Task 1. Limit 10 fetch / 5 display → Task 2 fetch, Task 3 display. Palette debounce, grouping, keyboard, stale-while-fetching → Task 3. Task deep link → Task 4. Note deep link with filter reset and highlight → Task 5. Testing section → covered across all five tasks.

**Placeholder scan.** No TBDs; every code step carries real code.

**Type consistency.** `SearchResult` fields are identical in Tasks 1, 2 and 3. `searchKeys.workspace` and `minSearchLength` are defined in Task 1 and consumed in Task 3. Table and column names match the spec table: `work_items.description`, `notes.body`, `projects.name`.

**One gap found and fixed while reviewing:** the note deep link resets the type filter, but the filter reset alone does not guarantee the note is rendered before `scrollIntoView` runs. The effect therefore guards on `notesQuery.isPending` and on the note existing in the loaded set, so it only runs once the list is present.
