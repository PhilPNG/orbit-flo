import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import { mapTemplates } from "./map-templates";
import { NewMapDialog } from "./new-map-dialog";

function renderDialog(overrides: Partial<ComponentProps<typeof NewMapDialog>> = {}) {
  const props = { isCreating: false, error: null, onClose: vi.fn(), onCreate: vi.fn(), ...overrides };
  render(<NewMapDialog {...props} />);
  return props;
}

describe("NewMapDialog", () => {
  it("lists a blank option and every template, with Blank selected", () => {
    renderDialog();
    const options = screen.getAllByRole("radio");
    expect(options).toHaveLength(mapTemplates.length + 1);
    expect(screen.getByRole("radio", { name: /Blank map/ })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("textbox", { name: "Map title" })).toHaveValue("Untitled map");
  });

  it("fills the title from the chosen template and submits it", async () => {
    const user = userEvent.setup();
    const props = renderDialog();

    await user.click(screen.getByRole("radio", { name: /Feature plan/ }));
    expect(screen.getByRole("textbox", { name: "Map title" })).toHaveValue("Feature plan");

    await user.click(screen.getByRole("button", { name: "Create map" }));
    expect(props.onCreate).toHaveBeenCalledWith({ templateId: "feature-plan", title: "Feature plan" });
  });

  it("submits a blank map with an edited title on Enter", async () => {
    const user = userEvent.setup();
    const props = renderDialog();

    const title = screen.getByRole("textbox", { name: "Map title" });
    await user.clear(title);
    await user.type(title, "Q4 themes{Enter}");

    expect(props.onCreate).toHaveBeenCalledWith({ templateId: null, title: "Q4 themes" });
  });

  it("falls back to Untitled map when the title is blank", async () => {
    const user = userEvent.setup();
    const props = renderDialog();

    await user.clear(screen.getByRole("textbox", { name: "Map title" }));
    await user.click(screen.getByRole("button", { name: "Create map" }));

    expect(props.onCreate).toHaveBeenCalledWith({ templateId: null, title: "Untitled map" });
  });

  it("shows the error and disables Create while creating", () => {
    renderDialog({ error: "nope", isCreating: true });
    expect(screen.getByText("nope")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Creating…" })).toBeDisabled();
  });

  it("closes from Cancel", async () => {
    const user = userEvent.setup();
    const props = renderDialog();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(props.onClose).toHaveBeenCalled();
  });
});
