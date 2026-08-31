import { describe, expect, it } from "vitest";
import type { Database } from "../../lib/supabase/database.types";
import {
  addDailyPlanItem,
  completeDailyPlanItem,
  createCapture,
  getDailyMissionControlData,
  getOrCreateDailyPlan,
  resetDailyPlanItem,
  saveDailyReview,
  skipDailyPlanItem,
} from "./daily-plan.queries";

type QueryCall = {
  method: string;
  args: unknown[];
};

type QueryResponse = {
  data: unknown;
  error: unknown;
};

class FakeQuery {
  calls: QueryCall[] = [];

  constructor(private readonly response: QueryResponse) {}

  select(...args: unknown[]) {
    this.calls.push({ method: "select", args });
    return this;
  }

  upsert(...args: unknown[]) {
    this.calls.push({ method: "upsert", args });
    return this;
  }

  insert(...args: unknown[]) {
    this.calls.push({ method: "insert", args });
    return this;
  }

  update(...args: unknown[]) {
    this.calls.push({ method: "update", args });
    return this;
  }

  eq(...args: unknown[]) {
    this.calls.push({ method: "eq", args });
    return this;
  }

  neq(...args: unknown[]) {
    this.calls.push({ method: "neq", args });
    return this;
  }

  in(...args: unknown[]) {
    this.calls.push({ method: "in", args });
    return this;
  }

  is(...args: unknown[]) {
    this.calls.push({ method: "is", args });
    return this;
  }

  order(...args: unknown[]) {
    this.calls.push({ method: "order", args });
    return this;
  }

  limit(...args: unknown[]) {
    this.calls.push({ method: "limit", args });
    return this;
  }

  single() {
    this.calls.push({ method: "single", args: [] });
    return this;
  }

  maybeSingle() {
    this.calls.push({ method: "maybeSingle", args: [] });
    return this;
  }

  then<TResult1 = QueryResponse, TResult2 = never>(
    onfulfilled?: ((value: QueryResponse) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ) {
    return Promise.resolve(this.response).then(onfulfilled, onrejected);
  }
}

function isQueryResponse(response: unknown): response is QueryResponse {
  return response !== null && typeof response === "object" && "data" in response && "error" in response;
}

function createFakeClient(responses: Record<string, QueryResponse | QueryResponse[] | unknown>) {
  const queries: Record<string, FakeQuery[]> = {};
  const responseQueues = Object.fromEntries(
    Object.entries(responses).map(([table, response]) => [
      table,
      Array.isArray(response) && response.every(isQueryResponse) ? [...response] : [response],
    ]),
  );

  return {
    client: {
      from(table: string) {
        const response = responseQueues[table]?.shift();
        const query = new FakeQuery(isQueryResponse(response) ? response : { data: response ?? [], error: null });
        queries[table] = [...(queries[table] ?? []), query];
        return query;
      },
    },
    queries,
  };
}

function latestQuery(queries: Record<string, FakeQuery[]>, table: string) {
  const query = queries[table]?.at(-1);
  if (!query) throw new Error(`Missing query for ${table}`);
  return query;
}

type DailyPlan = Database["public"]["Tables"]["daily_plans"]["Row"];
type DailyPlanItem = Database["public"]["Tables"]["daily_plan_items"]["Row"];
type WorkItem = Database["public"]["Tables"]["work_items"]["Row"];

function dailyPlan(overrides: Partial<DailyPlan> = {}): DailyPlan {
  return {
    id: "daily-plan-1",
    workspace_id: "workspace-1",
    plan_date: "2026-06-29",
    status: "active",
    reflection: null,
    completed_count: 0,
    skipped_count: 0,

    recurring_missed_count: 0,
    created_by: "user-1",
    created_at: "2026-06-29T00:00:00.000Z",
    updated_at: "2026-06-29T00:00:00.000Z",
    ...overrides,
  };
}

function dailyPlanItem(overrides: Partial<DailyPlanItem> = {}): DailyPlanItem {
  return {
    id: "daily-plan-item-1",
    workspace_id: "workspace-1",
    daily_plan_id: "daily-plan-1",
    work_item_id: "work-item-1",
    sort_order: 0,
    is_primary: false,
    state: "planned",
    completed_at: null,
    skipped_at: null,
    created_at: "2026-06-29T00:00:00.000Z",
    updated_at: "2026-06-29T00:00:00.000Z",
    ...overrides,
  };
}

function workItem(overrides: Partial<WorkItem> = {}): WorkItem {
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
    status: "ready",
    priority: "medium",
    due_date: null,
    estimate_points: null,
    sort_order: 0,
    blocked_reason: null,
    created_by: "user-1",
    created_at: "2026-06-29T00:00:00.000Z",
    updated_at: "2026-06-29T00:00:00.000Z",
    completed_at: null,
    ...overrides,
  };
}

