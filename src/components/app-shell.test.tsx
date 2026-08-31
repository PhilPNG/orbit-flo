import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppShell } from "./app-shell";

const signalMocks = vi.hoisted(() => ({
  unreadSignalCount: 0,
  unreadByWorkspace: new Map<string, number>(),
}));

vi.mock("../features/workspaces/workspace-context", () => ({
  useWorkspaceId: () => "workspace-1",
}));

vi.mock("../features/signals/signal-badge", () => ({
  useUnreadSignalCount: () => signalMocks.unreadSignalCount,
  useUnreadByWorkspace: () => signalMocks.unreadByWorkspace,
  SignalCountBadge: ({ count }: { count: number }) =>
    count === 0 ? null : <span aria-label={`${count} unread`}>{count > 9 ? "9+" : count}</span>,
}));

vi.mock("./command-palette", () => ({ CommandPalette: () => <button type="button">Search</button> }));

vi.mock("./global-quick-add", () => ({
  GlobalQuickAdd: () => (
    <label>
      Quick add
      <input />
    </label>
  ),
}));

vi.mock("../lib/supabase/client", () => ({ supabase: {} }));

vi.mock("../features/workspaces/workspaces.queries", () => ({
  listWorkspaces: () => Promise.resolve([{ id: "workspace-1", name: "Personal" }]),
  createWorkspace: vi.fn(),
  workspacesQueryKey: ["workspaces"],
}));

vi.mock("../app/route-loaders", () => ({ routePrefetchers: {} }));

function renderShell() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  render(
    <QueryClientProvider client={client}>
    <MemoryRouter>
      <AppShell>
        <p>Page body</p>
      </AppShell>
    </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("AppShell", () => {
  beforeEach(() => {
    signalMocks.unreadSignalCount = 0;
    signalMocks.unreadByWorkspace = new Map();
  });

  it("hides the sidebar below the large breakpoint", () => {
    renderShell();

    const sidebar = document.querySelector("aside");

    expect(sidebar?.className).toContain("hidden");
    expect(sidebar?.className).toContain("lg:flex");
  });

  it("renders the mobile bar and capture button alongside the page", () => {
    renderShell();

    expect(screen.getByText("Page body")).toBeVisible();
    expect(screen.getByRole("button", { name: "More" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Capture a thought" })).toBeTruthy();
  });

  it("leaves room under the content for the bar", () => {
    renderShell();

    expect(document.querySelector("main")?.className).toContain("pb-28");
  });

  it("opens the More sheet from the bar", async () => {
    const user = userEvent.setup();
    renderShell();

    await user.click(screen.getByRole("button", { name: "More" }));

    const sheet = screen.getByRole("dialog", { name: "More" });

    expect(sheet).toBeVisible();
    // Scoped: the hidden desktop sidebar also carries a Calendar link.
    expect(within(sheet).getByRole("link", { name: "Calendar" })).toBeVisible();
    expect(within(sheet).getByRole("link", { name: "Maps" })).toBeVisible();
  });

  it("shows the unread count on the desktop Signals nav link", () => {
    signalMocks.unreadSignalCount = 5;
    renderShell();

    const signalsLink = screen.getByRole("link", { name: /Signals/ });

    expect(within(signalsLink).getByLabelText("5 unread")).toBeVisible();
  });

  it("shows the unread indicator dot when the rail is collapsed with unread signals", async () => {
    signalMocks.unreadSignalCount = 3;
    renderShell();

    const user = userEvent.setup();
    const collapseButton = screen.getByRole("button", { name: "Collapse navigation" });

    // Collapse the rail
    await user.click(collapseButton);

    // When collapsed, the Signals link has no text label, but the unread dot is present
    const signalsLink = screen.getByTitle("Signals");

    expect(within(signalsLink).getByLabelText("Unread signals")).toBeVisible();
  });
});
