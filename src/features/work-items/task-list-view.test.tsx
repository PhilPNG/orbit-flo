import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Database } from "../../lib/supabase/database.types";
import { TaskListView } from "./task-list-view";

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
    title: "Refine task list",
    description: null,
    status: "ready",
    priority: "high",
    due_date: "2026-07-14",
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

describe("TaskListView", () => {
  it("renders a compact task list and opens item details", async () => {
    const user = userEvent.setup();
    const onOpenItem = vi.fn();

    render(<TaskListView items={[workItem()]} onOpenItem={onOpenItem} />);

    expect(screen.getByRole("heading", { name: "Task List" })).toBeTruthy();
    expect(screen.getByText("Refine task list")).toBeTruthy();
    expect(screen.getByText("Due 2026-07-14")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Open Refine task list" }));

    expect(onOpenItem).toHaveBeenCalledWith("work-item-1");
  });

  it("shows hover preview details for a task", async () => {
    const user = userEvent.setup();

    render(
      <TaskListView
        items={[
          workItem({
            description: "Preview this work before opening the drawer.",
            blocked_reason: "Waiting on design review",
          }),
        ]}
      />,
    );

    await user.hover(screen.getByText("Refine task list"));

    expect(screen.getByText("Quick preview")).toBeTruthy();
    expect(screen.getByText("Preview this work before opening the drawer.")).toBeTruthy();
    expect(screen.getByText("Waiting on design review")).toBeTruthy();
  });

  it("previews a description as text, not markup", async () => {
    const user = userEvent.setup();

    render(
      <TaskListView
        items={[
          workItem({
            description: "Ship [the graph](orbit:task/8f2c1e04-1111-2222-3333-444455556666)",
          }),
        ]}
      />,
    );

    expect(await screen.findByText(/Ship the graph/)).toBeInTheDocument();
    expect(screen.queryByText(/orbit:task/)).not.toBeInTheDocument();

    await user.hover(screen.getByText("Refine task list"));

    expect(screen.getByText("Quick preview")).toBeTruthy();
    expect(screen.getAllByText(/Ship the graph/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/orbit:task/)).not.toBeInTheDocument();
  });

  it("filters tasks through saved productivity views", async () => {
    const user = userEvent.setup();

    render(
      <TaskListView
        items={[
          workItem({ id: "critical-overdue", title: "Fix launch outage", priority: "critical", due_date: "2026-01-01" }),
          workItem({ id: "quick-win", title: "Tidy label copy", priority: "low", due_date: null }),
        ]}
        todayKey="2026-07-01"
      />,
    );

    await user.selectOptions(screen.getByLabelText("Saved view"), "overdue-critical");

    expect(screen.getByText("Fix launch outage")).toBeTruthy();
    expect(screen.queryByText("Tidy label copy")).toBeNull();
  });

  it("supports inline task title edits", async () => {
    const user = userEvent.setup();
    const onInlineUpdate = vi.fn();

    render(<TaskListView items={[workItem()]} onInlineUpdate={onInlineUpdate} />);

    await user.click(screen.getByRole("button", { name: "Quick edit Refine task list" }));
    await user.clear(screen.getByLabelText("Inline title for Refine task list"));
    await user.type(screen.getByLabelText("Inline title for Refine task list"), "Refine task list today");
    await user.click(screen.getByRole("button", { name: "Save inline edit for Refine task list" }));

    expect(onInlineUpdate).toHaveBeenCalledWith("work-item-1", {
      title: "Refine task list today",
    });
  });

  it("shows task aging for stale work", () => {
    render(
      <TaskListView
        items={[workItem({ created_at: "2026-06-01T00:00:00.000Z" })]}
        todayKey="2026-07-01"
      />,
    );

    expect(screen.getByText("Aging 30d")).toBeTruthy();
  });
});