describe("getOrCreateDailyPlan", () => {
  it("returns an existing workspace and date scoped daily plan without inserting", async () => {
    const plan = dailyPlan();
    const { client, queries } = createFakeClient({ daily_plans: { data: plan, error: null } });

    const result = await getOrCreateDailyPlan(client as never, {
      workspaceId: "workspace-1",
      userId: "user-1",
      planDate: "2026-06-29",
    });

    expect(queries.daily_plans).toHaveLength(1);
    expect(queries.daily_plans[0].calls).toEqual([
      { method: "select", args: ["*"] },
      { method: "eq", args: ["workspace_id", "workspace-1"] },
      { method: "eq", args: ["plan_date", "2026-06-29"] },
      { method: "maybeSingle", args: [] },
    ]);
    expect(queries.daily_plans[0].calls.some((call) => call.method === "upsert")).toBe(false);
    expect(queries.daily_plans[0].calls.some((call) => call.method === "insert")).toBe(false);
    expect(result).toEqual(plan);
  });

  it("inserts a workspace and date scoped daily plan when none exists", async () => {
    const plan = dailyPlan();
    const { client, queries } = createFakeClient({
      daily_plans: [
        { data: null, error: null },
        { data: plan, error: null },
      ],
    });

    const result = await getOrCreateDailyPlan(client as never, {
      workspaceId: "workspace-1",
      userId: "user-1",
      planDate: "2026-06-29",
    });

    expect(queries.daily_plans).toHaveLength(2);
    expect(queries.daily_plans[0].calls).toEqual([
      { method: "select", args: ["*"] },
      { method: "eq", args: ["workspace_id", "workspace-1"] },
      { method: "eq", args: ["plan_date", "2026-06-29"] },
      { method: "maybeSingle", args: [] },
    ]);
    expect(queries.daily_plans[1].calls).toEqual([
      {
        method: "insert",
        args: [{ workspace_id: "workspace-1", plan_date: "2026-06-29", created_by: "user-1" }],
      },
      { method: "select", args: ["*"] },
      { method: "single", args: [] },
    ]);
    expect(result).toEqual(plan);
  });
});

