import { describe, expect, it } from "vitest";
import type { Database } from "../../lib/supabase/database.types";
import { buildMissionStats, calculateProjectHealthSignal } from "./project-health";

type Project = Database["public"]["Tables"]["projects"]["Row"];
type WorkItem = Database["public"]["Tables"]["work_items"]["Row"];

function project(overrides: Partial<Project> = {}): Project {
  return {
    id: "project-1",
    workspace_id: "workspace-1",
    name: "Project",
    description: null,
    status: "active",
    priority: "medium",
    health: "good",
    color: null,
    rituals_title: null,
    is_favorite: false,
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
    title: "Work",
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

describe("calculateProjectHealthSignal", () => {
  it("blocks projects with blocked work", () => {
    const signal = calculateProjectHealthSignal(project(), [workItem({ status: "blocked" })], "2026-07-10");

    expect(signal.health).toBe("blocked");
    expect(signal.reason).toBe("Blocked work needs attention.");
  });

  it("marks overdue critical work as at risk", () => {
    const signal = calculateProjectHealthSignal(
      project(),
      [workItem({ priority: "critical", due_date: "2026-07-09" })],
      "2026-07-10",
    );

    expect(signal.health).toBe("at_risk");
    expect(signal.reason).toBe("Critical work is overdue.");
  });

  it("watches stale active projects", () => {
    const signal = calculateProjectHealthSignal(
      project({ updated_at: "2026-06-01T00:00:00.000Z" }),
      [],
      "2026-07-10",
    );

    expect(signal.health).toBe("watch");
    expect(signal.reason).toBe("No recent project activity.");
  });
});

describe("buildMissionStats", () => {
  it("counts active projects and good health, reporting the worst health word", () => {
    const stats = buildMissionStats([
      { status: "active", health: "good" },
      { status: "active", health: "watch" },
      { status: "paused", health: "good" },
    ]);

    expect(stats).toEqual({ active: 2, onTrack: 2, overall: "Watch" });
  });

  it("ranks blocked as the worst health", () => {
    const stats = buildMissionStats([
      { status: "active", health: "at_risk" },
      { status: "active", health: "blocked" },
    ]);

    expect(stats.overall).toBe("Blocked");
  });

  it("reports Nominal when every project is good", () => {
    expect(buildMissionStats([{ status: "active", health: "good" }]).overall).toBe("Nominal");
  });

  it("returns a dash with no projects", () => {
    expect(buildMissionStats([])).toEqual({ active: 0, onTrack: 0, overall: "\u2014" });
  });
});
