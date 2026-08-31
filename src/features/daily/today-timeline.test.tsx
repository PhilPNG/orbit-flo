import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Database } from "../../lib/supabase/database.types";
import { TodayTimeline } from "./today-timeline";
import type { DailyPlanItemWithWorkItem } from "./daily-plan.queries";

type DailyPlanItem = Database["public"]["Tables"]["daily_plan_items"]["Row"];
type WorkItem = Database["public"]["Tables"]["work_items"]["Row"];
type Capture = Database["public"]["Tables"]["captures"]["Row"];

function dailyPlanItem(overrides: Partial<DailyPlanItem> = {}): DailyPlanItem {
  return {
    id: "daily-plan-item-1",
    workspace_id: "workspace-1",
    daily_plan_id: "daily-plan-1",
    work_item_id: "work-item-1",
    sort_order: 0,
    is_primary: true,
    state: "planned",
    completed_at: null,
    skipped_at: null,
    created_at: "2026-07-01T09:00:00.000Z",
    updated_at: "2026-07-01T09:00:00.000Z",
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
    title: "Ship launch panel",
    description: null,
    status: "ready",
    priority: "high",
    due_date: "2026-07-01",
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

function capture(overrides: Partial<Capture> = {}): Capture {
  return {
    id: "capture-1",
    workspace_id: "workspace-1",
    project_id: null,
    work_item_id: null,
    type: "idea",
    title: "Pricing page idea",
    body: null,
    processed_at: null,
    created_by: "user-1",
    created_at: "2026-07-01T10:00:00.000Z",
    updated_at: "2026-07-01T10:00:00.000Z",
    ...overrides,
  };
}

describe("TodayTimeline", () => {
  it("renders today's planned work and captures as a timeline", () => {
    const item: DailyPlanItemWithWorkItem = {
      ...dailyPlanItem(),
      workItem: workItem(),
    };

    render(<TodayTimeline captures={[capture()]} items={[item]} />);

    expect(screen.getByRole("heading", { name: "Today Timeline" })).toBeTruthy();
    expect(screen.getByText("Ship launch panel")).toBeTruthy();
    expect(screen.getByText("Pricing page idea")).toBeTruthy();
  });
});
