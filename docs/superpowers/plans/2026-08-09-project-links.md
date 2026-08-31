# Mission Links Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a typed links panel on the orphaned `project_links` table, consolidate every project URL into it, and delete the two orphaned structures nothing reads.

**Architecture:** A new `project-links.queries.ts` owns link CRUD and URL validation. `ProjectLinksPanel` renders inside the existing collapsible project brief. `projects.repository_url` is migrated into `project_links` and dropped; `subtasks` and `project_briefs.links` are dropped outright.

**Tech Stack:** React 19, TanStack Query, Supabase JS v2, Tailwind v4, vitest + @testing-library/react, Supabase CLI for migrations.

**Spec:** `docs/superpowers/specs/2026-08-09-project-links-design.md`

## Global Constraints

- URL validation message, verbatim: `Links must start with http:// or https://.`
- Empty-URL message, verbatim: `Links need a URL.`
- Every external anchor renders with `target="_blank"` and `rel="noreferrer"`.
- `link_type` values are exactly `repository`, `documentation`, `design`, `deployment`, `issue_tracker`, `other`. `LinkType` is already exported from `src/lib/supabase/database.types.ts:25`; do not redeclare it.
- `database.types.ts` is hand-maintained. There is no typegen — edit it directly.
- Do not change the `project_links` RLS policies. Delete is owner/admin only by design.
- Commit trailer on every commit: `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`
- Run tests with `npx vitest run --maxWorkers=2 <path>`.
- The migration is applied by the USER via `npx supabase db push`. Do not run it.

---

### Task 1: Migration

**Files:**
- Create: `supabase/migrations/202608090002_project_links_and_subtasks.sql`

**Interfaces:**
- Produces: a schema where `projects.repository_url`, `public.subtasks`, and `project_briefs.links` no longer exist, and every former repository URL is a `project_links` row.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/202608090002_project_links_and_subtasks.sql`:

```sql
-- Consolidate every project URL into project_links, and remove the two
-- orphaned structures no code ever read.

-- 1. Each project's repository URL becomes a typed repository link.
insert into public.project_links (workspace_id, project_id, link_type, label, url, created_by)
select p.workspace_id, p.id, 'repository', 'Repository', p.repository_url, p.created_by
from public.projects p
where p.repository_url is not null
  and length(trim(p.repository_url)) > 0;

alter table public.projects drop column repository_url;

-- 2. work_item_checklist_items already covers this, with a working UI.
--    Dropping the table takes its trigger, policies, and grants with it.
drop table public.subtasks;

-- 3. project_briefs.links was round-tripped by saveProjectBrief but never set
--    by any UI, so every row should still be '[]'. If that assumption is wrong,
--    fail the push rather than discard data.
do $$
declare
  populated integer;
begin
  select count(*) into populated
  from public.project_briefs
  where links is not null
    and links <> '[]'::jsonb;

  if populated > 0 then
    raise exception
      'project_briefs.links holds data in % row(s); migrate it before dropping the column',
      populated;
  end if;
end
$$;

alter table public.project_briefs drop column links;
```

- [ ] **Step 2: Check it against the existing schema**

Read `supabase/migrations/202606280001_initial_project_command_center.sql` and confirm:
- `project_links` grants include `insert(workspace_id, project_id, link_type, label, url, created_by)` — the insert above supplies exactly those columns.
- Nothing else in the file references `repository_url` besides the `projects` insert and update grants, which drop the column privilege automatically.

No local database is available, so the migration is verified by review and by the user's push, not by running it.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/202608090002_project_links_and_subtasks.sql && git commit -m "feat: migrate project URLs into project_links and drop the orphans"
```

- [ ] **Step 4: Hand the push to the user**

Tell the user to run:

```bash
npx supabase db push
```

Note that it must run from the worktree — the Supabase link state lives in
`supabase/.temp/`, which is gitignored and only exists there. Do not proceed to
Task 5's verification of live data until they confirm; Tasks 2 through 4 do not
depend on it.

---

### Task 2: `project-links.queries.ts`

**Files:**
- Create: `src/features/projects/project-links.queries.ts`
- Test: `src/features/projects/project-links.queries.test.ts`

**Interfaces:**
- Consumes: `Database`, `LinkType` from `src/lib/supabase/database.types`
- Produces:
  ```ts
  export type ProjectLink = Database["public"]["Tables"]["project_links"]["Row"];
  export const linkTypes: readonly LinkType[];
  export function linkTypeLabel(type: LinkType): string;
  export function normalizeLinkUrl(value?: string | null): string;   // throws
  export function safeLinkUrl(value: string): string | null;         // never throws
  listProjectLinks(client, { workspaceId, projectId }): Promise<ProjectLink[]>
  createProjectLink(client, { workspaceId, projectId, userId, linkType, label, url }): Promise<ProjectLink>
  updateProjectLink(client, { id, workspaceId, linkType, label, url }): Promise<ProjectLink>
  deleteProjectLink(client, { id, workspaceId }): Promise<void>
  listRepositoryLinks(client, { workspaceId, projectIds }): Promise<Map<string, string>>
  ```

- [ ] **Step 1: Write the failing test**

