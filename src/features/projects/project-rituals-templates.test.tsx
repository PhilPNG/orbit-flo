import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TemplatesPanel } from "./project-rituals-templates";

describe("TemplatesPanel", () => {
  it("applies reusable planning templates", async () => {
    const user = userEvent.setup();
    const onApplyTemplate = vi.fn();

    render(<TemplatesPanel onApplyTemplate={onApplyTemplate} onHide={() => undefined} />);

    await user.click(screen.getByRole("button", { name: "Apply Bug fix day template" }));

    expect(onApplyTemplate).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ title: "Reproduce the bug" }),
        expect.objectContaining({ title: "Ship and verify the fix" }),
      ]),
      "Bug fix day",
    );
  });

  it("shows use counts per template", () => {
    render(
      <TemplatesPanel
        onApplyTemplate={() => undefined}
        onHide={() => undefined}
        useCounts={new Map([["bug-fix-day", 5]])}
      />,
    );

    expect(screen.getByText("5 uses")).toBeTruthy();
    expect(screen.getByText("0 uses")).toBeTruthy();
  });

  it("hides via the close button", async () => {
    const user = userEvent.setup();
    const onHide = vi.fn();

    render(<TemplatesPanel onApplyTemplate={() => undefined} onHide={onHide} />);

    await user.click(screen.getByRole("button", { name: "Hide templates" }));

    expect(onHide).toHaveBeenCalled();
  });
});
