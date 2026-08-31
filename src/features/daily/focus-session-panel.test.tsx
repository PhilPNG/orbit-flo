import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Database } from "../../lib/supabase/database.types";
import { FocusSessionPanel } from "./focus-session-panel";
import type { DailyPlanItemWithWorkItem } from "./daily-plan.queries";

type DailyPlanItem = Database["public"]["Tables"]["daily_plan_items"]["Row"];
type WorkItem = Database["public"]["Tables"]["work_items"]["Row"];

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
    title: "Calibrate launch sequence",
    description: "A quiet deep-work target.",
    status: "ready",
    priority: "high",
    due_date: "2026-07-02",
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

function planItem(overrides: Partial<DailyPlanItemWithWorkItem> = {}): DailyPlanItemWithWorkItem {
  return {
    ...dailyPlanItem(overrides),
    workItem: workItem(overrides.workItem ?? {}),
  };
}

describe("FocusSessionPanel", () => {
  it("launches and pauses a focus session around the primary objective", async () => {
    const user = userEvent.setup();

    render(<FocusSessionPanel items={[planItem()]} />);

    expect(screen.getByRole("heading", { name: "Calibrate launch sequence" })).toBeTruthy();
    expect(screen.getByText("25:00")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Launch focus session" }));

    expect(screen.getByText("In focus")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Pause focus session" })).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Pause focus session" }));

    expect(screen.getByText("Paused")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Resume focus session" })).toBeTruthy();
  });

  it("adds cockpit glow while a focus session is running", async () => {
    const user = userEvent.setup();

    render(<FocusSessionPanel items={[planItem()]} />);

    const cockpit = screen.getByLabelText("Drop task into Focus Cockpit");
    expect(cockpit).not.toHaveClass("orbit-focus-active");

    await user.click(screen.getByRole("button", { name: "Launch focus session" }));

    expect(cockpit).toHaveClass("orbit-focus-active");
  });

  it("captures distractions without leaving focus mode", async () => {
    const user = userEvent.setup();

    render(<FocusSessionPanel items={[planItem()]} />);

    await user.type(screen.getByLabelText("Distraction capture"), "Check deploy logs later");
    await user.click(screen.getByRole("button", { name: "Park distraction" }));

    expect(screen.getByText("Check deploy logs later")).toBeTruthy();
    expect(screen.getByLabelText("Distraction capture")).toHaveValue("");
  });

  it("accepts a dragged task into focus mode", () => {
    const onDropWorkItem = vi.fn();

    render(<FocusSessionPanel items={[planItem()]} onDropWorkItem={onDropWorkItem} />);

    fireEvent.drop(screen.getByLabelText("Drop task into Focus Cockpit"), {
      dataTransfer: {
        getData: () => "work-item-2",
      },
    });

    expect(onDropWorkItem).toHaveBeenCalledWith("work-item-2");
  });

  it("saves work session notes", async () => {
    const user = userEvent.setup();
    const onSaveSessionNote = vi.fn();

    render(<FocusSessionPanel items={[planItem()]} onSaveSessionNote={onSaveSessionNote} />);

    await user.type(screen.getByLabelText("Work session notes"), "Shipped the first pass.");
    await user.click(screen.getByRole("button", { name: "Save session note" }));

    expect(onSaveSessionNote).toHaveBeenCalledWith({
      body: "Shipped the first pass.",
      workItemId: "work-item-1",
      title: "Session note: Calibrate launch sequence",
    });
    expect(screen.getByLabelText("Work session notes")).toHaveValue("");
  });

  it("completes the primary objective from focus mode", async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();

    render(<FocusSessionPanel items={[planItem()]} onComplete={onComplete} />);

    await user.click(screen.getByRole("button", { name: "Complete focus objective" }));

    expect(onComplete).toHaveBeenCalledWith("daily-plan-item-1");
  });

  it("disables session controls when the primary objective is already terminal", () => {
    render(<FocusSessionPanel items={[planItem({ state: "completed" })]} />);

    expect(screen.getByRole("button", { name: "Launch focus session" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Complete focus objective" })).toBeDisabled();
  });
});
