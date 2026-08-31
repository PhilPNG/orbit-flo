import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Database } from "../../lib/supabase/database.types";
import { MilestoneManager } from "./milestone-manager";

type Milestone = Database["public"]["Tables"]["milestones"]["Row"];

function milestone(overrides: Partial<Milestone> = {}): Milestone {
  return {
    id: "milestone-1",
    workspace_id: "workspace-1",
    project_id: "project-1",
    title: "Beta launch",
    description: "Invite testers",
    target_date: "2026-07-18",
    completed_at: null,
    sort_order: 0,
    created_by: "user-1",
    created_at: "2026-06-28T00:00:00.000Z",
    updated_at: "2026-06-28T00:00:00.000Z",
    ...overrides,
  };
}

describe("MilestoneManager", () => {
  it("creates a milestone from the manager form", async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn();

    render(<MilestoneManager milestones={[]} onCreate={onCreate} onUpdate={() => undefined} />);

    await user.click(screen.getByRole("button", { name: "Add milestone" }));
    await user.type(screen.getByLabelText("Title"), "Beta launch");
    await user.type(screen.getByLabelText("Description"), "Invite testers");
    await user.type(screen.getByLabelText("Target date"), "2026-07-18");
    await user.click(screen.getByRole("button", { name: "Save milestone" }));

    expect(onCreate).toHaveBeenCalledWith({
      title: "Beta launch",
      description: "Invite testers",
      targetDate: "2026-07-18",
    });
  });

  it("previews a description as text, not markup", async () => {
    render(
      <MilestoneManager
        milestones={[
          milestone({
            description: "Ship [the graph](orbit:task/8f2c1e04-1111-2222-3333-444455556666)",
          }),
        ]}
        onCreate={() => undefined}
        onUpdate={() => undefined}
      />,
    );

    expect(await screen.findByText(/Ship the graph/)).toBeInTheDocument();
    expect(screen.queryByText(/orbit:task/)).not.toBeInTheDocument();
  });

  it("marks an existing milestone complete", async () => {
    const user = userEvent.setup();
    const onUpdate = vi.fn();

    render(<MilestoneManager milestones={[milestone()]} onCreate={() => undefined} onUpdate={onUpdate} />);

    await user.click(screen.getByRole("button", { name: "Complete Beta launch" }));

    expect(onUpdate).toHaveBeenCalledWith("milestone-1", {
      title: "Beta launch",
      description: "Invite testers",
      targetDate: "2026-07-18",
      completedAt: expect.any(String),
      sortOrder: 0,
    });
  });
});