Create `src/features/projects/project-links.queries.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import {
  createProjectLink,
  deleteProjectLink,
  linkTypeLabel,
  listProjectLinks,
  listRepositoryLinks,
  normalizeLinkUrl,
  safeLinkUrl,
} from "./project-links.queries";

function createQueryClient(result: { data: unknown; error: unknown } = { data: [], error: null }) {
  const query = {
    ...result,
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    in: vi.fn(() => query),
    order: vi.fn(() => query),
    insert: vi.fn(() => query),
    update: vi.fn(() => query),
    delete: vi.fn(() => query),
    single: vi.fn(() => result),
  };

  return { client: { from: vi.fn(() => query) }, query };
}

describe("normalizeLinkUrl", () => {
  it("accepts http and https", () => {
    expect(normalizeLinkUrl("https://example.com/docs")).toBe("https://example.com/docs");
    expect(normalizeLinkUrl("  http://example.com  ")).toBe("http://example.com/");
  });

  it("rejects protocols that are not http or https", () => {
    expect(() => normalizeLinkUrl("javascript:alert(1)")).toThrow(
      "Links must start with http:// or https://.",
    );
    expect(() => normalizeLinkUrl("ftp://example.com")).toThrow(
      "Links must start with http:// or https://.",
    );
  });

  it("rejects unparseable input", () => {
    expect(() => normalizeLinkUrl("example.com")).toThrow(
      "Links must start with http:// or https://.",
    );
  });

  it("rejects an empty URL", () => {
    expect(() => normalizeLinkUrl("   ")).toThrow("Links need a URL.");
    expect(() => normalizeLinkUrl(null)).toThrow("Links need a URL.");
  });
});

describe("safeLinkUrl", () => {
  it("returns null instead of throwing", () => {
    expect(safeLinkUrl("javascript:alert(1)")).toBeNull();
    expect(safeLinkUrl("https://example.com/")).toBe("https://example.com/");
  });
});

describe("linkTypeLabel", () => {
  it("spells issue_tracker as prose", () => {
    expect(linkTypeLabel("issue_tracker")).toBe("Issue tracker");
    expect(linkTypeLabel("repository")).toBe("Repository");
  });
});

describe("listProjectLinks", () => {
  it("scopes to the workspace and project and orders by type", async () => {
    const { client, query } = createQueryClient({ data: [], error: null });

    await listProjectLinks(client as never, { workspaceId: "workspace-1", projectId: "project-1" });

    expect(client.from).toHaveBeenCalledWith("project_links");
    expect(query.eq).toHaveBeenCalledWith("workspace_id", "workspace-1");
    expect(query.eq).toHaveBeenCalledWith("project_id", "project-1");
    expect(query.order).toHaveBeenCalledWith("link_type", { ascending: true });
    expect(query.order).toHaveBeenCalledWith("created_at", { ascending: true });
  });
});

describe("createProjectLink", () => {
  it("normalizes the URL before writing", async () => {
    const { client, query } = createQueryClient({ data: { id: "link-1" }, error: null });

    await createProjectLink(client as never, {
      workspaceId: "workspace-1",
      projectId: "project-1",
      userId: "user-1",
      linkType: "documentation",
      label: "Docs",
      url: "  https://example.com/docs  ",
    });

    expect(query.insert).toHaveBeenCalledWith({
      workspace_id: "workspace-1",
      project_id: "project-1",
      created_by: "user-1",
      link_type: "documentation",
      label: "Docs",
      url: "https://example.com/docs",
    });
  });

  it("falls back to the type name when the label is blank", async () => {
    const { client, query } = createQueryClient({ data: { id: "link-1" }, error: null });

    await createProjectLink(client as never, {
      workspaceId: "workspace-1",
      projectId: "project-1",
      userId: "user-1",
      linkType: "issue_tracker",
      label: "   ",
      url: "https://example.com/issues",
    });

    expect(query.insert).toHaveBeenCalledWith(
      expect.objectContaining({ label: "Issue tracker" }),
    );
  });

  it("refuses a dangerous URL without writing", async () => {
    const { client, query } = createQueryClient({ data: null, error: null });

    await expect(
      createProjectLink(client as never, {
        workspaceId: "workspace-1",
        projectId: "project-1",
        userId: "user-1",
        linkType: "other",
        label: "Bad",
        url: "javascript:alert(1)",
      }),
    ).rejects.toThrow("Links must start with http:// or https://.");

    expect(query.insert).not.toHaveBeenCalled();
  });
});

describe("deleteProjectLink", () => {
  it("scopes the delete to the workspace", async () => {
    const { client, query } = createQueryClient({ data: null, error: null });

    await deleteProjectLink(client as never, { id: "link-1", workspaceId: "workspace-1" });

    expect(query.delete).toHaveBeenCalled();
    expect(query.eq).toHaveBeenCalledWith("id", "link-1");
    expect(query.eq).toHaveBeenCalledWith("workspace_id", "workspace-1");
  });
});

describe("listRepositoryLinks", () => {
  it("maps project id to URL and keeps the first per project", async () => {
    const { client } = createQueryClient({
      data: [
        { project_id: "project-1", url: "https://example.com/one" },
        { project_id: "project-1", url: "https://example.com/two" },
        { project_id: "project-2", url: "https://example.com/three" },
      ],
      error: null,
    });

    const result = await listRepositoryLinks(client as never, {
      workspaceId: "workspace-1",
      projectIds: ["project-1", "project-2"],
    });

    expect(result.get("project-1")).toBe("https://example.com/one");
    expect(result.get("project-2")).toBe("https://example.com/three");
  });

  it("issues no query for an empty id list", async () => {
    const { client } = createQueryClient({ data: [], error: null });

    const result = await listRepositoryLinks(client as never, {
      workspaceId: "workspace-1",
      projectIds: [],
    });

    expect(result.size).toBe(0);
    expect(client.from).not.toHaveBeenCalled();
  });

  it("drops URLs that would not be safe to render", async () => {
    const { client } = createQueryClient({
      data: [{ project_id: "project-1", url: "javascript:alert(1)" }],
      error: null,
    });

    const result = await listRepositoryLinks(client as never, {
      workspaceId: "workspace-1",
      projectIds: ["project-1"],
    });

    expect(result.size).toBe(0);
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

```bash
npx vitest run --maxWorkers=2 src/features/projects/project-links.queries.test.ts
```

Expected: FAIL — `Failed to resolve import "./project-links.queries"`.

- [ ] **Step 3: Write the module**

Create `src/features/projects/project-links.queries.ts`:

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, LinkType } from "../../lib/supabase/database.types";

type Client = SupabaseClient<Database>;

export type ProjectLink = Database["public"]["Tables"]["project_links"]["Row"];

export const linkTypes = [
  "repository",
  "documentation",
  "design",
  "deployment",
  "issue_tracker",
  "other",
] as const satisfies readonly LinkType[];

const linkTypeLabels: Record<LinkType, string> = {
  repository: "Repository",
  documentation: "Documentation",
  design: "Design",
  deployment: "Deployment",
  issue_tracker: "Issue tracker",
  other: "Other",
};

export function linkTypeLabel(type: LinkType) {
  return linkTypeLabels[type];
}

/**
 * The http/https check is what stops a `javascript:` URL becoming a clickable
 * anchor, so every write goes through here.
 */
export function normalizeLinkUrl(value?: string | null): string {
  const trimmed = value?.trim();
  if (!trimmed) throw new Error("Links need a URL.");

  let url: URL;

  try {
    url = new URL(trimmed);
  } catch {
    throw new Error("Links must start with http:// or https://.");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Links must start with http:// or https://.");
  }

  return url.href;
}

/** Render-time guard for rows that reached the table without passing through a writer. */
export function safeLinkUrl(value: string): string | null {
  try {
    return normalizeLinkUrl(value);
  } catch {
    return null;
  }
}

function resolveLabel(label: string, linkType: LinkType) {
  return label.trim() || linkTypeLabel(linkType);
}

export async function listProjectLinks(
  client: Client,
  input: { workspaceId: string; projectId: string },
) {
  const { data, error } = await client
    .from("project_links")
    .select("*")
    .eq("workspace_id", input.workspaceId)
    .eq("project_id", input.projectId)
    .order("link_type", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function createProjectLink(
  client: Client,
  input: {
    workspaceId: string;
    projectId: string;
    userId: string;
    linkType: LinkType;
    label: string;
    url: string;
  },
) {
  const url = normalizeLinkUrl(input.url);

  const { data, error } = await client
    .from("project_links")
    .insert({
      workspace_id: input.workspaceId,
      project_id: input.projectId,
      created_by: input.userId,
      link_type: input.linkType,
      label: resolveLabel(input.label, input.linkType),
      url,
    })
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

export async function updateProjectLink(
  client: Client,
  input: { id: string; workspaceId: string; linkType: LinkType; label: string; url: string },
) {
  const url = normalizeLinkUrl(input.url);

  const { data, error } = await client
    .from("project_links")
    .update({
      link_type: input.linkType,
      label: resolveLabel(input.label, input.linkType),
      url,
    })
    .eq("id", input.id)
    .eq("workspace_id", input.workspaceId)
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

export async function deleteProjectLink(client: Client, input: { id: string; workspaceId: string }) {
  const { error } = await client
    .from("project_links")
    .delete()
    .eq("id", input.id)
    .eq("workspace_id", input.workspaceId);

  if (error) throw error;
}

/** Project id to repository URL, for the projects list card. */
export async function listRepositoryLinks(
  client: Client,
  input: { workspaceId: string; projectIds: string[] },
): Promise<Map<string, string>> {
  const byProject = new Map<string, string>();
  if (input.projectIds.length === 0) return byProject;

  const { data, error } = await client
    .from("project_links")
    .select("project_id, url")
    .eq("workspace_id", input.workspaceId)
    .eq("link_type", "repository")
    .in("project_id", input.projectIds)
    .order("created_at", { ascending: true });

  if (error) throw error;

  for (const row of (data ?? []) as Array<{ project_id: string; url: string }>) {
    if (byProject.has(row.project_id)) continue;
    const url = safeLinkUrl(row.url);
    if (url) byProject.set(row.project_id, url);
  }

  return byProject;
}
```

