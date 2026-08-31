import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { QuickCaptureDock } from "./quick-capture-dock";

const inputPlaceholder = "Capture a thought — Enter to dock it";

describe("QuickCaptureDock", () => {
  it("submits a capture from the single input with Enter", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<QuickCaptureDock isSubmitting={false} onSubmit={onSubmit} resetSignal={0} />);

    expect(screen.getByRole("form", { name: "Quick capture" })).toHaveClass("today-capture-dock");

    await user.type(screen.getByPlaceholderText(inputPlaceholder), "Call mission control{Enter}");

    expect(onSubmit).toHaveBeenCalledWith({ type: "task", title: "Call mission control", body: "" });
  });

  it("does not submit an empty title", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<QuickCaptureDock isSubmitting={false} onSubmit={onSubmit} resetSignal={0} />);

    await user.type(screen.getByPlaceholderText(inputPlaceholder), "   {Enter}");

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("reveals type and notes behind the details toggle", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<QuickCaptureDock isSubmitting={false} onSubmit={onSubmit} resetSignal={0} />);

    expect(screen.queryByLabelText("Type")).toBeNull();

    await user.click(screen.getByRole("button", { name: "More capture options" }));
    await user.selectOptions(screen.getByLabelText("Type"), "idea");
    await user.type(screen.getByLabelText("Signal notes"), "Long-form context");
    await user.type(screen.getByPlaceholderText(inputPlaceholder), "Big idea{Enter}");

    expect(onSubmit).toHaveBeenCalledWith({ type: "idea", title: "Big idea", body: "Long-form context" });
  });

  it("clears the fields when the reset signal changes", async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <QuickCaptureDock isSubmitting={false} onSubmit={() => undefined} resetSignal={0} />,
    );

    await user.type(screen.getByPlaceholderText(inputPlaceholder), "typed");
    expect(screen.getByPlaceholderText<HTMLInputElement>(inputPlaceholder).value).toBe("typed");

    rerender(<QuickCaptureDock isSubmitting={false} onSubmit={() => undefined} resetSignal={1} />);

    expect(screen.getByPlaceholderText<HTMLInputElement>(inputPlaceholder).value).toBe("");
  });
});
