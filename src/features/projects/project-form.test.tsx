import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ProjectForm } from "./project-form";

describe("ProjectForm", () => {
  it("submits trimmed project values", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<ProjectForm onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText("Name"), "  Desk UI  ");
    await user.type(screen.getByLabelText("Description"), "  Build the Orbit Flo workspace  ");
    await user.type(screen.getByLabelText("Repository URL"), "  https://github.com/example/repo  ");
    await user.selectOptions(screen.getByLabelText("Status"), "paused");
    await user.selectOptions(screen.getByLabelText("Priority"), "critical");
    await user.selectOptions(screen.getByLabelText("Health"), "watch");
    await user.click(screen.getByRole("button", { name: "Launch project" }));

    expect(onSubmit).toHaveBeenCalledWith({
      name: "Desk UI",
      description: "Build the Orbit Flo workspace",
      repositoryUrl: "https://github.com/example/repo",
      status: "paused",
      priority: "critical",
      health: "watch",
    });
  });

  it("does not submit when the trimmed name is empty", () => {
    const onSubmit = vi.fn();
    const { container } = render(<ProjectForm onSubmit={onSubmit} />);
    const form = container.querySelector("form");

    expect(form).not.toBeNull();
    fireEvent.submit(form as HTMLFormElement);

    expect(onSubmit).not.toHaveBeenCalled();
  });
});
