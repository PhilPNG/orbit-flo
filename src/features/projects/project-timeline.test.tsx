import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Database } from "../../lib/supabase/database.types";
import { ProjectTimeline } from "./project-timeline";

type Milestone = Database["public"]["Tables"]["milestones"]["Row"];
type WorkItem = Database["public"]["Tables"]["work_items"]["Row"];

function milestone(overrides: Partial<Milestone> = {}): Milestone {
  return {
    id: "milestone-1",
    workspace_id: "workspace-1",
    project_id: "project-1",
    title: "Beta launch",
    description: "Invite first testers",
    target_date: "2026-07-15",
    completed_at: null,
    sort_order: 0,
    created_by: "user-1",
    created_at: "2026-06-28T00:00:00.000Z",
    updated_at: "2026-06-28T00:00:00.000Z",
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
    title: "Finish invite flow",
    description: null,
    status: "ready",
    priority: "high",
    due_date: "2026-07-10",
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

describe("ProjectTimeline", () => {
  it("renders tasks and milestones as timeline entries", () => {
    render(<ProjectTimeline milestones={[milestone()]} workItems={[workItem()]} />);

    expect(screen.getByRole("heading", { name: "Project Timeline" })).toBeTruthy();
    expect(screen.getByText("Finish invite flow")).toBeTruthy();
    expect(screen.getByText("Beta launch")).toBeTruthy();
    expect(screen.getByText("milestone")).toBeTruthy();
    expect(screen.getByText("task")).toBeTruthy();
  });
});
