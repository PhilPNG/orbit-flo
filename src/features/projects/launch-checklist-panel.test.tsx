import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Database } from "../../lib/supabase/database.types";
import { LaunchChecklistPanel, defaultLaunchChecklistItems } from "./launch-checklist-panel";

type LaunchChecklist = Database["public"]["Tables"]["launch_checklists"]["Row"];

function launchChecklist(overrides: Partial<LaunchChecklist> = {}): LaunchChecklist {
  return {
    id: "checklist-1",
    workspace_id: "workspace-1",
    project_id: "project-1",
    milestone_id: null,
    title: "Go-live checklist",
    checklist_items: [
      { id: "tests", label: "Tests pass", isDone: true },
      { id: "custom-1", label: "Tell support", isDone: false },
    ],
    completed_at: null,
    created_by: "user-1",
    created_at: "2026-07-01T00:00:00.000Z",
    updated_at: "2026-07-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("LaunchChecklistPanel", () => {
  it("checks launch items and adds a custom item", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();

    render(<LaunchChecklistPanel checklist={null} isSaving={false} onSave={onSave} />);

    expect(screen.getByLabelText(defaultLaunchChecklistItems[0].label)).toBeTruthy();
    await user.click(screen.getByLabelText(defaultLaunchChecklistItems[0].label));
    await user.type(screen.getByLabelText("Custom launch item"), "Notify beta users");
    await user.click(screen.getByRole("button", { name: "Add launch item" }));
    await user.click(screen.getByRole("button", { name: "Save launch checklist" }));

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ title: "Launch checklist" }));
    expect(screen.getByText("Notify beta users")).toBeTruthy();
  });

  it("preloads an existing checklist and preserves its title", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();

    render(<LaunchChecklistPanel checklist={launchChecklist()} isSaving={false} onSave={onSave} />);

    expect(screen.getByLabelText("Tests pass")).toBeChecked();
    expect(screen.getByText("Tell support")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Save launch checklist" }));

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ title: "Go-live checklist" }));
  });

  it("does not add empty custom items", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();

    render(<LaunchChecklistPanel checklist={null} isSaving={false} onSave={onSave} />);

    expect(screen.getByRole("button", { name: "Add launch item" })).toBeDisabled();
    await user.type(screen.getByLabelText("Custom launch item"), "   ");

    expect(screen.getByRole("button", { name: "Add launch item" })).toBeDisabled();
  });

  it("preserves the current checklist draft when saving fails", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockRejectedValue(new Error("Save failed"));

    render(<LaunchChecklistPanel checklist={null} isSaving={false} onSave={onSave} />);

    await user.click(screen.getByLabelText("Tests pass"));
    await user.type(screen.getByLabelText("Custom launch item"), "Notify beta users");
    await user.click(screen.getByRole("button", { name: "Add launch item" }));
    await user.click(screen.getByRole("button", { name: "Save launch checklist" }));

    expect(await screen.findByLabelText("Tests pass")).toBeChecked();
    expect(screen.getByText("Notify beta users")).toBeTruthy();
  });

  it("disables controls while loading", () => {
    const onSave = vi.fn();

    render(<LaunchChecklistPanel checklist={null} isLoading={true} isSaving={false} onSave={onSave} />);

    expect(screen.getByLabelText("Tests pass")).toBeDisabled();
    expect(screen.getByLabelText("Custom launch item")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Add launch item" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Save launch checklist" })).toBeDisabled();
  });
});
