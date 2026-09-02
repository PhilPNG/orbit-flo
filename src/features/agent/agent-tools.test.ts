import { QueryClient } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildAgentTools } from "./agent-tools";

vi.mock("../notes/notes.queries", () => ({
  listNotes: vi.fn().mockResolvedValue([{ id: "n1", note_type: "decision", title: "Launch on a Tuesday" }]),
  createNote: vi.fn().mockResolvedValue({ id: "n2", title: "Widget idea", note_type: "idea" }),
}));
vi.mock("../projects/milestones.queries", () => ({
  createMilestone: vi.fn().mockResolvedValue({ id: "m1", title: "Content freeze" }),
}));
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
  getDailyMissionControlData: vi.fn().mockResolvedValue({ plan: null, workItems: [], dailyPlanItems: [] }),
  createCapture: vi.fn().mockResolvedValue({ id: "c1", title: "Thought" }),
  completeDailyPlanItem: vi.fn().mockResolvedValue({ id: "d1", state: "completed" }),
  getOrCreateDailyPlan: vi.fn().mockResolvedValue({ id: "plan-1" }),
  addDailyPlanItem: vi.fn().mockResolvedValue({ id: "dpi-1" }),
}));
vi.mock("../inbox/captures.queries", () => ({
  listInboxCaptures: vi
    .fn()
    .mockResolvedValue([{ id: "c1", title: "Ask the agent to triage this inbox", type: "idea", body: null }]),
  updateCapture: vi.fn().mockResolvedValue({ id: "c1" }),
}));

import { createWorkItem, updateWorkItemStatus } from "../work-items/work-items.queries";
import { addDailyPlanItem, completeDailyPlanItem, getOrCreateDailyPlan } from "../daily/daily-plan.queries";
import { formatPlanDate } from "../daily/daily-plan.utils";
import { listInboxCaptures, updateCapture } from "../inbox/captures.queries";

const context = () => ({
  client: {} as never,
  queryClient: new QueryClient(),
  workspaceId: "ws-1",
  userId: "user-1",
});

describe("buildAgentTools", () => {
  beforeEach(() => vi.clearAllMocks());

  it("exposes exactly the ten approved tools, and none of the dangerous ones", () => {
    const names = buildAgentTools(context()).map((tool) => tool.name).sort();

    expect(names).toEqual([
      "add_to_flight_plan",
      "capture_thought",
      "complete_plan_item",
      "create_milestone",
      "create_note",
      "create_task",
      "file_capture_as_task",
      "get_flight_plan",
      "list_inbox",
      "list_notes",
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

  it("marks exactly the read-only tools with readOnlyHint, so a host can distinguish safe calls from mutations", () => {
    const readOnly = buildAgentTools(context())
      .filter((tool) => tool.annotations?.readOnlyHint === true)
      .map((tool) => tool.name)
      .sort();

    expect(readOnly).toEqual(["get_flight_plan", "list_inbox", "list_notes", "list_projects", "search_workspace"]);
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

  it("list_inbox returns the unprocessed captures as JSON", async () => {
    const list = buildAgentTools(context()).find((tool) => tool.name === "list_inbox")!;

    const result = await list.execute({});

    expect(listInboxCaptures).toHaveBeenCalled();
    expect(result.content[0].text).toContain("Ask the agent to triage this inbox");
  });

  it("list_inbox reports an empty inbox in words, not an empty array", async () => {
    vi.mocked(listInboxCaptures).mockResolvedValueOnce([]);
    const list = buildAgentTools(context()).find((tool) => tool.name === "list_inbox")!;

    const result = await list.execute({});

    expect(result.content[0].text).toBe("The inbox is empty.");
  });

  it("file_capture_as_task refuses a captureId that isn't in the unprocessed inbox", async () => {
    const file = buildAgentTools(context()).find((tool) => tool.name === "file_capture_as_task")!;

    const result = await file.execute({ captureId: "missing", projectId: "p1" });

    expect(createWorkItem).not.toHaveBeenCalled();
    expect(updateCapture).not.toHaveBeenCalled();
    expect(result.content[0].text.toLowerCase()).toContain("capture");
  });

  it("file_capture_as_task creates the task before marking the capture processed, so a mid-sequence failure never loses the capture", async () => {
    const ctx = context();
    const invalidate = vi.spyOn(ctx.queryClient, "invalidateQueries");
    const file = buildAgentTools(ctx).find((tool) => tool.name === "file_capture_as_task")!;

    const result = await file.execute({ captureId: "c1", projectId: "p1" });

    expect(createWorkItem).toHaveBeenCalledWith(
      ctx.client,
      expect.objectContaining({
        workspaceId: "ws-1",
        projectId: "p1",
        userId: "user-1",
        title: "Ask the agent to triage this inbox",
      }),
    );
    expect(updateCapture).toHaveBeenCalledWith(ctx.client, {
      id: "c1",
      workspaceId: "ws-1",
      projectId: "p1",
      processedAt: expect.any(String),
    });
    expect(vi.mocked(createWorkItem).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(updateCapture).mock.invocationCallOrder[0],
    );
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["inbox-captures"] });
    expect(result.content[0].text).toContain("Ship it");
  });

  it("add_to_flight_plan gets or creates today's plan, then appends the task to it", async () => {
    const ctx = context();
    const invalidate = vi.spyOn(ctx.queryClient, "invalidateQueries");
    const add = buildAgentTools(ctx).find((tool) => tool.name === "add_to_flight_plan")!;

    const result = await add.execute({ taskId: "w1" });

    expect(getOrCreateDailyPlan).toHaveBeenCalledWith(ctx.client, {
      workspaceId: "ws-1",
      userId: "user-1",
      planDate: formatPlanDate(),
    });
    expect(addDailyPlanItem).toHaveBeenCalledWith(ctx.client, {
      workspaceId: "ws-1",
      dailyPlanId: "plan-1",
      workItemId: "w1",
      sortOrder: 0,
      isPrimary: false,
    });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["daily-mission-control"] });
    expect(result.content[0].text).toContain("w1");
  });
});
