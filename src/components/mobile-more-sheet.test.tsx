import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MobileMoreSheet } from "./mobile-more-sheet";

const signalMocks = vi.hoisted(() => ({ unreadSignalCount: 0 }));

vi.mock("../features/workspaces/workspace-context", () => ({
  useWorkspaceId: () => "workspace-1",
}));

vi.mock("../features/signals/signal-badge", () => ({
  useUnreadSignalCount: () => signalMocks.unreadSignalCount,
  SignalCountBadge: ({ count }: { count: number }) =>
    count === 0 ? null : <span aria-label={`${count} unread`}>{count > 9 ? "9+" : count}</span>,
}));

vi.mock("./command-palette", () => ({
  CommandPalette: () => <button type="button">Search</button>,
}));

function renderSheet(onClose = vi.fn()) {
  render(
    <MemoryRouter>
      <MobileMoreSheet onClose={onClose} />
    </MemoryRouter>,
  );

  return onClose;
}

describe("MobileMoreSheet", () => {
  beforeEach(() => {
    signalMocks.unreadSignalCount = 0;
  });

  it("offers the overflow destinations and search", () => {
    renderSheet();

    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute("href", "/w/workspace-1/dashboard");
    expect(screen.getByRole("link", { name: "Maps" })).toHaveAttribute("href", "/w/workspace-1/maps");
    expect(screen.getByRole("link", { name: "Calendar" })).toHaveAttribute("href", "/w/workspace-1/calendar");
    expect(screen.getByRole("link", { name: /^Signals/ })).toHaveAttribute("href", "/w/workspace-1/signals");
    expect(screen.getByRole("link", { name: "Settings" })).toHaveAttribute("href", "/w/workspace-1/settings");
    expect(screen.getByRole("button", { name: "Search" })).toBeVisible();
  });

  it("shows the unread count beside Signals", () => {
    signalMocks.unreadSignalCount = 2;
    renderSheet();

    expect(screen.getByRole("link", { name: /^Signals/ })).toHaveTextContent("2");
  });

  it("closes when a destination is chosen", async () => {
    const user = userEvent.setup();
    const onClose = renderSheet();

    await user.click(screen.getByRole("link", { name: "Maps" }));

    expect(onClose).toHaveBeenCalled();
  });

  it("keeps its destinations at the comfortable tap size", () => {
    renderSheet();

    expect(screen.getByRole("link", { name: "Maps" }).className).toContain("min-h-11");
  });
});
