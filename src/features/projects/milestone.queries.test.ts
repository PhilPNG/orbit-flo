import { describe, expect, it, vi } from "vitest";
import { loadMilestone, milestoneQueryKey } from "./milestone.queries";

function createClient(
  options: {
    milestone?: { data: unknown; error: unknown };
    project?: { data: unknown; error: unknown };
    tasks?: { data: unknown; error: unknown };
  } = {},
) {
  const milestoneResult = options.milestone ?? {
    data: {
      id: "m1",
      project_id: "p1",
      title: "Ship the graph",
      description: "Do the thing",
      target_date: "2026-09-01",
      completed_at: null,
    },
    error: null,
  };
  const projectResult = options.project ?? { data: { name: "Orbit Flo" }, error: null };
  const tasksResult = options.tasks ?? {
    data: [{ id: "t1", title: "Task one" }],
    error: null,
  };

  const from = vi.fn((table: string) => {
    if (table === "milestones") {
      const builder = {
        select: vi.fn(() => builder),
        eq: vi.fn(() => builder),
        maybeSingle: vi.fn(() => Promise.resolve(milestoneResult)),
      };
      return builder;
    }

    if (table === "projects") {
      const builder = {
        select: vi.fn(() => builder),
        eq: vi.fn(() => builder),
        maybeSingle: vi.fn(() => Promise.resolve(projectResult)),
      };
      return builder;
    }

    // work_items
    const builder = {
      select: vi.fn(() => builder),
      eq: vi.fn(() => builder),
      order: vi.fn(() => Promise.resolve(tasksResult)),
    };
    return builder;
  });

  return { from };
}

describe("loadMilestone", () => {
  it("assembles the milestone, its project name and its ordered tasks", async () => {
    const client = createClient();

    const result = await loadMilestone(client as never, { workspaceId: "ws1", milestoneId: "m1" });

    expect(result).toEqual({
      id: "m1",
      projectId: "p1",
      projectName: "Orbit Flo",
      title: "Ship the graph",
      description: "Do the thing",
      targetDate: "2026-09-01",
      completedAt: null,
      tasks: [{ id: "t1", title: "Task one" }],
    });
  });

  it("scopes the milestone and task reads to the given workspace", async () => {
    const client = createClient();

    await loadMilestone(client as never, { workspaceId: "ws1", milestoneId: "m1" });

    expect(client.from).toHaveBeenCalledWith("milestones");
    expect(client.from).toHaveBeenCalledWith("projects");
    expect(client.from).toHaveBeenCalledWith("work_items");
  });

  it("returns null rather than throwing when the milestone is absent or hidden by RLS", async () => {
    const client = createClient({ milestone: { data: null, error: null } });

    const result = await loadMilestone(client as never, { workspaceId: "ws1", milestoneId: "missing" });

    expect(result).toBeNull();
  });

  it("defaults a null description to an empty string", async () => {
    const client = createClient({
      milestone: {
        data: {
          id: "m1",
          project_id: "p1",
          title: "Ship the graph",
          description: null,
          target_date: null,
          completed_at: null,
        },
        error: null,
      },
    });

    const result = await loadMilestone(client as never, { workspaceId: "ws1", milestoneId: "m1" });

    expect(result?.description).toBe("");
  });

  it("throws when the milestone query errors", async () => {
    const client = createClient({ milestone: { data: null, error: new Error("boom") } });

    await expect(
      loadMilestone(client as never, { workspaceId: "ws1", milestoneId: "m1" }),
    ).rejects.toThrow("boom");
  });

  it("throws when the tasks query errors", async () => {
    const client = createClient({ tasks: { data: null, error: new Error("tasks boom") } });

    await expect(
      loadMilestone(client as never, { workspaceId: "ws1", milestoneId: "m1" }),
    ).rejects.toThrow("tasks boom");
  });
});

describe("milestoneQueryKey", () => {
  it("is scoped by workspace and milestone", () => {
    expect(milestoneQueryKey("ws1", "m1")).toEqual(["milestone", "ws1", "m1"]);
  });
});
