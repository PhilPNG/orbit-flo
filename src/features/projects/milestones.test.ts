import { describe, expect, it, vi } from "vitest";
import { createMilestone, listProjectMilestones, updateMilestone } from "./milestones.queries";

function createQueryClient(result: { data: unknown; error: unknown } = { data: [], error: null }) {
  const query = {
    ...result,
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    insert: vi.fn(() => query),
    update: vi.fn(() => query),
    order: vi.fn(() => query),
    single: vi.fn(() => result),
  };

  return {
    client: {
      from: vi.fn(() => query),
    },
    query,
  };
}

describe("listProjectMilestones", () => {
  it("loads milestones scoped by workspace and project in target order", async () => {
    const { client, query } = createQueryClient();

    await listProjectMilestones(client as never, "workspace-1", "project-1");

    expect(client.from).toHaveBeenCalledWith("milestones");
    expect(query.eq).toHaveBeenNthCalledWith(1, "workspace_id", "workspace-1");
    expect(query.eq).toHaveBeenNthCalledWith(2, "project_id", "project-1");
    expect(query.order).toHaveBeenNthCalledWith(1, "target_date", { ascending: true, nullsFirst: false });
    expect(query.order).toHaveBeenNthCalledWith(2, "sort_order", { ascending: true });
  });
});

describe("createMilestone", () => {
  it("creates a workspace and project scoped milestone", async () => {
    const { client, query } = createQueryClient({ data: { id: "milestone-1" }, error: null });

    await createMilestone(client as never, {
      workspaceId: "workspace-1",
      projectId: "project-1",
      userId: "user-1",
      title: "Beta launch",
      description: "Invite first testers",
      targetDate: "2026-07-18",
      sortOrder: 2,
    });

    expect(query.insert).toHaveBeenCalledWith({
      workspace_id: "workspace-1",
      project_id: "project-1",
      created_by: "user-1",
      title: "Beta launch",
      description: "Invite first testers",
      target_date: "2026-07-18",
      sort_order: 2,
    });
    expect(query.select).toHaveBeenCalledWith("*");
    expect(query.single).toHaveBeenCalled();
  });
});

describe("updateMilestone", () => {
  it("updates editable fields and completion state scoped to workspace and project", async () => {
    const { client, query } = createQueryClient({ data: { id: "milestone-1" }, error: null });

    await updateMilestone(client as never, {
      id: "milestone-1",
      workspaceId: "workspace-1",
      projectId: "project-1",
      title: "Beta launch",
      description: "Ready the invite flow",
      targetDate: "2026-07-19",
      completedAt: "2026-07-20T00:00:00.000Z",
      sortOrder: 3,
    });

    expect(query.update).toHaveBeenCalledWith({
      title: "Beta launch",
      description: "Ready the invite flow",
      target_date: "2026-07-19",
      completed_at: "2026-07-20T00:00:00.000Z",
      sort_order: 3,
    });
    expect(query.eq).toHaveBeenNthCalledWith(1, "id", "milestone-1");
    expect(query.eq).toHaveBeenNthCalledWith(2, "workspace_id", "workspace-1");
    expect(query.eq).toHaveBeenNthCalledWith(3, "project_id", "project-1");
  });
});
