import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MapToolbar } from "./map-toolbar";

describe("MapToolbar", () => {
  it("separates selected view and dirty save state", async () => {
    const user = userEvent.setup();
    const onViewChange = vi.fn();
    const onSave = vi.fn();
    render(
      <MapToolbar
        activeView="mind_map"
        hasSelection={false}
        isDirty
        isSaving={false}
        onAddNode={() => undefined}
        onOpenDetails={() => undefined}
        onSave={onSave}
        onViewChange={onViewChange}
      />,
    );

    const activeTab = screen.getByRole("tab", { name: "Mind Map" });
    const saveButton = screen.getByRole("button", { name: "Save map" });

    expect(activeTab).toHaveAttribute("aria-selected", "true");
    expect(activeTab).toHaveClass("border-b-2", "border-cyan-300");
    expect(activeTab).not.toHaveClass("bg-cyan-400");
    expect(screen.getByRole("button", { name: "Details" })).toBeDisabled();
    expect(saveButton).toHaveClass("bg-blue-500");
    await user.click(screen.getByRole("tab", { name: "Flowchart" }));
    expect(onViewChange).toHaveBeenCalledWith("flowchart");
    await user.click(saveButton);
    expect(onSave).toHaveBeenCalledOnce();
  });
});
