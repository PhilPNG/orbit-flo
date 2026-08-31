import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MobileTabBar } from "./mobile-tab-bar";

const signalMocks = vi.hoisted(() => ({ unreadSignalCount: 0 }));

vi.mock("../features/workspaces/workspace-context", () => ({
  useWorkspaceId: () => "workspace-1",
}));

vi.mock("../features/signals/signal-badge", () => ({
  useUnreadSignalCount: () => signalMocks.unreadSignalCount,
}));

vi.mock("../app/route-loaders", () => ({ routePrefetchers: {} }));

function renderBar(onOpenMore = vi.fn(), route = "/") {
  render(
    <MemoryRouter initialEntries={[route]}>
      <MobileTabBar onOpenMore={onOpenMore} />
    </MemoryRouter>,
  );

  return onOpenMore;
}

describe("MobileTabBar", () => {
  beforeEach(() => {
    signalMocks.unreadSignalCount = 0;
  });

  it("renders the four destinations and More", () => {
    renderBar();

    for (const label of ["Today", "Missions", "Inbox", "Brainstorm"]) {
      expect(screen.getByRole("link", { name: label })).toBeVisible();
    }

    expect(screen.getByRole("button", { name: "More" })).toBeVisible();
  });

  it("marks the active destination", () => {
    renderBar(vi.fn(), "/w/workspace-1/inbox");

    expect(screen.getByRole("link", { name: "Inbox" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Today" })).not.toHaveAttribute("aria-current");
  });

  it("opens the More sheet", async () => {
    const user = userEvent.setup();
    const onOpenMore = renderBar();

    await user.click(screen.getByRole("button", { name: "More" }));

    expect(onOpenMore).toHaveBeenCalled();
  });

  it("keeps every target at the comfortable tap size", () => {
    renderBar();

    for (const target of [
      screen.getByRole("link", { name: "Today" }),
      screen.getByRole("button", { name: "More" }),
    ]) {
      expect(target.className).toContain("min-h-11");
    }
  });

  it("marks More with an unread dot when Signals has unread items", () => {
    signalMocks.unreadSignalCount = 3;
    renderBar();

    expect(screen.getByLabelText("Unread signals")).toBeVisible();
  });

  it("shows no unread dot on More when there is nothing unread", () => {
    renderBar();

    expect(screen.queryByLabelText("Unread signals")).not.toBeInTheDocument();
  });

  it("hides itself on large screens", () => {
    const { container } = render(
      <MemoryRouter>
        <MobileTabBar onOpenMore={vi.fn()} />
      </MemoryRouter>,
    );

    expect(container.querySelector("nav")?.className).toContain("lg:hidden");
  });
});