- [ ] **Step 4: Run the test and confirm it passes**

```bash
npx vitest run --maxWorkers=2 src/features/projects/project-links.queries.test.ts
```

Expected: PASS, 13 tests.

- [ ] **Step 5: Commit**

```bash
git add src/features/projects/project-links.queries.ts src/features/projects/project-links.queries.test.ts && git commit -m "feat: add project links queries"
```

---

### Task 3: `ProjectLinksPanel`

**Files:**
- Create: `src/features/projects/project-links-panel.tsx`
- Test: `src/features/projects/project-links-panel.test.tsx`

**Interfaces:**
- Consumes: `ProjectLink`, `linkTypes`, `linkTypeLabel`, `safeLinkUrl` from Task 2
- Produces:
  ```tsx
  type LinkValues = { linkType: LinkType; label: string; url: string };

  export function ProjectLinksPanel(props: {
    links: ProjectLink[];
    isLoading?: boolean;
    isSaving?: boolean;
    errorMessage?: string | null;
    onCreate: (values: LinkValues) => Promise<void> | void;
    onUpdate: (id: string, values: LinkValues) => Promise<void> | void;
    onDelete: (id: string) => Promise<void> | void;
  }): JSX.Element
  ```

The panel is presentational. The workspace page owns queries, mutations, and
error rendering — the same split `ProjectBriefPanel` uses.

Editing is inline: a row's Edit button swaps that row for the same three fields
plus Save and Cancel. Only one row edits at a time, tracked by a single
`editingId`. The add form is a separate, always-present row, so the two never
share state.

- [ ] **Step 1: Write the failing test**

Create `src/features/projects/project-links-panel.test.tsx`:

```tsx
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { ProjectLink } from "./project-links.queries";
import { ProjectLinksPanel } from "./project-links-panel";

function link(overrides: Partial<ProjectLink> = {}): ProjectLink {
  return {
    id: "link-1",
    workspace_id: "workspace-1",
    project_id: "project-1",
    link_type: "repository",
    label: "Repository",
    url: "https://github.com/example/repo",
    created_by: "user-1",
    created_at: "2026-08-01T00:00:00.000Z",
    updated_at: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("ProjectLinksPanel", () => {
  it("renders each link as a safe external anchor", () => {
    render(<ProjectLinksPanel links={[link()]} onCreate={vi.fn()} onUpdate={vi.fn()} onDelete={vi.fn()} />);

    const anchor = screen.getByRole("link", { name: /Repository/ });
    expect(anchor).toHaveAttribute("href", "https://github.com/example/repo");
    expect(anchor).toHaveAttribute("target", "_blank");
    expect(anchor).toHaveAttribute("rel", "noreferrer");
    expect(screen.getByText("github.com")).toBeTruthy();
  });

  it("refuses to render a dangerous URL as a link", () => {
    render(
      <ProjectLinksPanel
        links={[link({ url: "javascript:alert(1)", label: "Sketchy" })]}
        onCreate={vi.fn()}
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.queryByRole("link", { name: /Sketchy/ })).toBeNull();
    expect(screen.getByText("Sketchy")).toBeTruthy();
  });

  it("invites the first link when there are none", () => {
    render(<ProjectLinksPanel links={[]} onCreate={vi.fn()} onUpdate={vi.fn()} onDelete={vi.fn()} />);

    expect(screen.getByText("No links yet. Add the repository, docs, or deployment.")).toBeTruthy();
  });

  it("submits a new link with the chosen type", async () => {
    const onCreate = vi.fn();
    const user = userEvent.setup();
    render(<ProjectLinksPanel links={[]} onCreate={onCreate} onUpdate={vi.fn()} onDelete={vi.fn()} />);

    await user.selectOptions(screen.getByLabelText("Link type"), "documentation");
    await user.type(screen.getByLabelText("Label"), "Docs");
    await user.type(screen.getByLabelText("URL"), "https://example.com/docs");
    await user.click(screen.getByRole("button", { name: "Add link" }));

    expect(onCreate).toHaveBeenCalledWith({
      linkType: "documentation",
      label: "Docs",
      url: "https://example.com/docs",
    });
  });

  it("passes a blank label through so the query can default it", async () => {
    const onCreate = vi.fn();
    const user = userEvent.setup();
    render(<ProjectLinksPanel links={[]} onCreate={onCreate} onUpdate={vi.fn()} onDelete={vi.fn()} />);

    await user.type(screen.getByLabelText("URL"), "https://example.com/docs");
    await user.click(screen.getByRole("button", { name: "Add link" }));

    expect(onCreate).toHaveBeenCalledWith({
      linkType: "repository",
      label: "",
      url: "https://example.com/docs",
    });
  });

  it("clears the form after a successful add", async () => {
    const user = userEvent.setup();
    render(<ProjectLinksPanel links={[]} onCreate={vi.fn()} onUpdate={vi.fn()} onDelete={vi.fn()} />);

    await user.type(screen.getByLabelText("URL"), "https://example.com/docs");
    await user.click(screen.getByRole("button", { name: "Add link" }));

    expect(screen.getByLabelText("URL")).toHaveValue("");
  });

  it("keeps the draft when the add fails", async () => {
    const onCreate = vi.fn().mockRejectedValue(new Error("nope"));
    const user = userEvent.setup();
    render(<ProjectLinksPanel links={[]} onCreate={onCreate} onUpdate={vi.fn()} onDelete={vi.fn()} />);

    await user.type(screen.getByLabelText("URL"), "https://example.com/docs");
    await user.click(screen.getByRole("button", { name: "Add link" }));

    expect(screen.getByLabelText("URL")).toHaveValue("https://example.com/docs");
  });

  it("deletes a link by id", async () => {
    const onDelete = vi.fn();
    const user = userEvent.setup();
    render(<ProjectLinksPanel links={[link()]} onCreate={vi.fn()} onUpdate={vi.fn()} onDelete={onDelete} />);

    const row = screen.getByRole("listitem");
    await user.click(within(row).getByRole("button", { name: "Remove Repository" }));

    expect(onDelete).toHaveBeenCalledWith("link-1");
  });

  it("edits a link in place, prefilled with its current values", async () => {
    const onUpdate = vi.fn();
    const user = userEvent.setup();
    render(<ProjectLinksPanel links={[link()]} onCreate={vi.fn()} onUpdate={onUpdate} onDelete={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Edit Repository" }));

    const row = screen.getByRole("listitem");
    expect(within(row).getByLabelText("Label")).toHaveValue("Repository");
    expect(within(row).getByLabelText("URL")).toHaveValue("https://github.com/example/repo");

    await user.clear(within(row).getByLabelText("Label"));
    await user.type(within(row).getByLabelText("Label"), "Main repo");
    await user.click(within(row).getByRole("button", { name: "Save link" }));

    expect(onUpdate).toHaveBeenCalledWith("link-1", {
      linkType: "repository",
      label: "Main repo",
      url: "https://github.com/example/repo",
    });
  });

  it("closes the editor after a successful save", async () => {
    const user = userEvent.setup();
    render(<ProjectLinksPanel links={[link()]} onCreate={vi.fn()} onUpdate={vi.fn()} onDelete={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Edit Repository" }));
    await user.click(screen.getByRole("button", { name: "Save link" }));

    expect(screen.queryByRole("button", { name: "Save link" })).toBeNull();
    expect(screen.getByRole("link", { name: /Repository/ })).toBeTruthy();
  });

  it("keeps the editor open when the save fails", async () => {
    const onUpdate = vi.fn().mockRejectedValue(new Error("nope"));
    const user = userEvent.setup();
    render(<ProjectLinksPanel links={[link()]} onCreate={vi.fn()} onUpdate={onUpdate} onDelete={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Edit Repository" }));
    await user.click(screen.getByRole("button", { name: "Save link" }));

    expect(screen.getByRole("button", { name: "Save link" })).toBeTruthy();
  });

  it("discards the draft on cancel", async () => {
    const onUpdate = vi.fn();
    const user = userEvent.setup();
    render(<ProjectLinksPanel links={[link()]} onCreate={vi.fn()} onUpdate={onUpdate} onDelete={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Edit Repository" }));
    await user.type(within(screen.getByRole("listitem")).getByLabelText("Label"), " edited");
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onUpdate).not.toHaveBeenCalled();
    expect(screen.getByRole("link", { name: /Repository/ })).toBeTruthy();
  });

  it("shows the error the workspace hands it", () => {
    render(
      <ProjectLinksPanel
        errorMessage="Links must start with http:// or https://."
        links={[]}
        onCreate={vi.fn()}
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Links must start with http:// or https://.",
    );
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

```bash
npx vitest run --maxWorkers=2 src/features/projects/project-links-panel.test.tsx
```

Expected: FAIL — `Failed to resolve import "./project-links-panel"`.

- [ ] **Step 3: Write the component**

Create `src/features/projects/project-links-panel.tsx`:

```tsx
import { BookOpen, CircleDot, Cloud, GitBranch, Link2, Palette, Pencil, Trash2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Field } from "../../components/field";
import type { LinkType } from "../../lib/supabase/database.types";
import { linkTypeLabel, linkTypes, safeLinkUrl, type ProjectLink } from "./project-links.queries";

