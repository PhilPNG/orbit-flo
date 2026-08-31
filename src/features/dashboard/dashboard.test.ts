import { describe, expect, it } from "vitest";
import type { ProjectPriority } from "../../lib/supabase/database.types";
import { formatPlanDate } from "../daily/daily-plan.utils";
import { getDashboardData, sortPriorityWork } from "./dashboard.queries";
import { formatDashboardDate, getDashboardTodayKey } from "./dashboard.utils";

type QueryCall = {
  method: string;
  args: unknown[];
};

class FakeQuery {
  calls: QueryCall[] = [];

  constructor(private readonly response: { data: unknown[]; error: null }) {}

  select(...args: unknown[]) {
    this.calls.push({ method: "select", args });
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

  then<TResult1 = { data: unknown[]; error: null }, TResult2 = never>(
    onfulfilled?: ((value: { data: unknown[]; error: null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ) {
    return Promise.resolve(this.response).then(onfulfilled, onrejected);
  }
}

function createFakeClient(responses: Record<string, unknown[]>) {
  const queries: Record<string, FakeQuery> = {};

  return {
    client: {
      from(table: string) {
        const query = new FakeQuery({ data: responses[table] ?? [], error: null });
        queries[table] = query;
        return query;
      },
    },
    queries,
  };
}

describe("sortPriorityWork", () => {
  it("orders critical work before high and medium work", () => {
    const items = [
      { id: "1", priority: "medium", updated_at: "2026-06-01T00:00:00Z" },
      { id: "2", priority: "critical", updated_at: "2026-06-01T00:00:00Z" },
      { id: "3", priority: "high", updated_at: "2026-06-01T00:00:00Z" },
    ] satisfies Array<{ id: string; priority: ProjectPriority; updated_at: string }>;

    expect(sortPriorityWork(items).map((item) => item.id)).toEqual(["2", "3", "1"]);
  });

  it("orders matching priorities by newest update first", () => {
    const items = [
      { id: "1", priority: "high", updated_at: "2026-06-01T00:00:00Z" },
      { id: "2", priority: "high", updated_at: "2026-06-03T00:00:00Z" },
      { id: "3", priority: "high", updated_at: "2026-06-02T00:00:00Z" },
    ] satisfies Array<{ id: string; priority: ProjectPriority; updated_at: string }>;

    expect(sortPriorityWork(items).map((item) => item.id)).toEqual(["2", "3", "1"]);
  });
});

describe("formatDashboardDate", () => {
  it("formats date-only values without timezone conversion", () => {
    expect(formatDashboardDate("2026-07-01")).toBe("Jul 1, 2026");
  });
});

describe("getDashboardTodayKey", () => {
  it("uses the app local date helper instead of a UTC ISO date slice", () => {
    const localLateEvening = new Date(2026, 6, 2, 23, 30);

    expect(getDashboardTodayKey(localLateEvening)).toBe(formatPlanDate(localLateEvening));
  });
});

describe("getDashboardData", () => {
  it("queries workspace-scoped dashboard data and derives dashboard sections", async () => {
    const milestones = Array.from({ length: 9 }, (_, index) => ({
      id: `milestone-${index + 1}`,
      target_date: `2026-07-${String(index + 1).padStart(2, "0")}`,
    }));
    const { client, queries } = createFakeClient({
      projects: [{ id: "project-1" }],
      work_items: [
        { id: "medium", priority: "medium", status: "ready", updated_at: "2026-06-03T00:00:00Z" },
        { id: "critical-old", priority: "critical", status: "in_progress", updated_at: "2026-06-01T00:00:00Z" },
        { id: "blocked-high", priority: "high", status: "blocked", updated_at: "2026-06-04T00:00:00Z" },
        { id: "critical-new", priority: "critical", status: "ready", updated_at: "2026-06-05T00:00:00Z" },
        { id: "low-1", priority: "low", status: "ready", updated_at: "2026-06-09T00:00:00Z" },
        { id: "low-2", priority: "low", status: "ready", updated_at: "2026-06-08T00:00:00Z" },
        { id: "low-3", priority: "low", status: "ready", updated_at: "2026-06-07T00:00:00Z" },
        { id: "low-4", priority: "low", status: "ready", updated_at: "2026-06-06T00:00:00Z" },
        {
          id: "overdue-low",
          priority: "low",
          status: "ready",
          due_date: "2026-07-01",
          updated_at: "2026-06-05T00:00:00Z",
        },
      ],
      milestones,
      notes: [{ id: "decision-1" }],
    });

    const result = await getDashboardData(
      client as unknown as Parameters<typeof getDashboardData>[0],
      "workspace-1",
    );

    expect(queries.projects.calls).toContainEqual({ method: "select", args: ["*"] });
    expect(queries.projects.calls).toContainEqual({ method: "eq", args: ["workspace_id", "workspace-1"] });
    expect(queries.projects.calls).toContainEqual({
      method: "order",
      args: ["updated_at", { ascending: false }],
    });
    expect(queries.work_items.calls).toContainEqual({ method: "eq", args: ["workspace_id", "workspace-1"] });
    expect(queries.work_items.calls).toContainEqual({ method: "neq", args: ["status", "done"] });
    expect(queries.milestones.calls).toContainEqual({ method: "eq", args: ["workspace_id", "workspace-1"] });
    expect(queries.milestones.calls).toContainEqual({ method: "is", args: ["completed_at", null] });
    expect(queries.milestones.calls).toContainEqual({
      method: "order",
      args: ["target_date", { ascending: true }],
    });
    expect(queries.notes.calls).toContainEqual({ method: "eq", args: ["workspace_id", "workspace-1"] });
    expect(queries.notes.calls).toContainEqual({ method: "eq", args: ["note_type", "decision"] });
    expect(queries.notes.calls).toContainEqual({ method: "limit", args: [5] });

    expect(result.projects).toEqual([{ id: "project-1" }]);
    expect(result.priorityWork.map((item) => item.id)).toEqual([
      "critical-new",
      "critical-old",
      "blocked-high",
      "medium",
      "low-1",
      "low-2",
      "low-3",
      "low-4",
      "overdue-low",
    ]);
    expect(result.blockedWork.map((item) => item.id)).toEqual(["blocked-high"]);
    expect(result.upcomingMilestones).toHaveLength(8);
    expect(result.upcomingMilestones.map((milestone) => milestone.id)).toEqual(
      milestones.slice(0, 8).map((milestone) => milestone.id),
    );
    expect(result.recentDecisions).toEqual([{ id: "decision-1" }]);
  });
});
