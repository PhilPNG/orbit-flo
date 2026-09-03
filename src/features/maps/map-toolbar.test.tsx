import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MapToolbar, type MapToolbarProps } from "./map-toolbar";

function defaultProps(): MapToolbarProps {
  return {
    status: "saved",
    error: null,
    canUndo: true,
    canRedo: false,
    isInspectorOpen: false,
    onAddNode: vi.fn(),
    onArrange: vi.fn(),
    onFitView: vi.fn(),
    onToggleInspector: vi.fn(),
    onRetrySave: vi.fn(),
    onUndo: vi.fn(),
    onRedo: vi.fn(),
  };
}

function renderToolbar(overrides: Partial<MapToolbarProps> = {}) {
  const props: MapToolbarProps = { ...defaultProps(), ...overrides };
  render(<MapToolbar {...props} />);
  return props;
}

describe("MapToolbar", () => {
  it("shows the save status and a retry action on error", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<MapToolbar {...defaultProps()} status="saved" />);
    expect(screen.getByText("Saved")).toBeTruthy();

    rerender(<MapToolbar {...defaultProps()} status="dirty" />);
    expect(screen.getByText("Saving…")).toBeTruthy();

    rerender(<MapToolbar {...defaultProps()} status="saving" />);
    expect(screen.getByText("Saving…")).toBeTruthy();

    const onRetrySave = vi.fn();
    rerender(<MapToolbar {...defaultProps()} error="offline" onRetrySave={onRetrySave} status="error" />);
    expect(screen.getByText("Couldn't save")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetrySave).toHaveBeenCalled();
  });

  it("wires the action buttons", async () => {
    const user = userEvent.setup();
    const props = renderToolbar();

    await user.click(screen.getByRole("button", { name: "Add node" }));
    await user.click(screen.getByRole("button", { name: "Fit view" }));
    await user.click(screen.getByRole("button", { name: "Details" }));
    await user.click(screen.getByRole("button", { name: "Undo" }));

    expect(props.onAddNode).toHaveBeenCalled();
    expect(props.onFitView).toHaveBeenCalled();
    expect(props.onToggleInspector).toHaveBeenCalled();
    expect(props.onUndo).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Redo" })).toBeDisabled();
  });

  it("marks Details pressed while the inspector is open", () => {
    renderToolbar({ isInspectorOpen: true });
    expect(screen.getByRole("button", { name: "Details" })).toHaveAttribute("aria-pressed", "true");
  });

  it("offers the four arrange modes from a menu", async () => {
    const user = userEvent.setup();
    const props = renderToolbar();

    await user.click(screen.getByRole("button", { name: "Arrange" }));
    expect(screen.getAllByRole("menuitem").map((item) => item.textContent)).toEqual(["Radial", "Left to right", "Top down", "By date"]);

    await user.click(screen.getByRole("menuitem", { name: "Top down" }));
    expect(props.onArrange).toHaveBeenCalledWith("top_down");
    expect(screen.queryByRole("menu")).toBeNull();
  });
});
