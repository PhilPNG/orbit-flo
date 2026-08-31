import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Database } from "../../lib/supabase/database.types";
import { ProjectBriefPanel } from "./project-brief-panel";

type ProjectBrief = Database["public"]["Tables"]["project_briefs"]["Row"];

function projectBrief(overrides: Partial<ProjectBrief> = {}): ProjectBrief {
  return {
    id: "brief-1",
    workspace_id: "workspace-1",
    project_id: "project-1",
    goal: "Initial goal",
    audience: "Initial audience",
    success_criteria: "Initial success criteria",
    constraints: "Initial constraints",
    status_summary: "Initial status",
    next_milestone: "Initial milestone",
    created_by: "user-1",
    created_at: "2026-06-28T00:00:00.000Z",
    updated_at: "2026-06-28T00:00:00.000Z",
    ...overrides,
  };
}

describe("ProjectBriefPanel", () => {
  it("is collapsed by default with a two-line digest", () => {
    render(
      <ProjectBriefPanel
        brief={projectBrief({ goal: "Ship the onboarding revamp", next_milestone: "Beta on Friday" })}
        onSave={() => undefined}
      />,
    );

    const details = screen.getByText("Project brief").closest("details");
    expect(details).not.toHaveAttribute("open");
    expect(details?.querySelector("summary")?.textContent).toContain("Ship the onboarding revamp");
    expect(details?.querySelector("summary")?.textContent).toContain("Beta on Friday");
  });

  it("invites a first brief when empty", () => {
    render(<ProjectBriefPanel brief={null} onSave={() => undefined} />);

    expect(screen.getByText("Add a goal, audience, and success criteria.")).toBeTruthy();
  });

  it("expands to the editable form", async () => {
    const user = userEvent.setup();
    render(
      <ProjectBriefPanel
        brief={projectBrief({ goal: "Ship the onboarding revamp" })}
        onSave={() => undefined}
      />,
    );

    await user.click(screen.getByText("Project brief"));

    expect(screen.getByText("Project brief").closest("details")).toHaveAttribute("open");
    expect(screen.getByLabelText("Project goal")).toHaveValue("Ship the onboarding revamp");
    expect(screen.getByRole("button", { name: "Save project brief" })).toBeTruthy();
  });

  it("edits and saves the project brief", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();

    render(
      <ProjectBriefPanel
        brief={null}
        isSaving={false}
        onSave={onSave}
      />,
    );

    await user.type(screen.getByLabelText("Project goal"), "Ship a calmer planning cockpit.");
    await user.type(screen.getByLabelText("Success criteria"), "Users know what to do next.");
    await user.click(screen.getByRole("button", { name: "Save project brief" }));

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        goal: "Ship a calmer planning cockpit.",
        successCriteria: "Users know what to do next.",
      }),
    );
  });

  it("keeps the local draft when background updates arrive before saving edits", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    const { rerender } = render(
      <ProjectBriefPanel
        brief={projectBrief({ goal: "Original goal" })}
        isSaving={false}
        onSave={onSave}
      />,
    );

    await user.clear(screen.getByLabelText("Project goal"));
    await user.type(screen.getByLabelText("Project goal"), "Updated goal");

    rerender(
      <ProjectBriefPanel
        brief={projectBrief({ id: "brief-1", goal: "Background goal" })}
        isSaving={false}
        onSave={onSave}
      />,
    );

    expect(screen.getByLabelText("Project goal")).toHaveValue("Updated goal");

    await user.click(screen.getByRole("button", { name: "Save project brief" }));

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ goal: "Updated goal" }));
  });

  it("keeps a dirty draft when a brief row appears during a background refetch", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    const { rerender } = render(
      <ProjectBriefPanel
        brief={null}
        isSaving={false}
        onSave={onSave}
      />,
    );

    await user.type(screen.getByLabelText("Project goal"), "User draft goal");

    rerender(
      <ProjectBriefPanel
        brief={projectBrief({ goal: "Server goal" })}
        isSaving={false}
        onSave={onSave}
      />,
    );

    expect(screen.getByLabelText("Project goal")).toHaveValue("User draft goal");

    await user.click(screen.getByRole("button", { name: "Save project brief" }));

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ goal: "User draft goal" }));
  });
});
