import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Database } from "../../lib/supabase/database.types";
import { SuggestedFlightPlan } from "./suggested-flight-plan";

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
    title: "Fix checkout outage",
    description: null,
    status: "ready",
    priority: "critical",
    due_date: "2026-06-30",
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

describe("SuggestedFlightPlan", () => {
  it("explains why work is suggested", () => {
    render(
      <SuggestedFlightPlan
        availableWorkItems={[workItem()]}
        dailyPlanItems={[]}
        isAdding={false}
        onAdd={() => undefined}
        todayKey="2026-07-01"
      />,
    );

    expect(screen.getByText("Why this?")).toBeTruthy();
    expect(screen.getByText("Overdue")).toBeTruthy();
    expect(screen.getByText("Critical priority")).toBeTruthy();
    expect(screen.getByText("Project project-")).toBeVisible();
    expect(screen.getByText("critical")).toBeVisible();
    expect(screen.getByRole("listitem")).toHaveClass("today-suggestion-row");
    expect(screen.getByRole("button", { name: "Add Fix checkout outage to today" })).toBeVisible();
  });

  it("shows the linked project name", () => {
    render(
      <SuggestedFlightPlan
        availableWorkItems={[workItem()]}
        dailyPlanItems={[]}
        isAdding={false}
        onAdd={() => undefined}
        projectNamesById={{ "project-1": "PocketPup" }}
        todayKey="2026-07-01"
      />,
    );

    expect(screen.getByText("PocketPup")).toBeVisible();
    expect(screen.queryByText("Project task")).toBeNull();
  });

  it("shows a planned chip when a time and duration are set", () => {
    render(
      <SuggestedFlightPlan
        availableWorkItems={[workItem({ planned_at: "14:30:00", planned_minutes: 45 })]}
        dailyPlanItems={[]}
        isAdding={false}
        onAdd={() => undefined}
        todayKey="2026-07-01"
      />,
    );

    expect(screen.getByText("2:30 PM · 45m")).toBeVisible();
  });

  it("omits the planned chip when nothing is planned", () => {
    render(
      <SuggestedFlightPlan
        availableWorkItems={[workItem()]}
        dailyPlanItems={[]}
        isAdding={false}
        onAdd={() => undefined}
        todayKey="2026-07-01"
      />,
    );

    expect(screen.queryByText(/PM ·/)).toBeNull();
  });
});