describe("getDailyMissionControlData", () => {
  it("loads workspace scoped mission control data and joins active daily items to work items", async () => {
    const activePlan = dailyPlan();
    const olderPlanItem = dailyPlanItem({
      id: "older",
      work_item_id: "work-item-2",
      sort_order: 2,
      created_at: "2026-06-29T02:00:00.000Z",
    });
    const firstPlanItem = dailyPlanItem({
      id: "first",
      work_item_id: "work-item-1",
      sort_order: 1,
      created_at: "2026-06-29T01:00:00.000Z",
    });
    const otherPlanItem = dailyPlanItem({
      id: "other-plan",
      daily_plan_id: "daily-plan-2",
      work_item_id: "work-item-3",
    });
    const { client, queries } = createFakeClient({
      daily_plans: activePlan,
      daily_plan_items: [olderPlanItem, otherPlanItem, firstPlanItem],
      work_items: [
        { data: [workItem({ id: "work-item-1" }), workItem({ id: "work-item-2" })], error: null },
        { data: [workItem({ id: "work-item-1" }), workItem({ id: "work-item-2" })], error: null },
      ],
      captures: [{ id: "capture-1" }],
      milestones: [{ id: "milestone-1" }],
      projects: [{ id: "project-1" }],
    });

    const result = await getDailyMissionControlData(client as never, "workspace-1", "2026-06-29");

    expect(latestQuery(queries, "daily_plans").calls).toEqual([
      { method: "select", args: ["*"] },
      { method: "eq", args: ["workspace_id", "workspace-1"] },
      { method: "eq", args: ["plan_date", "2026-06-29"] },
      { method: "maybeSingle", args: [] },
    ]);
    expect(latestQuery(queries, "daily_plan_items").calls).toEqual([
      { method: "select", args: ["*"] },
      { method: "eq", args: ["workspace_id", "workspace-1"] },
      { method: "eq", args: ["daily_plan_id", "daily-plan-1"] },
      { method: "order", args: ["sort_order", { ascending: true }] },
    ]);
    expect(queries.work_items[0].calls).toEqual([
      { method: "select", args: ["*"] },
      { method: "eq", args: ["workspace_id", "workspace-1"] },
      { method: "neq", args: ["status", "done"] },
      { method: "order", args: ["updated_at", { ascending: false }] },
    ]);
    expect(queries.work_items[1].calls).toEqual([
      { method: "select", args: ["*"] },
      { method: "eq", args: ["workspace_id", "workspace-1"] },
      { method: "in", args: ["id", ["work-item-2", "work-item-1"]] },
    ]);
    expect(latestQuery(queries, "captures").calls).toEqual([
      { method: "select", args: ["*"] },
      { method: "eq", args: ["workspace_id", "workspace-1"] },
      { method: "is", args: ["processed_at", null] },
      { method: "order", args: ["created_at", { ascending: false }] },
      { method: "limit", args: [8] },
    ]);
    expect(latestQuery(queries, "milestones").calls).toEqual([
      { method: "select", args: ["*"] },
      { method: "eq", args: ["workspace_id", "workspace-1"] },
      { method: "is", args: ["completed_at", null] },
      { method: "order", args: ["target_date", { ascending: true }] },
      { method: "limit", args: [5] },
    ]);
    expect(latestQuery(queries, "projects").calls).toEqual([
      { method: "select", args: ["*"] },
      { method: "eq", args: ["workspace_id", "workspace-1"] },
      { method: "order", args: ["updated_at", { ascending: false }] },
    ]);
    expect(result.plan).toEqual(activePlan);
    expect(result.dailyPlanItems.map((item) => item.id)).toEqual(["first", "older"]);
    expect(result.dailyPlanItems.map((item) => item.workItem?.id)).toEqual(["work-item-1", "work-item-2"]);
    expect(result.availableWorkItems.map((item) => item.id)).toEqual(["work-item-1", "work-item-2"]);
    expect(result.captures).toEqual([{ id: "capture-1" }]);
    expect(result.milestones).toEqual([{ id: "milestone-1" }]);
    expect(result.projects).toEqual([{ id: "project-1" }]);
  });

  it("hydrates daily plan items linked to done work items while keeping done items unavailable", async () => {
    const activePlan = dailyPlan();
    const donePlanItem = dailyPlanItem({ work_item_id: "done-work-item" });
    const doneWorkItem = workItem({
      id: "done-work-item",
      title: "Finished but still planned",
      status: "done",
      completed_at: "2026-06-29T10:00:00.000Z",
    });
    const { client, queries } = createFakeClient({
      daily_plans: activePlan,
      daily_plan_items: [donePlanItem],
      work_items: [
        { data: [workItem({ id: "available-work-item" })], error: null },
        { data: [doneWorkItem], error: null },
      ],
      captures: [],
      milestones: [],
      projects: [],
    });

    const result = await getDailyMissionControlData(client as never, "workspace-1", "2026-06-29");

    expect(queries.work_items[0].calls).toContainEqual({ method: "neq", args: ["status", "done"] });
    expect(queries.work_items[1].calls).toContainEqual({ method: "in", args: ["id", ["done-work-item"]] });
    expect(result.availableWorkItems.map((item) => item.id)).toEqual(["available-work-item"]);
    expect(result.dailyPlanItems[0].workItem?.id).toBe("done-work-item");
    expect(result.dailyPlanItems[0].workItem?.title).toBe("Finished but still planned");
  });

  it("does not load daily plan items when no active plan exists", async () => {
    const { client, queries } = createFakeClient({
      daily_plans: { data: null, error: null },
      work_items: [workItem({ id: "work-item-1" })],
      captures: [{ id: "capture-1" }],
      milestones: [{ id: "milestone-1" }],
      projects: [{ id: "project-1" }],
    });

    const result = await getDailyMissionControlData(client as never, "workspace-1", "2026-06-29");

    expect(queries.daily_plan_items).toBeUndefined();
    expect(result.plan).toBeNull();
    expect(result.dailyPlanItems).toEqual([]);
    expect(result.availableWorkItems.map((item) => item.id)).toEqual(["work-item-1"]);
    expect(result.captures).toEqual([{ id: "capture-1" }]);
    expect(result.milestones).toEqual([{ id: "milestone-1" }]);
    expect(result.projects).toEqual([{ id: "project-1" }]);
  });
});