const linkTypeIcons: Record<LinkType, LucideIcon> = {
  repository: GitBranch,
  documentation: BookOpen,
  design: Palette,
  deployment: Cloud,
  issue_tracker: CircleDot,
  other: Link2,
};

function hostname(url: string) {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

type LinkValues = { linkType: LinkType; label: string; url: string };

/** The same three controls serve the add row and the inline editor. */
function LinkFields({
  disabled,
  onChange,
  values,
}: {
  disabled: boolean;
  onChange: (values: LinkValues) => void;
  values: LinkValues;
}) {
  return (
    <>
      <Field label="Link type">
        <select
          className="orbit-input"
          disabled={disabled}
          onChange={(event) => onChange({ ...values, linkType: event.target.value as LinkType })}
          value={values.linkType}
        >
          {linkTypes.map((type) => (
            <option key={type} value={type}>
              {linkTypeLabel(type)}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Label">
        <input
          className="orbit-input"
          disabled={disabled}
          onChange={(event) => onChange({ ...values, label: event.target.value })}
          placeholder={linkTypeLabel(values.linkType)}
          value={values.label}
        />
      </Field>

      <Field label="URL">
        <input
          className="orbit-input"
          disabled={disabled}
          onChange={(event) => onChange({ ...values, url: event.target.value })}
          placeholder="https://"
          value={values.url}
        />
      </Field>
    </>
  );
}

const emptyDraft: LinkValues = { linkType: "repository", label: "", url: "" };

export function ProjectLinksPanel({
  links,
  isLoading = false,
  isSaving = false,
  errorMessage = null,
  onCreate,
  onUpdate,
  onDelete,
}: {
  links: ProjectLink[];
  isLoading?: boolean;
  isSaving?: boolean;
  errorMessage?: string | null;
  onCreate: (values: LinkValues) => Promise<void> | void;
  onUpdate: (id: string, values: LinkValues) => Promise<void> | void;
  onDelete: (id: string) => Promise<void> | void;
}) {
  const [draft, setDraft] = useState<LinkValues>(emptyDraft);
  // One row edits at a time; the add row keeps its own draft either way.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<LinkValues>(emptyDraft);
  const isDisabled = isLoading || isSaving;

  function startEditing(item: ProjectLink) {
    setEditingId(item.id);
    setEditDraft({ linkType: item.link_type, label: item.label, url: item.url });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      await onCreate(draft);
      setDraft(emptyDraft);
    } catch {
      // The workspace renders the failure; keep the draft so nothing is retyped.
    }
  }

  async function handleEditSubmit(event: FormEvent<HTMLFormElement>, id: string) {
    event.preventDefault();

    try {
      await onUpdate(id, editDraft);
      setEditingId(null);
    } catch {
      // Stay open so the correction is not lost.
    }
  }

  return (
    <section aria-label="Mission links" className="grid gap-3">
      <h3 className="text-sm font-semibold text-white">Mission links</h3>

      {links.length === 0 ? (
        <p className="text-sm text-slate-400">No links yet. Add the repository, docs, or deployment.</p>
      ) : (
        <ul className="grid gap-1.5">
          {links.map((item) => {
            const Icon = linkTypeIcons[item.link_type];
            const href = safeLinkUrl(item.url);

            if (editingId === item.id) {
              return (
                <li
                  className="rounded-lg border border-cyan-300/25 bg-cyan-300/[0.04] px-3 py-2"
                  key={item.id}
                >
                  <form
                    className="grid gap-2 sm:grid-cols-[minmax(0,9rem)_minmax(0,1fr)_minmax(0,1.5fr)]"
                    onSubmit={(event) => void handleEditSubmit(event, item.id)}
                  >
                    <LinkFields disabled={isDisabled} onChange={setEditDraft} values={editDraft} />
                    <div className="flex gap-2 sm:col-span-3">
                      <button className="orbit-button-secondary" disabled={isDisabled} type="submit">
                        Save link
                      </button>
                      <button
                        className="orbit-button-secondary"
                        onClick={() => setEditingId(null)}
                        type="button"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                </li>
              );
            }

            return (
              <li
                className="flex items-center gap-2.5 rounded-lg border border-slate-400/10 bg-white/[0.02] px-3 py-2"
                key={item.id}
              >
                <Icon aria-hidden="true" className="h-4 w-4 shrink-0 text-slate-500" />
                <span className="min-w-0 flex-1">
                  {href ? (
                    <a
                      className="block truncate text-sm font-semibold text-cyan-200 hover:text-cyan-100"
                      href={href}
                      rel="noreferrer"
                      target="_blank"
                    >
                      {item.label}
                    </a>
                  ) : (
                    <span className="block truncate text-sm font-semibold text-slate-300">{item.label}</span>
                  )}
                  <span className="block truncate text-xs text-slate-500">{hostname(item.url)}</span>
                </span>
                <button
                  aria-label={`Edit ${item.label}`}
                  className="orbit-field-icon-button shrink-0"
                  disabled={isDisabled}
                  onClick={() => startEditing(item)}
                  type="button"
                >
                  <Pencil aria-hidden="true" className="h-4 w-4" />
                </button>
                <button
                  aria-label={`Remove ${item.label}`}
                  className="orbit-field-icon-button shrink-0"
                  disabled={isDisabled}
                  onClick={() => void onDelete(item.id)}
                  type="button"
                >
                  <Trash2 aria-hidden="true" className="h-4 w-4" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {errorMessage ? (
        <p
          className="rounded-md border border-violet-300/35 bg-violet-400/10 px-3 py-2 text-sm text-violet-100"
          role="alert"
        >
          {errorMessage}
        </p>
      ) : null}

      <form className="grid gap-2 sm:grid-cols-[minmax(0,9rem)_minmax(0,1fr)_minmax(0,1.5fr)_auto]" onSubmit={handleSubmit}>
        <LinkFields disabled={isDisabled} onChange={setDraft} values={draft} />

        <div className="flex items-end">
          <button className="orbit-button-secondary w-full" disabled={isDisabled} type="submit">
            Add link
          </button>
        </div>
      </form>
    </section>
  );
}
```

- [ ] **Step 4: Run the test and confirm it passes**

```bash
npx vitest run --maxWorkers=2 src/features/projects/project-links-panel.test.tsx
```

Expected: PASS, 13 tests.

While a row is editing, "Link type", "Label", and "URL" each appear twice — once
in the editor and once in the always-present add row. Every editing assertion is
scoped with `within(screen.getByRole("listitem"))` for that reason; an unscoped
`getByLabelText` will throw on multiple matches.

If `Field` does not associate its label with the control (check
`src/components/field.tsx`), `getByLabelText` will fail. In that case add
`aria-label` to each control matching the `Field` label text rather than
changing `Field`, which other panels depend on.

- [ ] **Step 5: Commit**

```bash
git add src/features/projects/project-links-panel.tsx src/features/projects/project-links-panel.test.tsx && git commit -m "feat: add the mission links panel"
```

---

### Task 4: Mount the panel and retire `project_briefs.links`

**Files:**
- Modify: `src/lib/supabase/database.types.ts` — remove `links` from `project_briefs` Row/Insert/Update
- Modify: `src/features/projects/project-brief.queries.ts` — remove `links` from `ProjectBriefValues` and the upsert
- Modify: `src/features/projects/project-brief-panel.tsx` — remove `links` from `valuesFromBrief`, widen `updateValue`, render the links panel
- Modify: `src/features/projects/project-brief-panel.test.tsx` — drop `links` from the fixture, rewrite the preservation test
- Modify: `src/features/projects/project-workspace-page.tsx` — links query and mutations

**Interfaces:**
- Consumes: `ProjectLinksPanel` (Task 3), `listProjectLinks`/`createProjectLink`/`deleteProjectLink` (Task 2)
- Produces: a mounted panel; `ProjectBriefValues` without `links`

- [ ] **Step 1: Strip `links` from the brief types**

In `src/lib/supabase/database.types.ts`, delete the `links` entry from the
`project_briefs` `Row`, `Insert`, and `Update` blocks.

In `src/features/projects/project-brief.queries.ts`:
- Delete `links: Json;` from `ProjectBriefValues`.
- Delete `links: input.links,` from the upsert payload.
- If `Json` is now an unused import, delete it.

In `src/features/projects/project-brief-panel.tsx`:
- Delete `links: brief?.links ?? [],` from `valuesFromBrief`.
- Change `updateValue`'s parameter type from
  `keyof Omit<ProjectBriefValues, "links">` to `keyof ProjectBriefValues`.

- [ ] **Step 2: Fix the brief panel test**

In `src/features/projects/project-brief-panel.test.tsx`:
- Delete `links: [{ label: "Spec", url: "https://example.com/spec" }],` from the
  fixture and every `links:` key in the assertions and `projectBrief({ ... })`
  calls.
- The test *"preserves existing links when background updates arrive before
  saving edits"* exercises the `isDirty` guard using `links` as its payload.
  Rewrite it to assert the same guard on a text field, renaming it to
  *"keeps the local draft when background updates arrive before saving edits"*:
  render with one `goal`, rerender with a different `goal`, and assert the
  input still shows the user's edited value and that saving submits it.

- [ ] **Step 3: Render the panel inside the brief**

In `src/features/projects/project-brief-panel.tsx`, add to the props:

```tsx
  linksSlot,
}: {
  ...
  linksSlot?: ReactNode;
```

and render it after the form's closing tag, inside `<details>`:

```tsx
      {linksSlot ? (
        <div className="mt-4 border-t border-slate-400/10 pt-4">{linksSlot}</div>
      ) : null}
```

A slot keeps `ProjectBriefPanel` presentational — it stays ignorant of queries
and of `ProjectLinksPanel`, so both keep their existing tests.

- [ ] **Step 4: Wire the workspace page**

In `src/features/projects/project-workspace-page.tsx`, add the imports:

```tsx
import { ProjectLinksPanel } from "./project-links-panel";
import { createProjectLink, deleteProjectLink, listProjectLinks, updateProjectLink } from "./project-links.queries";
```

Add the query and mutations next to the existing brief ones, following the
patterns already in the file for `queryKey`, `enabled`, and
`queryClient.invalidateQueries`:

```tsx
  const projectLinksKey = ["project-links", workspaceId, projectId];

  const projectLinksQuery = useQuery({
    queryKey: projectLinksKey,
    queryFn: () => listProjectLinks(supabase, { workspaceId: workspaceId ?? "", projectId }),
    enabled: Boolean(workspaceId && projectId),
  });

  const createProjectLinkMutation = useMutation({
    mutationFn: (values: { linkType: LinkType; label: string; url: string }) =>
      createProjectLink(supabase, {
        workspaceId: workspaceId ?? "",
        projectId,
        userId: user?.id ?? "",
        ...values,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: projectLinksKey }),
  });

  const updateProjectLinkMutation = useMutation({
    mutationFn: (values: { id: string; linkType: LinkType; label: string; url: string }) =>
      updateProjectLink(supabase, { ...values, workspaceId: workspaceId ?? "" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: projectLinksKey }),
  });

  const deleteProjectLinkMutation = useMutation({
    mutationFn: (id: string) => deleteProjectLink(supabase, { id, workspaceId: workspaceId ?? "" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: projectLinksKey }),
  });
```

Import `LinkType` as a type from `../../lib/supabase/database.types`.

Pass the slot to the existing `ProjectBriefPanel` element at line 731:

```tsx
        linksSlot={
          <ProjectLinksPanel
            errorMessage={
              createProjectLinkMutation.error?.message ??
              deleteProjectLinkMutation.error?.message ??
              projectLinksQuery.error?.message ??
              null
            }
            isLoading={projectLinksQuery.isPending}
            isSaving={createProjectLinkMutation.isPending || deleteProjectLinkMutation.isPending}
            links={projectLinksQuery.data ?? []}
            onCreate={(values) => createProjectLinkMutation.mutateAsync(values).then(() => undefined)}
            onUpdate={(id, values) =>
              updateProjectLinkMutation.mutateAsync({ id, ...values }).then(() => undefined)
            }
            onDelete={(id) => deleteProjectLinkMutation.mutateAsync(id).then(() => undefined)}
          />
        }
```

`mutateAsync` rejects on failure, which is what makes the panel keep its draft.

- [ ] **Step 5: Run the affected tests**

```bash
npx vitest run --maxWorkers=2 src/features/projects
```

Expected: PASS. `project-workspace-page.test.tsx` may need its Supabase mock
extended to answer a `project_links` select; follow the mock shape already in
that file and return an empty array.

- [ ] **Step 6: Typecheck**

```bash
npx tsc -b
```

Expected: no output.

- [ ] **Step 7: Commit**

```bash
git add src/features/projects src/lib/supabase/database.types.ts && git commit -m "feat: show mission links in the project brief"
```

---

### Task 5: Retire `projects.repository_url`

**Files:**
- Modify: `src/lib/supabase/database.types.ts` — remove `repository_url` from `projects`, remove the `subtasks` block
- Modify: `src/features/projects/projects.queries.ts` — `createProject`, delete `normalizeRepositoryUrl`
- Modify: `src/features/projects/projects-page.tsx` — repository links query, delete `safeRepositoryUrl`
- Test: `src/features/projects/projects.queries.test.ts` (create if absent), `src/features/projects/projects-page.test.tsx`
- Modify fixtures: `src/dev/orbit-flo-visual-fixtures.ts`, `src/features/calendar/calendar-page.test.tsx`, `src/features/inbox/inbox-page.test.tsx`, `src/features/projects/project-health.test.ts`, `src/features/projects/project-workspace-page.test.tsx`, `src/features/daily/daily-mission-control-page.test.tsx`

**Interfaces:**
- Produces: `createProject(client, input): Promise<{ project: Project; linkError: string | null }>`

- [ ] **Step 1: Write the failing test for `createProject`**

Create or extend `src/features/projects/projects.queries.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { createProject } from "./projects.queries";

function createClient(results: Record<string, { data: unknown; error: unknown }>) {
  const calls: Array<{ table: string; payload: unknown }> = [];

  const client = {
    from: vi.fn((table: string) => {
      const result = results[table] ?? { data: { id: "row-1" }, error: null };
      const query = {
        insert: vi.fn((payload: unknown) => {
          calls.push({ table, payload });
          return query;
        }),
        select: vi.fn(() => query),
        single: vi.fn(() => result),
      };
      return query;
    }),
  };

  return { client, calls };
}

const baseInput = {
  workspaceId: "workspace-1",
  userId: "user-1",
  name: "Mission",
  status: "active" as const,
  priority: "medium" as const,
  health: "good" as const,
};

describe("createProject", () => {
  it("writes the project then the repository link", async () => {
    const { client, calls } = createClient({
      projects: { data: { id: "project-1" }, error: null },
      project_links: { data: { id: "link-1" }, error: null },
    });

    const result = await createProject(client as never, {
      ...baseInput,
      repositoryUrl: "https://github.com/example/repo",
    });

    expect(calls.map((call) => call.table)).toEqual(["projects", "project_links"]);
    expect(calls[1].payload).toMatchObject({
      project_id: "project-1",
      link_type: "repository",
      label: "Repository",
      url: "https://github.com/example/repo",
    });
    expect(result.linkError).toBeNull();
  });

  it("creates no project when the URL is malformed", async () => {
    const { client, calls } = createClient({});

    await expect(
      createProject(client as never, { ...baseInput, repositoryUrl: "javascript:alert(1)" }),
    ).rejects.toThrow("Links must start with http:// or https://.");

    expect(calls).toHaveLength(0);
  });

  it("skips the link when no URL is given", async () => {
    const { client, calls } = createClient({
      projects: { data: { id: "project-1" }, error: null },
    });

    const result = await createProject(client as never, baseInput);

    expect(calls.map((call) => call.table)).toEqual(["projects"]);
    expect(result.linkError).toBeNull();
  });

  it("returns the project with linkError when the link write fails", async () => {
    const { client } = createClient({
      projects: { data: { id: "project-1" }, error: null },
      project_links: { data: null, error: { message: "permission denied" } },
    });

    const result = await createProject(client as never, {
      ...baseInput,
      repositoryUrl: "https://github.com/example/repo",
    });

    expect(result.project).toMatchObject({ id: "project-1" });
    expect(result.linkError).toBe("permission denied");
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

```bash
npx vitest run --maxWorkers=2 src/features/projects/projects.queries.test.ts
```

Expected: FAIL — `createProject` still returns a bare project and writes `repository_url`.

- [ ] **Step 3: Rewrite `createProject`**

In `src/features/projects/projects.queries.ts`, delete `normalizeRepositoryUrl`
entirely, add `import { createProjectLink, normalizeLinkUrl } from "./project-links.queries";`,
and replace `createProject`:

```ts
export async function createProject(client: Client, input: CreateProjectInput) {
  // Validated before any write so a malformed URL cannot leave a project behind.
  const repositoryUrl = input.repositoryUrl?.trim() ? normalizeLinkUrl(input.repositoryUrl) : null;

  const { data, error } = await client
    .from("projects")
    .insert({
      workspace_id: input.workspaceId,
      created_by: input.userId,
      name: input.name,
      description: input.description || null,
      status: input.status,
      priority: input.priority,
      health: input.health,
    })
    .select("*")
    .single();

  if (error) throw error;

  if (!repositoryUrl) return { project: data, linkError: null };

  // The project exists by now. Throwing here would invite a retry that creates
  // a second project, so the failure is reported alongside the project instead.
  try {
    await createProjectLink(client, {
      workspaceId: input.workspaceId,
      projectId: data.id,
      userId: input.userId,
      linkType: "repository",
      label: "Repository",
      url: repositoryUrl,
    });
  } catch (cause) {
    return {
      project: data,
      linkError: cause instanceof Error ? cause.message : "The repository link could not be saved.",
    };
  }

  return { project: data, linkError: null };
}
```

- [ ] **Step 4: Update the types and fixtures**

In `src/lib/supabase/database.types.ts`:
- Delete the whole `subtasks: { ... };` block.
- Delete `repository_url` from the `projects` `Row`, `Insert`, and `Update`.

Then delete every `repository_url` line from these fixtures:

- `src/dev/orbit-flo-visual-fixtures.ts:56`
- `src/features/calendar/calendar-page.test.tsx:63`
- `src/features/inbox/inbox-page.test.tsx:92`
- `src/features/projects/project-health.test.ts:18`
- `src/features/projects/projects-page.test.tsx:64`
- `src/features/projects/project-workspace-page.test.tsx:319`
- `src/features/daily/daily-mission-control-page.test.tsx:168`

Run `npx tsc -b` and fix anything it flags; it is the reliable way to find a
missed site.

- [ ] **Step 5: Update `ProjectsPage`**

In `src/features/projects/projects-page.tsx`:
- Delete `safeRepositoryUrl` and the `normalizeRepositoryUrl` import.
- Add `import { listRepositoryLinks } from "./project-links.queries";`
- Add a query keyed on the listed project ids:

```tsx
  const projectIds = (projectsQuery.data ?? []).map((project) => project.id);

  const repositoryLinksQuery = useQuery({
    queryKey: ["project-links", "repository", workspaceId, projectIds],
    queryFn: () => listRepositoryLinks(supabase, { workspaceId: workspaceId ?? "", projectIds }),
    enabled: Boolean(workspaceId) && projectIds.length > 0,
  });

  // A links failure must not take the project list down with it.
  const repositoryUrls = repositoryLinksQuery.data ?? new Map<string, string>();
```

- Replace `const repositoryUrl = safeRepositoryUrl(project.repository_url);` with
  `const repositoryUrl = repositoryUrls.get(project.id) ?? null;`. The
  surrounding JSX is unchanged.

- Where `createProject` is called (around line 78), the mutation now receives
  `{ project, linkError }`. Keep the existing success behaviour on `project`,
  and render `linkError` as an `InlineAlert` reading
  *Project created, but the repository link could not be saved.* Follow the
  `InlineAlert` usage already in the file.

- [ ] **Step 6: Update the projects page test**

In `src/features/projects/projects-page.test.tsx`, re-point the existing
repository-link assertion at the links query: have the Supabase mock answer a
`project_links` select with one `repository` row for the project, and assert the
card still renders that anchor.

- [ ] **Step 7: Run the projects tests**

```bash
npx vitest run --maxWorkers=2 src/features/projects src/features/calendar src/features/inbox src/features/daily
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src && git commit -m "feat: source project repository links from project_links"
```

---

### Task 6: Verification

- [ ] **Step 1: Typecheck and build**

```bash
npm run build
```

Expected: `tsc -b` silent, vite build succeeds.

- [ ] **Step 2: Full suite**

```bash
npx vitest run --maxWorkers=2
```

Expected: every file passes. Baseline before this plan was 87 files / 470 tests.

- [ ] **Step 3: Confirm nothing references the dropped structures**

```bash
git grep -n "repository_url\|normalizeRepositoryUrl\|safeRepositoryUrl\|subtasks" -- src
```

Expected: no matches. Any hit is a missed site.

- [ ] **Step 4: Verify in the browser**

Only after the user confirms `npx supabase db push` succeeded. Start the preview
(`preview_start` with `orbit-flo-worktree`), open a project workspace, expand the
project brief, and confirm: the links panel renders, adding a link persists
across a reload, the hostname line is right, and a `javascript:` URL is
refused with the validation message. Check the projects list still shows the
repository link. Screenshot the panel at 1440px and 390px.

- [ ] **Step 5: Open the PR**

```bash
git push -u origin codex/project-links
```

Describe: the three orphans and what happened to each, the consolidation of
project URLs, the URL-safety rule, the `createProject` partial-failure
contract, and what was verified in a browser versus by tests alone. State
plainly that the migration must be pushed before the feature works.

- [ ] **Step 6: Merge once CI is green**

```bash
gh pr checks <number> --watch --interval 15
```

Then squash-merge.
