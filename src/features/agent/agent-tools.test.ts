import { QueryClient } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildAgentTools } from "./agent-tools";

vi.mock("../projects/projects.queries", () => ({
  listProjects: vi.fn().mockResolvedValue([{ id: "p1", name: "Orbit", status: "active" }]),
}));
vi.mock("../work-items/work-items.queries", () => ({
  // The title here must match what create_task's test passes in, because the
  // implementation interpolates the RETURNED row's title into its result text.
  createWorkItem: vi.fn().mockResolvedValue({ id: "w1", title: "Ship it", status: "backlog" }),
  updateWorkItemStatus: vi.fn().mockResolvedValue({ id: "w1", status: "done" }),
  workItemStatuses: ["backlog", "ready", "in_progress", "blocked", "review", "done"],
}));
vi.mock("../search/search.queries", () => ({
  searchWorkspace: vi.fn().mockResolvedValue([]),
}));
vi.mock("../daily/daily-plan.queries", () => ({
  getDailyMissionControlData: vi.fn().mockResolvedValue({ plan: null, workItems: [] }),
  createCapture: vi.fn().mockResolvedValue({ id: "c1", title: "Thought" }),
  completeDailyPlanItem: vi.fn().mockResolvedValue({ id: "d1", state: "completed" }),
}));

import { createWorkItem, updateWorkItemStatus } from "../work-items/work-items.queries";
import { completeDailyPlanItem } from "../daily/daily-plan.queries";

const context = () => ({
  client: {} as never,
  queryClient: new QueryClient(),
  workspaceId: "ws-1",
  userId: "user-1",
});

describe("buildAgentTools", () => {
  beforeEach(() => vi.clearAllMocks());

  it("exposes exactly the seven approved tools, and none of the dangerous ones", () => {
    const names = buildAgentTools(context()).map((tool) => tool.name).sort();

    expect(names).toEqual([
      "capture_thought",
      "complete_plan_item",
      "create_task",
      "get_flight_plan",
      "list_projects",
      "move_task",
      "search_workspace",
    ]);
  });

  it("gives every tool a description and an object schema, which is what the agent reasons from", () => {
    for (const tool of buildAgentTools(context())) {
      expect(tool.description.length).toBeGreaterThan(20);
      expect((tool.inputSchema as { type: string }).type).toBe("object");
    }
  });

  it("create_task calls the domain function with the context's workspace and user", async () => {
    const ctx = context();
    const create = buildAgentTools(ctx).find((tool) => tool.name === "create_task")!;

    const result = await create.execute({ projectId: "p1", title: "Ship it" });

    expect(createWorkItem).toHaveBeenCalledWith(ctx.client, {
      workspaceId: "ws-1",
      projectId: "p1",
      userId: "user-1",
      title: "Ship it",
      description: undefined,
      dueDate: undefined,
      priority: "medium",
      status: "backlog",
    });
    expect(result.content[0].text).toContain("Ship it");
  });

  it("mutating tools invalidate the caches the UI reads, which is what makes the agent's work appear live", async () => {
    const ctx = context();
    const invalidate = vi.spyOn(ctx.queryClient, "invalidateQueries");
    const move = buildAgentTools(ctx).find((tool) => tool.name === "move_task")!;

    await move.execute({ id: "w1", projectId: "p1", status: "done" });

    expect(updateWorkItemStatus).toHaveBeenCalled();
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["work-items"] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["workspace-work-items"] });
  });

  it("move_task refuses a status outside the enum instead of passing it through", async () => {
    const move = buildAgentTools(context()).find((tool) => tool.name === "move_task")!;

    const result = await move.execute({ id: "w1", projectId: "p1", status: "obliterated" });

    expect(updateWorkItemStatus).not.toHaveBeenCalled();
    expect(result.content[0].text).toContain("backlog");
  });

  it("refuses a task with a missing or empty title instead of writing 'undefined'", async () => {
    // String(undefined) is "undefined" - a successful-looking wrong row. The
    // schema's `required` is the agent's promise, not enforcement.
    const create = buildAgentTools(context()).find((tool) => tool.name === "create_task")!;

    const missing = await create.execute({ projectId: "p1" });
    const empty = await create.execute({ projectId: "p1", title: "   " });

    expect(createWorkItem).not.toHaveBeenCalled();
    expect(missing.content[0].text).toContain("title");
    expect(empty.content[0].text).toContain("title");
  });

  it("a throwing domain function becomes a text result, never an unhandled rejection", async () => {
    vi.mocked(completeDailyPlanItem).mockRejectedValueOnce(new Error("row-level security policy violation"));
    const complete = buildAgentTools(context()).find((tool) => tool.name === "complete_plan_item")!;

    const result = await complete.execute({ id: "d1" });

    expect(result.content[0].text).toContain("row-level security");
  });
});
