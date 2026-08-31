import { describe, expect, it } from "vitest";
import type { Database } from "../../lib/supabase/database.types";
import {
  buildCalendarWeeks,
  getDeadlineBuckets,
  getDeadlineTone,
  getDueDateStats,
  groupWorkItemsByDueDate,
} from "./calendar.utils";

type WorkItem = Database["public"]["Tables"]["work_items"]["Row"];

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
    title: "Calendar card",
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

describe("buildCalendarWeeks", () => {
  it("builds a stable six-week month grid with adjacent month days", () => {
    const weeks = buildCalendarWeeks(new Date("2026-07-10T12:00:00Z"));

    expect(weeks).toHaveLength(6);
    expect(weeks[0][0]).toMatchObject({ dateKey: "2026-06-28", isCurrentMonth: false });
    expect(weeks[0][3]).toMatchObject({ dateKey: "2026-07-01", isCurrentMonth: true });
    expect(weeks[5][6]).toMatchObject({ dateKey: "2026-08-08", isCurrentMonth: false });
  });
});

describe("groupWorkItemsByDueDate", () => {
  it("groups only dated work items by their date key", () => {
    const grouped = groupWorkItemsByDueDate([
      workItem({ id: "due-1", due_date: "2026-07-14" }),
      workItem({ id: "undated", due_date: null }),
      workItem({ id: "due-2", due_date: "2026-07-14" }),
    ]);

    expect(grouped.get("2026-07-14")?.map((item) => item.id)).toEqual(["due-1", "due-2"]);
    expect(grouped.has("undated")).toBe(false);
  });
});

describe("getDueDateStats", () => {
  it("counts due today, upcoming, and overdue active work", () => {
    const stats = getDueDateStats(
      [
        workItem({ id: "overdue", due_date: "2026-07-09" }),
        workItem({ id: "today", due_date: "2026-07-10" }),
        workItem({ id: "upcoming", due_date: "2026-07-14" }),
        workItem({ id: "done", due_date: "2026-07-08", status: "done" }),
      ],
      "2026-07-10",
    );

    expect(stats).toEqual({
      overdue: 1,
      dueToday: 1,
      upcoming: 1,
    });
  });
});

describe("getDeadlineBuckets", () => {
  it("groups active work into overdue, today, this week, and later buckets", () => {
    const buckets = getDeadlineBuckets(
      [
        workItem({ id: "overdue", due_date: "2026-07-09" }),
        workItem({ id: "today", due_date: "2026-07-10" }),
        workItem({ id: "week", due_date: "2026-07-13" }),
        workItem({ id: "later", due_date: "2026-07-25" }),
        workItem({ id: "done", due_date: "2026-07-08", status: "done" }),
        workItem({ id: "undated", due_date: null }),
      ],
      "2026-07-10",
    );

    expect(buckets.overdue.map((item) => item.id)).toEqual(["overdue"]);
    expect(buckets.today.map((item) => item.id)).toEqual(["today"]);
    expect(buckets.thisWeek.map((item) => item.id)).toEqual(["week"]);
    expect(buckets.later.map((item) => item.id)).toEqual(["later"]);
  });
});

describe("getDeadlineTone", () => {
  it("marks overdue, today, upcoming, and undated work", () => {
    expect(getDeadlineTone("2026-07-09", "2026-07-10")).toBe("overdue");
    expect(getDeadlineTone("2026-07-10", "2026-07-10")).toBe("today");
    expect(getDeadlineTone("2026-07-12", "2026-07-10")).toBe("upcoming");
    expect(getDeadlineTone(null, "2026-07-10")).toBe("none");
  });
});
