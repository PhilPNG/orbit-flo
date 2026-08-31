import { describe, expect, it, vi } from "vitest";
import type { Database } from "../../lib/supabase/database.types";
import {
  createWorkItem,
  groupWorkItemsByStatus,
  listDueWorkItems,
  listWorkspaceWorkItems,
  listWorkItems,
  updateWorkItemDetails,
  updateWorkItemStatus,
} from "./work-items.queries";

type WorkItem = Database["public"]["Tables"]["work_items"]["Row"];

function workItem(overrides: Partial<WorkItem>): WorkItem {
  return {
    id: "work-item-1",
    workspace_id: "workspace-1",
    project_id: "project-1",
    milestone_id: null,
    assigned_to: null,
    column_id: null,
    recurrence_rule_id: null,
    occurrence_date: null,
    planned_at: null,
    planned_minutes: null,
    title: "Work item",
    description: null,
    status: "backlog",
    priority: "medium",
    due_date: null,
    estimate_points: null,
    sort_order: 0,
    blocked_reason: null,
    created_by: "user-1",
    created_at: "2026-06-28T00:00:00.000Z",
    updated_at: "2026-06-28T00:00:00.000Z",
    completed_at: null,
    ...overrides,
  };
}

function createQueryClient(result: { data: unknown; error: unknown } = { data: [], error: null }) {
  const query = {
    ...result,
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    order: vi.fn(() => query),
    update: vi.fn(() => query),
    insert: vi.fn(() => query),
    gte: vi.fn(() => query),
    lte: vi.fn(() => query),
    neq: vi.fn(() => query),
    single: vi.fn(() => result),
  };

  return {
    client: {
      from: vi.fn(() => query),
    },
    query,
  };
}

describe("groupWorkItemsByStatus", () => {
  it("creates every board column even when no cards exist", () => {
    const grouped = groupWorkItemsByStatus([]);
    expect(Object.keys(grouped)).toEqual(["backlog", "ready", "in_progress", "blocked", "review", "done"]);
  });

  it("places non-empty items into their status columns", () => {
    const backlogItem = workItem({ id: "backlog-1", status: "backlog" });
    const reviewItem = workItem({ id: "review-1", status: "review" });

    const grouped = groupWorkItemsByStatus([backlogItem, reviewItem]);

    expect(grouped.backlog).toEqual([backlogItem]);
    expect(grouped.review).toEqual([reviewItem]);
    expect(grouped.done).toEqual([]);
  });
});

describe("createWorkItem", () => {
  it("persists an optional due date when launching work", async () => {
    const dueItem = workItem({ due_date: "2026-07-14" });
    const { client, query } = createQueryClient({ data: dueItem, error: null });

    await createWorkItem(client as never, {
      workspaceId: "workspace-1",
      projectId: "project-1",
      userId: "user-1",
      title: "Plan launch window",
      description: "Coordinate the release checklist",
      priority: "high",
      status: "ready",
      dueDate: "2026-07-14",
    });

    expect(query.insert).toHaveBeenCalledWith({
      workspace_id: "workspace-1",
      project_id: "project-1",
      created_by: "user-1",
      title: "Plan launch window",
      description: "Coordinate the release checklist",
      priority: "high",
      status: "ready",
      due_date: "2026-07-14",
    });
  });
});

describe("listDueWorkItems", () => {
  it("loads active work due inside a workspace date range", async () => {
    const { client, query } = createQueryClient();

    await listDueWorkItems(client as never, {
      workspaceId: "workspace-1",
      startDate: "2026-07-01",
      endDate: "2026-07-31",
    });

    expect(client.from).toHaveBeenCalledWith("work_items");
    expect(query.eq).toHaveBeenCalledWith("workspace_id", "workspace-1");
    expect(query.neq).toHaveBeenCalledWith("status", "done");
    expect(query.gte).toHaveBeenCalledWith("due_date", "2026-07-01");
    expect(query.lte).toHaveBeenCalledWith("due_date", "2026-07-31");
    expect(query.order).toHaveBeenNthCalledWith(1, "due_date", { ascending: true });
    expect(query.order).toHaveBeenNthCalledWith(2, "priority", { ascending: true });
  });
});

describe("listWorkItems", () => {
  it("scopes work items by workspace and project with stable ordering", async () => {
    const { client, query } = createQueryClient();

    await listWorkItems(client as never, "workspace-1", "project-1");

    expect(client.from).toHaveBeenCalledWith("work_items");
    expect(query.eq).toHaveBeenNthCalledWith(1, "workspace_id", "workspace-1");
    expect(query.eq).toHaveBeenNthCalledWith(2, "project_id", "project-1");
    expect(query.order).toHaveBeenNthCalledWith(1, "sort_order", { ascending: true });
    expect(query.order).toHaveBeenNthCalledWith(2, "created_at", { ascending: true });
  });
});

