import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MobileCaptureButton } from "./mobile-capture-button";

vi.mock("./global-quick-add", () => ({
  GlobalQuickAdd: () => (
    <label>
      Quick add
      <input />
    </label>
  ),
}));

describe("MobileCaptureButton", () => {
  it("opens a capture sheet", async () => {
    const user = userEvent.setup();
    render(<MobileCaptureButton />);

    await user.click(screen.getByRole("button", { name: "Capture a thought" }));

    expect(screen.getByRole("dialog", { name: "Capture" })).toBeVisible();
    expect(screen.getByLabelText("Quick add")).toBeVisible();
  });

  it("stays clear of the tab bar and hides on large screens", () => {
    render(<MobileCaptureButton />);

    const trigger = screen.getByRole("button", { name: "Capture a thought" });
    expect(trigger.className).toContain("bottom-20");
    expect(trigger.className).toContain("lg:hidden");
  });
});