describe("addDailyPlanItem", () => {
  it("inserts a daily plan item scoped to workspace and plan", async () => {
    const item = dailyPlanItem();
    const { client, queries } = createFakeClient({ daily_plan_items: item });

    const result = await addDailyPlanItem(client as never, {
      workspaceId: "workspace-1",
      dailyPlanId: "daily-plan-1",
      workItemId: "work-item-1",
      sortOrder: 3,
      isPrimary: true,
    });

    const query = latestQuery(queries, "daily_plan_items");
    expect(query.calls).toContainEqual({
      method: "insert",
      args: [
        {
          workspace_id: "workspace-1",
          daily_plan_id: "daily-plan-1",
          work_item_id: "work-item-1",
          sort_order: 3,
          is_primary: true,
        },
      ],
    });
    expect(query.calls).toContainEqual({ method: "select", args: ["*"] });
    expect(query.calls).toContainEqual({ method: "single", args: [] });
    expect(result).toEqual(item);
  });
});

describe("completeDailyPlanItem", () => {
  it("updates only the workspace scoped daily plan item to completed", async () => {
    const item = dailyPlanItem({ state: "completed", completed_at: "2026-06-29T12:00:00.000Z" });
    const { client, queries } = createFakeClient({ daily_plan_items: item });

    await completeDailyPlanItem(client as never, { id: "daily-plan-item-1", workspaceId: "workspace-1" });

    const query = latestQuery(queries, "daily_plan_items");
    expect(query.calls).toContainEqual({
      method: "update",
      args: [{ state: "completed", completed_at: expect.any(String), skipped_at: null }],
    });
    expect(query.calls).toContainEqual({ method: "eq", args: ["id", "daily-plan-item-1"] });
    expect(query.calls).toContainEqual({ method: "eq", args: ["workspace_id", "workspace-1"] });
    expect(query.calls).toContainEqual({ method: "select", args: ["*"] });
    expect(query.calls).toContainEqual({ method: "single", args: [] });
  });
});

describe("skipDailyPlanItem", () => {
  it("updates only the workspace scoped daily plan item to skipped", async () => {
    const item = dailyPlanItem({ state: "skipped", skipped_at: "2026-06-29T12:00:00.000Z" });
    const { client, queries } = createFakeClient({ daily_plan_items: item });

    await skipDailyPlanItem(client as never, { id: "daily-plan-item-1", workspaceId: "workspace-1" });

    const query = latestQuery(queries, "daily_plan_items");
    expect(query.calls).toContainEqual({
      method: "update",
      args: [{ state: "skipped", skipped_at: expect.any(String), completed_at: null }],
    });
    expect(query.calls).toContainEqual({ method: "eq", args: ["id", "daily-plan-item-1"] });
    expect(query.calls).toContainEqual({ method: "eq", args: ["workspace_id", "workspace-1"] });
    expect(query.calls).toContainEqual({ method: "select", args: ["*"] });
    expect(query.calls).toContainEqual({ method: "single", args: [] });
  });
});

