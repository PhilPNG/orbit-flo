import { describe, expect, it, vi } from "vitest";
import { createProject, listProjects, projectHealthTone, updateProjectFavorite } from "./projects.queries";

function createQueryClient(result: { data: unknown; error: unknown } = { data: [], error: null }) {
  const query = {
    ...result,
    select: vi.fn((..._args: unknown[]) => query),
    eq: vi.fn((..._args: unknown[]) => query),
    order: vi.fn((..._args: unknown[]) => query),
    update: vi.fn((..._args: unknown[]) => query),
    single: vi.fn(() => result),
  };

  return {
    client: {
      from: vi.fn(() => query),
    },
    query,
  };
}

describe("projectHealthTone", () => {
  it("maps health values to visual tones", () => {
    expect(projectHealthTone("good")).toBe("good");
    expect(projectHealthTone("watch")).toBe("warning");
    expect(projectHealthTone("at_risk")).toBe("danger");
    expect(projectHealthTone("blocked")).toBe("danger");
  });
});

// URL validation now lives in project-links.queries and is covered there;
// these assert how createProject composes the project and its repository link.
function createInsertClient(results: Record<string, { data: unknown; error: unknown }>) {
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

const baseProjectInput = {
  workspaceId: "workspace-1",
  userId: "user-1",
  name: "Mission",
  status: "active" as const,
  priority: "medium" as const,
  health: "good" as const,
};

describe("createProject", () => {
  it("writes the project then the repository link", async () => {
    const { client, calls } = createInsertClient({
      projects: { data: { id: "project-1" }, error: null },
      project_links: { data: { id: "link-1" }, error: null },
    });

    const result = await createProject(client as never, {
      ...baseProjectInput,
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
    const { client, calls } = createInsertClient({});

    await expect(
      createProject(client as never, { ...baseProjectInput, repositoryUrl: "javascript:alert(1)" }),
    ).rejects.toThrow("Links must start with http:// or https://.");

    expect(calls).toHaveLength(0);
  });

  it("skips the link when no URL is given", async () => {
    const { client, calls } = createInsertClient({
      projects: { data: { id: "project-1" }, error: null },
    });

    const result = await createProject(client as never, baseProjectInput);

    expect(calls.map((call) => call.table)).toEqual(["projects"]);
    expect(result.linkError).toBeNull();
  });

  it("returns the project with linkError when the link write fails", async () => {
    const { client } = createInsertClient({
      projects: { data: { id: "project-1" }, error: null },
      project_links: { data: null, error: { message: "permission denied" } },
    });

    const result = await createProject(client as never, {
      ...baseProjectInput,
      repositoryUrl: "https://github.com/example/repo",
    });

    expect(result.project).toMatchObject({ id: "project-1" });
    expect(result.linkError).toBe("permission denied");
  });
});

describe("listProjects", () => {
  it("orders favorites first, then recent updates", async () => {
    const { client, query } = createQueryClient();

    await listProjects(client as never, "workspace-1");

    expect(client.from).toHaveBeenCalledWith("projects");
    expect(query.eq).toHaveBeenCalledWith("workspace_id", "workspace-1");
    expect(query.order).toHaveBeenNthCalledWith(1, "is_favorite", { ascending: false });
    expect(query.order).toHaveBeenNthCalledWith(2, "updated_at", { ascending: false });
  });
});

describe("updateProjectFavorite", () => {
  it("updates is_favorite scoped by id and workspace", async () => {
    const { client, query } = createQueryClient({ data: { id: "project-1" }, error: null });

    await updateProjectFavorite(client as never, {
      id: "project-1",
      workspaceId: "workspace-1",
      isFavorite: true,
    });

    expect(query.update).toHaveBeenCalledWith({ is_favorite: true });
    expect(query.eq).toHaveBeenNthCalledWith(1, "id", "project-1");
    expect(query.eq).toHaveBeenNthCalledWith(2, "workspace_id", "workspace-1");
  });
});
