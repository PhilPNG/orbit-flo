import { describe, expect, it } from "vitest";
import type { Database } from "../../lib/supabase/database.types";
import {
  calculateDailyPlanSummary,
  formatPlanDate,
  formatPlannedChip,
  getPrimaryDailyItem,
  getSuggestedDailyWorkItems,
  sortDailyPlanItems,
} from "./daily-plan.utils";

type DailyPlanItem = Database["public"]["Tables"]["daily_plan_items"]["Row"];
type WorkItem = Database["public"]["Tables"]["work_items"]["Row"];

function item(overrides: Partial<DailyPlanItem>): DailyPlanItem {
  return {
    id: "item-1",
    workspace_id: "workspace-1",
    daily_plan_id: "plan-1",
    work_item_id: "work-1",
    sort_order: 0,
    is_primary: false,
    state: "planned",
    completed_at: null,
    skipped_at: null,
    created_at: "2026-06-29T12:00:00.000Z",
    updated_at: "2026-06-29T12:00:00.000Z",
    ...overrides,
  };
}

function workItem(overrides: Partial<WorkItem> = {}): WorkItem {
  return {
    id: "work-1",
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
    created_at: "2026-06-29T12:00:00.000Z",
    updated_at: "2026-06-29T12:00:00.000Z",
    completed_at: null,
    ...overrides,
  };
}

describe("formatPlanDate", () => {
  it("returns a date-only string for the user's local day", () => {
    expect(formatPlanDate(new Date(2026, 5, 29, 9, 30))).toBe("2026-06-29");
  });
});

describe("sortDailyPlanItems", () => {
  it("orders items by sort order and then created time", () => {
    const sorted = sortDailyPlanItems([
      item({ id: "b", sort_order: 2, created_at: "2026-06-29T10:00:00.000Z" }),
      item({ id: "a", sort_order: 1, created_at: "2026-06-29T11:00:00.000Z" }),
      item({ id: "c", sort_order: 2, created_at: "2026-06-29T09:00:00.000Z" }),
    ]);

    expect(sorted.map((dailyItem) => dailyItem.id)).toEqual(["a", "c", "b"]);
  });
});

describe("getPrimaryDailyItem", () => {
  it("uses the explicit primary item when present", () => {
    expect(getPrimaryDailyItem([
      item({ id: "first", sort_order: 0 }),
      item({ id: "primary", sort_order: 1, is_primary: true }),
    ])?.id).toBe("primary");
  });

  it("falls back to the first planned item", () => {
    expect(getPrimaryDailyItem([
      item({ id: "done", sort_order: 0, state: "completed" }),
      item({ id: "planned", sort_order: 1, state: "planned" }),
    ])?.id).toBe("planned");
  });
});

describe("calculateDailyPlanSummary", () => {
  it("counts completed, skipped, planned, and completion percentage", () => {
    expect(calculateDailyPlanSummary([
      item({ id: "done", state: "completed" }),
      item({ id: "skip", state: "skipped" }),
      item({ id: "plan", state: "planned" }),
    ])).toEqual({
      total: 3,
      completed: 1,
      skipped: 1,
      planned: 1,
      completionPercent: 33,
    });
  });
});

describe("getSuggestedDailyWorkItems", () => {
  it("prioritizes overdue, due today, high priority work while excluding planned items", () => {
    const suggestions = getSuggestedDailyWorkItems(
      [
        workItem({ id: "later-low", priority: "low", due_date: "2026-07-30" }),
        workItem({ id: "overdue", priority: "medium", due_date: "2026-07-09" }),
        workItem({ id: "today", priority: "low", due_date: "2026-07-10" }),
        workItem({ id: "planned", priority: "critical", due_date: "2026-07-08" }),
        workItem({ id: "critical", priority: "critical", due_date: null }),
      ],
      [item({ work_item_id: "planned" })],
      "2026-07-10",
    );

    expect(suggestions.map((suggestion) => suggestion.id)).toEqual(["overdue", "today", "critical", "later-low"]);
  });
});

describe("formatPlannedChip", () => {
  it("formats time and duration together", () => {
    expect(formatPlannedChip("14:30:00", 45)).toBe("2:30 PM \u00b7 45m");
  });

  it("formats midnight and noon correctly", () => {
    expect(formatPlannedChip("00:05:00", null)).toBe("12:05 AM");
    expect(formatPlannedChip("12:00:00", null)).toBe("12:00 PM");
  });

  it("formats duration alone", () => {
    expect(formatPlannedChip(null, 30)).toBe("30m");
  });

  it("returns null when nothing is planned", () => {
    expect(formatPlannedChip(null, null)).toBeNull();
  });
});