describe("resetDailyPlanItem", () => {
  it("moves only the workspace scoped daily plan item back to planned", async () => {
    const item = dailyPlanItem({ state: "planned", completed_at: null, skipped_at: null });
    const { client, queries } = createFakeClient({ daily_plan_items: item });

    await resetDailyPlanItem(client as never, { id: "daily-plan-item-1", workspaceId: "workspace-1" });

    const query = latestQuery(queries, "daily_plan_items");
    expect(query.calls).toContainEqual({
      method: "update",
      args: [{ state: "planned", completed_at: null, skipped_at: null }],
    });
    expect(query.calls).toContainEqual({ method: "eq", args: ["id", "daily-plan-item-1"] });
    expect(query.calls).toContainEqual({ method: "eq", args: ["workspace_id", "workspace-1"] });
    expect(query.calls).toContainEqual({ method: "select", args: ["*"] });
    expect(query.calls).toContainEqual({ method: "single", args: [] });
  });
});

describe("createCapture", () => {
  it("inserts an unprocessed capture scoped to workspace and user with null defaults", async () => {
    const capture = { id: "capture-1" };
    const { client, queries } = createFakeClient({ captures: capture });

    const result = await createCapture(client as never, {
      workspaceId: "workspace-1",
      userId: "user-1",
      type: "idea",
      title: "Capture this",
    });

    const query = latestQuery(queries, "captures");
    expect(query.calls).toContainEqual({
      method: "insert",
      args: [
        {
          workspace_id: "workspace-1",
          created_by: "user-1",
          type: "idea",
          title: "Capture this",
          body: null,
          project_id: null,
          work_item_id: null,
        },
      ],
    });
    expect(query.calls).toContainEqual({ method: "select", args: ["*"] });
    expect(query.calls).toContainEqual({ method: "single", args: [] });
    expect(result).toEqual(capture);
  });

  it("rejects captures linked to work items without a project before inserting", async () => {
    const { client, queries } = createFakeClient({ captures: { data: { id: "capture-1" }, error: null } });

    await expect(
      createCapture(client as never, {
        workspaceId: "workspace-1",
        userId: "user-1",
        type: "idea",
        title: "Capture this",
        workItemId: "work-item-1",
      }),
    ).rejects.toThrow("Captures linked to work items must include a project.");

    expect(queries.captures).toBeUndefined();
  });
});

describe("saveDailyReview", () => {
  it("completes a workspace scoped daily plan with reflection counts", async () => {
    const plan = dailyPlan({ status: "completed", reflection: "Good focus.", completed_count: 3, skipped_count: 1 });
    const { client, queries } = createFakeClient({ daily_plans: plan });

    const result = await saveDailyReview(client as never, {
      id: "daily-plan-1",
      workspaceId: "workspace-1",
      reflection: "Good focus.",
      completedCount: 3,
      skippedCount: 1,
    });

    const query = latestQuery(queries, "daily_plans");
    expect(query.calls).toContainEqual({
      method: "update",
      args: [
        {
          status: "completed",
          reflection: "Good focus.",
          completed_count: 3,
          skipped_count: 1,
        },
      ],
    });
    expect(query.calls).toContainEqual({ method: "eq", args: ["id", "daily-plan-1"] });
    expect(query.calls).toContainEqual({ method: "eq", args: ["workspace_id", "workspace-1"] });
    expect(query.calls).toContainEqual({ method: "select", args: ["*"] });
    expect(query.calls).toContainEqual({ method: "single", args: [] });
    expect(result).toEqual(plan);
  });
});
