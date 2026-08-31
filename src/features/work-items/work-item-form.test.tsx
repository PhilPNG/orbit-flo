import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Label } from "./work-item-details.queries";
import { WorkItemForm } from "./work-item-form";

const designLabel: Label = {
  id: "l1",
  workspace_id: "workspace-1",
  project_id: "project-1",
  name: "Design",
  color: "violet",
  created_by: "user-1",
  created_at: "2026-07-12T00:00:00.000Z",
  updated_at: "2026-07-12T00:00:00.000Z",
};

describe("WorkItemForm", () => {
  it("submits trimmed work item values with empty staging", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<WorkItemForm onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText("Title"), "  Draft workspace flow  ");
    await user.type(screen.getByLabelText("Description"), "  Add the first board pass  ");
    await user.type(screen.getByLabelText("Deadline"), "2026-07-14");
    await user.selectOptions(screen.getByLabelText("Status"), "review");
    await user.selectOptions(screen.getByLabelText("Priority"), "high");
    await user.click(screen.getByRole("button", { name: "Launch task" }));

    expect(onSubmit).toHaveBeenCalledWith({
      title: "Draft workspace flow",
      description: "Add the first board pass",
      dueDate: "2026-07-14",
      status: "review",
      priority: "high",
      labelIds: [],
      checklistItems: [],
      files: [],
    });
  });

  it("stages labels, checklist items, and files into the payload", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<WorkItemForm labels={[designLabel]} onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText("Title"), "Ship card");
    await user.click(screen.getByRole("checkbox", { name: "Design" }));
    await user.type(screen.getByLabelText("New checklist item"), "Write spec{Enter}");
    await user.type(screen.getByLabelText("New checklist item"), "Review copy{Enter}");

    const file = new File(["content"], "notes.txt", { type: "text/plain" });
    await user.upload(screen.getByLabelText("Attach files"), file);

    await user.click(screen.getByRole("button", { name: "Launch task" }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Ship card",
        labelIds: ["l1"],
        checklistItems: ["Write spec", "Review copy"],
        files: [file],
      }),
    );
  });

  it("rejects oversized files with a message", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<WorkItemForm onSubmit={onSubmit} />);

    const bigFile = new File(["x"], "big.zip", { type: "application/zip" });
    Object.defineProperty(bigFile, "size", { value: 11 * 1024 * 1024 });
    await user.upload(screen.getByLabelText("Attach files"), bigFile);

    expect(screen.getByText("Attachments are limited to 10 MB.")).toBeTruthy();
    expect(screen.queryByText("big.zip")).toBeNull();
  });
});
