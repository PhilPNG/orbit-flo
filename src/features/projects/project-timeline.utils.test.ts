import { describe, expect, it } from "vitest";
import type { Database } from "../../lib/supabase/database.types";
import { buildProjectTimelineEntries } from "./project-timeline.utils";

type Milestone = Database["public"]["Tables"]["milestones"]["Row"];
type WorkItem = Database["public"]["Tables"]["work_items"]["Row"];

function milestone(overrides: Partial<Milestone> = {}): Milestone {
  return {
    id: "milestone-1",
    workspace_id: "workspace-1",
    project_id: "project-1",
    title: "Launch milestone",
    description: null,
    target_date: null,
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
    title: "Timeline task",
    description: null,
    status: "ready",
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

describe("buildProjectTimelineEntries", () => {
  it("combines dated milestones and work items in date order before unscheduled entries", () => {
    const entries = buildProjectTimelineEntries({
      milestones: [
        milestone({ id: "unscheduled-milestone", target_date: null }),
        milestone({ id: "milestone-soon", target_date: "2026-07-12" }),
      ],
      workItems: [
        workItem({ id: "later-task", due_date: "2026-07-20" }),
        workItem({ id: "early-task", due_date: "2026-07-10" }),
        workItem({ id: "unscheduled-task", due_date: null }),
      ],
    });

    expect(entries.map((entry) => `${entry.type}:${entry.id}`)).toEqual([
      "task:early-task",
      "milestone:milestone-soon",
      "task:later-task",
      "milestone:unscheduled-milestone",
      "task:unscheduled-task",
    ]);
  });
});