describe("listWorkspaceWorkItems", () => {
  it("loads all workspace work items for project health automation", async () => {
    const { client, query } = createQueryClient();

    await listWorkspaceWorkItems(client as never, "workspace-1");

    expect(client.from).toHaveBeenCalledWith("work_items");
    expect(query.eq).toHaveBeenCalledWith("workspace_id", "workspace-1");
    expect(query.order).toHaveBeenCalledWith("updated_at", { ascending: false });
  });
});

describe("updateWorkItemStatus", () => {
  it("scopes status updates by id, workspace, and project", async () => {
    const { client, query } = createQueryClient({ data: workItem({ status: "done" }), error: null });

    await updateWorkItemStatus(client as never, {
      id: "work-item-1",
      workspaceId: "workspace-1",
      projectId: "project-1",
      status: "done",
    });

    expect(query.update).toHaveBeenCalledWith({
      status: "done",
      completed_at: expect.any(String),
    });
    expect(query.eq).toHaveBeenNthCalledWith(1, "id", "work-item-1");
    expect(query.eq).toHaveBeenNthCalledWith(2, "workspace_id", "workspace-1");
    expect(query.eq).toHaveBeenNthCalledWith(3, "project_id", "project-1");
  });
});

describe("updateWorkItemDetails", () => {
  it("updates editable task details scoped to the project", async () => {
    const { client, query } = createQueryClient({ data: workItem({ title: "Updated task" }), error: null });

    await updateWorkItemDetails(client as never, {
      id: "work-item-1",
      workspaceId: "workspace-1",
      projectId: "project-1",
      title: "Updated task",
      description: "New notes",
      priority: "critical",
      status: "blocked",
      dueDate: "2026-07-18",
      blockedReason: "Waiting on access",
      milestoneId: "milestone-1",
      plannedAt: "14:30",
      plannedMinutes: 45,
    });

    expect(query.update).toHaveBeenCalledWith({
      milestone_id: "milestone-1",
      title: "Updated task",
      description: "New notes",
      priority: "critical",
      status: "blocked",
      due_date: "2026-07-18",
      blocked_reason: "Waiting on access",
      planned_at: "14:30",
      planned_minutes: 45,
      completed_at: null,
    });
    expect(query.eq).toHaveBeenNthCalledWith(1, "id", "work-item-1");
    expect(query.eq).toHaveBeenNthCalledWith(2, "workspace_id", "workspace-1");
    expect(query.eq).toHaveBeenNthCalledWith(3, "project_id", "project-1");
  });

  it("assigns and unassigns without touching other fields", async () => {
    const { client, query } = createQueryClient({ data: workItem({}), error: null });

    await updateWorkItemDetails(client as never, {
      id: "work-item-1",
      workspaceId: "workspace-1",
      projectId: "project-1",
      title: "Task",
      priority: "medium",
      status: "ready",
      assignedTo: "user-2",
    });

    expect(query.update).toHaveBeenCalledWith(
      expect.objectContaining({ assigned_to: "user-2" }),
    );
    // Nothing else the caller omitted may be written.
    expect(query.update).not.toHaveBeenCalledWith(
      expect.objectContaining({ milestone_id: expect.anything() }),
    );
  });

  it("clears the assignee when given an empty value", async () => {
    const { client, query } = createQueryClient({ data: workItem({}), error: null });

    await updateWorkItemDetails(client as never, {
      id: "work-item-1",
      workspaceId: "workspace-1",
      projectId: "project-1",
      title: "Task",
      priority: "medium",
      status: "ready",
      assignedTo: "",
    });

    expect(query.update).toHaveBeenCalledWith(expect.objectContaining({ assigned_to: null }));
  });

  it("leaves out fields the caller never provided", async () => {
    const { client, query } = createQueryClient({ data: workItem({}), error: null });

    await updateWorkItemDetails(client as never, {
      id: "work-item-1",
      workspaceId: "workspace-1",
      projectId: "project-1",
      title: "Renamed only",
      priority: "medium",
      status: "ready",
    });

    // Writing every column unconditionally is how the calendar used to wipe
    // milestones: it simply never passed one.
    expect(query.update).toHaveBeenCalledWith({
      title: "Renamed only",
      priority: "medium",
      status: "ready",
      completed_at: null,
    });
  });

  it("still clears a field when given an empty value", async () => {
    const { client, query } = createQueryClient({ data: workItem({}), error: null });

    await updateWorkItemDetails(client as never, {
      id: "work-item-1",
      workspaceId: "workspace-1",
      projectId: "project-1",
      title: "Cleared",
      priority: "medium",
      status: "ready",
      milestoneId: "",
      dueDate: "",
      plannedMinutes: null,
    });

    expect(query.update).toHaveBeenCalledWith(
      expect.objectContaining({ milestone_id: null, due_date: null, planned_minutes: null }),
    );
  });
});
