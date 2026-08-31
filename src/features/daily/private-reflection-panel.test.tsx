import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PrivateReflectionPanel } from "./private-reflection-panel";

describe("PrivateReflectionPanel", () => {
  it("saves a private reflection", async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn();

    render(<PrivateReflectionPanel isSaving={false} reflections={[]} onCreate={onCreate} />);

    await user.type(screen.getByLabelText("Reflection title"), "What I learned today");
    await user.type(screen.getByLabelText("Private reflection"), "Smaller planning blocks helped.");
    await user.click(screen.getByRole("button", { name: "Save private reflection" }));

    expect(onCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "What I learned today",
        body: "Smaller planning blocks helped.",
      }),
    );
  });

  it("keeps reflection fields populated while save is pending", async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn(() => new Promise(() => undefined));

    render(<PrivateReflectionPanel isSaving={false} reflections={[]} onCreate={onCreate} />);

    const titleInput = screen.getByLabelText("Reflection title");
    const bodyInput = screen.getByLabelText("Private reflection");
    const moodInput = screen.getByLabelText("Mood");

    await user.type(titleInput, "What I learned today");
    await user.type(bodyInput, "Smaller planning blocks helped.");
    await user.clear(moodInput);
    await user.type(moodInput, "steady");
    await user.click(screen.getByRole("button", { name: "Save private reflection" }));

    expect(onCreate).toHaveBeenCalledOnce();
    expect(titleInput).toHaveValue("What I learned today");
    expect(bodyInput).toHaveValue("Smaller planning blocks helped.");
    expect(moodInput).toHaveValue("steady");
  });

  it("keeps reflection fields populated when save rejects", async () => {
    const user = userEvent.setup();
    let rejectSave: (reason?: unknown) => void = () => undefined;
    const onCreate = vi.fn(
      () =>
        new Promise((_resolve, reject) => {
          rejectSave = reject;
        }),
    );

    render(<PrivateReflectionPanel isSaving={false} reflections={[]} onCreate={onCreate} />);

    const titleInput = screen.getByLabelText("Reflection title");
    const bodyInput = screen.getByLabelText("Private reflection");
    const moodInput = screen.getByLabelText("Mood");

    await user.type(titleInput, "What I learned today");
    await user.type(bodyInput, "Smaller planning blocks helped.");
    await user.clear(moodInput);
    await user.type(moodInput, "steady");
    await user.click(screen.getByRole("button", { name: "Save private reflection" }));

    rejectSave(new Error("Unable to save reflection"));

    await waitFor(() => {
      expect(titleInput).toHaveValue("What I learned today");
      expect(bodyInput).toHaveValue("Smaller planning blocks helped.");
      expect(moodInput).toHaveValue("steady");
    });
  });

  it("does not save when title or body is empty", async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn();

    render(<PrivateReflectionPanel isSaving={false} reflections={[]} onCreate={onCreate} />);

    await user.click(screen.getByRole("button", { name: "Save private reflection" }));

    expect(onCreate).not.toHaveBeenCalled();
  });

  it("renders recent private reflections", () => {
    render(
      <PrivateReflectionPanel
        isSaving={false}
        reflections={[
          {
            id: "reflection-1",
            workspace_id: "workspace-1",
            reflection_date: "2026-07-01",
            title: "Planning went better",
            body: "The smaller blocks helped me keep momentum.",
            mood: "clear",
            tags: [],
            created_by: "user-1",
            created_at: "2026-07-01T00:00:00.000Z",
            updated_at: "2026-07-01T00:00:00.000Z",
          },
        ]}
        onCreate={vi.fn()}
      />,
    );

    expect(screen.getByText("Planning went better")).toBeTruthy();
    expect(screen.getByText("The smaller blocks helped me keep momentum.")).toBeTruthy();
  });
});
