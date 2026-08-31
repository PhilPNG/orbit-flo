import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Database } from "../../lib/supabase/database.types";
import { InlineSuggestions } from "./inline-suggestions";

type WorkItem = Database["public"]["Tables"]["work_items"]["Row"];

function workItem(overrides: Partial<WorkItem> = {}): WorkItem {
  return {
    id: "work-item-1",
    workspace_id: "workspace-1",
    project_id: "project-1",
    milestone_id: null,
    assigned_to: null,
    title: "Work item",
    description: null,
    status: "ready",
    priority: "medium",
    due_date: null,
    estimate_points: null,
    sort_order: 0,
    blocked_reason: null,
    created_by: "user-1",
    created_at: "2026-07-07T00:00:00.000Z",
    updated_at: "2026-07-07T00:00:00.000Z",
    ...overrides,
  } as WorkItem;
}

describe("InlineSuggestions", () => {
  it("renders nothing when there are no suggestions", () => {
    const { container } = render(
      <InlineSuggestions
        availableWorkItems={[]}
        dailyPlanItems={[]}
        isAdding={false}
        onAdd={() => undefined}
        todayKey="2026-07-07"
      />,
    );

    expect(container.firstChild).toBeNull();
  });

  it("expands from a count hint to the full suggestion list", async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn();

    render(
      <InlineSuggestions
        availableWorkItems={[
          workItem({ id: "a", title: "Fix heat shield" }),
          workItem({ id: "b", title: "Chart course" }),
        ]}
        dailyPlanItems={[]}
        isAdding={false}
        onAdd={onAdd}
        todayKey="2026-07-07"
      />,
    );

    const toggle = screen.getByRole("button", { name: "2 suggestions for today" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Fix heat shield")).toBeNull();

    await user.click(toggle);

    expect(screen.getByRole("button", { name: "Hide suggestions" })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("2 suggestions for today")).toBeVisible();
    expect(screen.getByText("Fix heat shield")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Add Fix heat shield to today" }));
    expect(onAdd).toHaveBeenCalled();
  });

  it("can expose recommendations immediately for an empty flight plan", () => {
    const availableItems = [
      workItem({ id: "smallest-version", title: "Define the smallest useful version" }),
    ];

    render(
      <InlineSuggestions
        availableWorkItems={availableItems}
        dailyPlanItems={[]}
        defaultExpanded
        isAdding={false}
        onAdd={() => undefined}
        todayKey="2026-07-12"
      />,
    );

    expect(screen.getByRole("button", { name: "Hide suggestions" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(screen.getByText("Define the smallest useful version")).toBeVisible();
  });
});
