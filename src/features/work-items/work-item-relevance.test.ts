import { describe, expect, it } from "vitest";
import type { Database } from "../../lib/supabase/database.types";
import { groupWorkItemsByRelevance, isRelevantWorkItem } from "./work-item-relevance";

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

describe("isRelevantWorkItem", () => {
  const todayKey = "2026-07-02";

  it("treats overdue, today, within seven days, in progress, review, and blocked work as relevant", () => {
    expect(isRelevantWorkItem(workItem({ due_date: "2026-07-01" }), todayKey)).toBe(true);
    expect(isRelevantWorkItem(workItem({ due_date: "2026-07-02" }), todayKey)).toBe(true);
    expect(isRelevantWorkItem(workItem({ due_date: "2026-07-09" }), todayKey)).toBe(true);
    expect(isRelevantWorkItem(workItem({ status: "in_progress" }), todayKey)).toBe(true);
    expect(isRelevantWorkItem(workItem({ status: "review" }), todayKey)).toBe(true);
    expect(isRelevantWorkItem(workItem({ status: "blocked" }), todayKey)).toBe(true);
  });

  it("treats critical or high priority and blocked reason work as relevant", () => {
    expect(isRelevantWorkItem(workItem({ priority: "critical" }), todayKey)).toBe(true);
    expect(isRelevantWorkItem(workItem({ priority: "high" }), todayKey)).toBe(true);
    expect(isRelevantWorkItem(workItem({ blocked_reason: "Waiting on access" }), todayKey)).toBe(true);
  });

  it("treats done, distant future due date, and medium backlog work without a due date as later", () => {
    expect(isRelevantWorkItem(workItem({ status: "done", priority: "critical" }), todayKey)).toBe(false);
    expect(isRelevantWorkItem(workItem({ due_date: "2026-07-10" }), todayKey)).toBe(false);
    expect(isRelevantWorkItem(workItem({ status: "backlog", priority: "medium", due_date: null }), todayKey)).toBe(false);
  });
});

describe("groupWorkItemsByRelevance", () => {
  it("preserves input order within relevant and later buckets", () => {
    const relevantFirst = workItem({ id: "relevant-first", priority: "high" });
    const laterFirst = workItem({ id: "later-first", priority: "low", due_date: null });
    const relevantSecond = workItem({ id: "relevant-second", status: "review" });
    const laterSecond = workItem({ id: "later-second", priority: "medium", due_date: "2026-08-01" });

    const grouped = groupWorkItemsByRelevance(
      [relevantFirst, laterFirst, relevantSecond, laterSecond],
      "2026-07-02",
    );

    expect(grouped.relevant).toEqual([relevantFirst, relevantSecond]);
    expect(grouped.later).toEqual([laterFirst, laterSecond]);
  });
});
