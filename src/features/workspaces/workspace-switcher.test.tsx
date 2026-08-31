import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { WorkspaceProvider } from "./workspace-context";
import { WorkspaceSwitcher } from "./workspace-switcher";

const switcherMocks = vi.hoisted(() => ({
  listWorkspaces: vi.fn(),
  createWorkspace: vi.fn(),
  unreadByWorkspace: new Map<string, number>(),
}));

const navigateMock = vi.fn();

vi.mock("../../lib/supabase/client", () => ({ supabase: {} }));

vi.mock("./workspaces.queries", () => ({
  listWorkspaces: switcherMocks.listWorkspaces,
  createWorkspace: switcherMocks.createWorkspace,
  workspacesQueryKey: ["workspaces"],
}));

vi.mock("../signals/signal-badge", () => ({
  useUnreadByWorkspace: () => switcherMocks.unreadByWorkspace,
}));

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => navigateMock };
});

function renderSwitcher(isCollapsed = false) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <WorkspaceProvider workspaceId="ws-1">
          <WorkspaceSwitcher isCollapsed={isCollapsed} />
        </WorkspaceProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("WorkspaceSwitcher", () => {
  beforeEach(() => {
    navigateMock.mockReset();
    switcherMocks.createWorkspace.mockReset();
    switcherMocks.listWorkspaces.mockResolvedValue([
      { id: "ws-1", name: "Personal" },
      { id: "ws-2", name: "Acme" },
    ]);
    switcherMocks.unreadByWorkspace = new Map();
  });

  it("names the current workspace", async () => {
    renderSwitcher();

    expect(await screen.findByRole("button", { name: /Personal/ })).toBeTruthy();
  });

  it("switches to another workspace", async () => {
    const user = userEvent.setup();
    renderSwitcher();

    await user.click(await screen.findByRole("button", { name: /Personal/ }));
    await user.click(screen.getByRole("menuitem", { name: "Acme" }));

    expect(navigateMock).toHaveBeenCalledWith("/w/ws-2");
  });

  it("keeps the workspace name reachable when the rail is collapsed", async () => {
    renderSwitcher(true);

    expect(await screen.findByRole("button", { name: "Personal" })).toBeTruthy();
  });

  it("closes the menu on Escape", async () => {
    const user = userEvent.setup();
    renderSwitcher();

    await user.click(await screen.findByRole("button", { name: /Personal/ }));
    expect(screen.getByRole("menu")).toBeTruthy();

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("creates a workspace and moves to it", async () => {
    switcherMocks.createWorkspace.mockResolvedValue("ws-3");
    const user = userEvent.setup();
    renderSwitcher();

    await user.click(await screen.findByRole("button", { name: /Personal/ }));
    await user.click(screen.getByRole("menuitem", { name: "New workspace" }));
    await user.type(screen.getByLabelText("Workspace name"), "Orbit Labs");
    await user.click(screen.getByRole("button", { name: "Create workspace" }));

    expect(switcherMocks.createWorkspace).toHaveBeenCalledWith({}, "Orbit Labs");
    expect(navigateMock).toHaveBeenCalledWith("/w/ws-3");
  });

  it("marks other workspaces with unread signals, but not the current one", async () => {
    switcherMocks.unreadByWorkspace = new Map([
      ["ws-1", 4],
      ["ws-2", 1],
    ]);
    const user = userEvent.setup();
    renderSwitcher();

    await user.click(await screen.findByRole("button", { name: /Personal/ }));

    const currentItem = screen.getByRole("menuitem", { name: "Personal" });
    const otherItem = screen.getByRole("menuitem", { name: /^Acme/ });

    expect(within(currentItem).queryByLabelText("Unread signals")).not.toBeInTheDocument();
    expect(within(otherItem).getByLabelText("Unread signals")).toBeVisible();
  });

  it("keeps the modal open when creating fails", async () => {
    switcherMocks.createWorkspace.mockRejectedValue(new Error("name taken"));
    const user = userEvent.setup();
    renderSwitcher();

    await user.click(await screen.findByRole("button", { name: /Personal/ }));
    await user.click(screen.getByRole("menuitem", { name: "New workspace" }));
    await user.type(screen.getByLabelText("Workspace name"), "Orbit Labs");
    await user.click(screen.getByRole("button", { name: "Create workspace" }));

    expect(await screen.findByText("name taken")).toBeTruthy();
    expect(screen.getByLabelText("Workspace name")).toHaveValue("Orbit Labs");
  });
});
