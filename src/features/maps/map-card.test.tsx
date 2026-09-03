import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import type { MindMap, MindMapPreview } from "./maps.queries";
import { formatRelativeTime, MapCard } from "./map-card";

const map: MindMap = {
  id: "map-1",
  workspace_id: "workspace-1",
  project_id: null,
  title: "Feature plan",
  description: "",
  default_view: "mind_map",
  created_by: "user-1",
  created_at: "2026-09-01T00:00:00.000Z",
  updated_at: "2026-09-01T00:00:00.000Z",
  archived_at: null,
};

const preview: MindMapPreview = {
  nodes: [
    { id: "a", position: { x: 0, y: 0 }, nodeType: "idea" },
    { id: "b", position: { x: 10, y: 10 }, nodeType: "risk" },
  ],
  edges: [{ id: "a-b", sourceNodeId: "a", targetNodeId: "b" }],
};

function renderCard(overrides: Partial<ComponentProps<typeof MapCard>> = {}) {
  const props = {
    map,
    preview,
    isRenaming: false,
    onOpen: vi.fn(),
    onStartRename: vi.fn(),
    onRename: vi.fn(),
    onCancelRename: vi.fn(),
    onDuplicate: vi.fn(),
    onArchive: vi.fn(),
    ...overrides,
  };
  const utils = render(<MapCard {...props} />);
  return {
    ...props,
    // Re-renders with the same mocks (unless overridden) so a test can flip a
    // prop like isRenaming the way the real parent would after a commit.
    rerender: (nextOverrides: Partial<ComponentProps<typeof MapCard>> = {}) =>
      utils.rerender(<MapCard {...props} {...nextOverrides} />),
  };
}

describe("MapCard", () => {
  it("shows the title, node count and a thumbnail", () => {
    renderCard();
    expect(screen.getByRole("button", { name: "Feature plan" })).toBeTruthy();
    expect(screen.getByText(/2 nodes/)).toBeTruthy();
    expect(document.querySelectorAll("[data-thumbnail-node]")).toHaveLength(2);
  });

  it("opens the map from the title and the thumbnail", async () => {
    const user = userEvent.setup();
    const props = renderCard();
    await user.click(screen.getByRole("button", { name: "Feature plan" }));
    await user.click(screen.getByRole("button", { name: "Open Feature plan" }));
    expect(props.onOpen).toHaveBeenCalledTimes(2);
  });

  it("offers rename, duplicate and archive from the menu", async () => {
    const user = userEvent.setup();
    const props = renderCard();
    await user.click(screen.getByRole("button", { name: "Map actions for Feature plan" }));
    expect(screen.getByRole("menu")).toBeTruthy();
    await user.click(screen.getByRole("menuitem", { name: "Archive" }));
    expect(props.onArchive).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("menu")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Map actions for Feature plan" }));
    await user.click(screen.getByRole("menuitem", { name: "Duplicate" }));
    expect(props.onDuplicate).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: "Map actions for Feature plan" }));
    await user.click(screen.getByRole("menuitem", { name: "Rename" }));
    expect(props.onStartRename).toHaveBeenCalledTimes(1);
  });

  it("closes the menu on Escape", async () => {
    const user = userEvent.setup();
    renderCard();
    await user.click(screen.getByRole("button", { name: "Map actions for Feature plan" }));
    expect(screen.getByRole("menu")).toBeTruthy();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("closes the menu on an outside click", async () => {
    const user = userEvent.setup();
    renderCard();
    await user.click(screen.getByRole("button", { name: "Map actions for Feature plan" }));
    expect(screen.getByRole("menu")).toBeTruthy();
    await user.click(document.body);
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("commits a rename on Enter", async () => {
    const user = userEvent.setup();
    const props = renderCard({ isRenaming: true });
    const input = screen.getByRole("textbox", { name: "Map title" });
    await user.clear(input);
    await user.type(input, "Launch plan{Enter}");
    expect(props.onRename).toHaveBeenCalledWith("Launch plan");

    // A blur that follows the Enter (e.g. because the parent flips isRenaming
    // to false and the input unmounts) must not commit a second time.
    fireEvent.blur(input);
    expect(props.onRename).toHaveBeenCalledTimes(1);

    // The real parent flips isRenaming to false as soon as onRename fires,
    // which unmounts the input entirely.
    props.rerender({ isRenaming: false });
    expect(props.onRename).toHaveBeenCalledTimes(1);
  });

  it("reverts on Escape", async () => {
    const user = userEvent.setup();
    const props = renderCard({ isRenaming: true });
    const input = screen.getByRole("textbox", { name: "Map title" });
    await user.clear(input);
    await user.type(input, "Launch plan{Escape}");
    expect(props.onCancelRename).toHaveBeenCalledTimes(1);
    expect(props.onRename).not.toHaveBeenCalled();
  });

  it("cancels an unchanged rename", async () => {
    const user = userEvent.setup();
    const props = renderCard({ isRenaming: true });
    await user.type(screen.getByRole("textbox", { name: "Map title" }), "{Enter}");
    expect(props.onRename).not.toHaveBeenCalled();
    expect(props.onCancelRename).toHaveBeenCalled();
  });

  it("cancels a blank rename", async () => {
    const user = userEvent.setup();
    const props = renderCard({ isRenaming: true });
    const input = screen.getByRole("textbox", { name: "Map title" });
    await user.clear(input);
    await user.type(input, "{Enter}");
    expect(props.onRename).not.toHaveBeenCalled();
    expect(props.onCancelRename).toHaveBeenCalled();
  });
});

describe("formatRelativeTime", () => {
  const now = Date.parse("2026-09-01T12:00:00.000Z");
  it("formats minutes, hours and days", () => {
    expect(formatRelativeTime("2026-09-01T11:59:40.000Z", now)).toBe("just now");
    expect(formatRelativeTime("2026-09-01T11:30:00.000Z", now)).toBe("30m ago");
    expect(formatRelativeTime("2026-09-01T09:00:00.000Z", now)).toBe("3h ago");
    expect(formatRelativeTime("2026-08-29T12:00:00.000Z", now)).toBe("3d ago");
  });
});
