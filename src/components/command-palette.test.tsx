import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { CommandPalette } from "./command-palette";

const commandPaletteMocks = vi.hoisted(() => ({
  createCapture: vi.fn(),
  navigate: vi.fn(),
  supabase: {},
}));

const searchMocks = vi.hoisted(() => ({
  searchWorkspace: vi.fn(),
}));

vi.mock("../features/search/search.queries", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../features/search/search.queries")>()),
  searchWorkspace: searchMocks.searchWorkspace,
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");

  return {
    ...actual,
    useNavigate: () => commandPaletteMocks.navigate,
  };
});

vi.mock("../lib/supabase/client", () => ({
  supabase: commandPaletteMocks.supabase,
}));

vi.mock("../features/workspaces/workspace-context", () => ({
  useWorkspaceId: () => "workspace-1",
}));

vi.mock("../features/auth/use-auth", () => ({
  useAuth: () => ({
    isLoading: false,
    user: {
      id: "user-1",
    },
  }),
}));

vi.mock("../features/daily/daily-plan.queries", () => ({
  createCapture: commandPaletteMocks.createCapture,
}));

function renderCommandPalette() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <CommandPalette />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("CommandPalette", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    commandPaletteMocks.createCapture.mockResolvedValue({});
    searchMocks.searchWorkspace.mockResolvedValue([]);
  });

  it("opens with Ctrl+K, filters to Inbox, and navigates to Inbox", async () => {
    const user = userEvent.setup();

    renderCommandPalette();

    await user.keyboard("{Control>}k{/Control}");
    expect(screen.getByRole("dialog", { name: "Command palette" })).toBeTruthy();

    await user.type(screen.getByLabelText("Search commands"), "Inbox");
    expect(screen.getByRole("button", { name: "Open Inbox" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Open Today" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Open Inbox" }));

    expect(commandPaletteMocks.navigate).toHaveBeenCalledWith("/w/workspace-1/inbox");
    expect(screen.queryByRole("dialog", { name: "Command palette" })).not.toBeInTheDocument();
  });

  it("creates a quick capture from the command query", async () => {
    const user = userEvent.setup();

    renderCommandPalette();

    await user.click(screen.getByRole("button", { name: "Open command palette" }));
    await user.type(screen.getByLabelText("Search commands"), "idea: Simplify project cards");
    await user.click(screen.getByRole("button", { name: "Capture idea: Simplify project cards" }));

    await waitFor(() => {
      expect(commandPaletteMocks.createCapture).toHaveBeenCalledWith(
        commandPaletteMocks.supabase,
        {
          workspaceId: "workspace-1",
          userId: "user-1",
          type: "idea",
          title: "Simplify project cards",
          body: "Captured from global quick add.",
        },
      );
    });
    expect(await screen.findByText("Capture added to Inbox.")).toBeTruthy();
  });

  it("renders the command palette as an orbital HUD", async () => {
    const user = userEvent.setup();

    renderCommandPalette();

    await user.click(screen.getByRole("button", { name: "Open command palette" }));
    const dialog = screen.getByRole("dialog", { name: "Command palette" });

    expect(dialog.querySelector(".orbit-hud-surface")).toBeTruthy();
    expect(dialog.querySelector(".orbit-hud-scan")).toBeNull();
    expect(dialog.querySelector(".orbit-command-radar")).toBeNull();
  });

  it("shows grouped results for a search term", async () => {
    const user = userEvent.setup();
    searchMocks.searchWorkspace.mockResolvedValue([
      {
        id: "t1",
        type: "task",
        title: "Wire the timeline",
        subtitle: "PocketPup",
        to: "/projects/p1?task=t1",
        matchedTitle: true,
        updatedAt: "2026-08-07T00:00:00.000Z",
      },
      {
        id: "n1",
        type: "note",
        title: "Timeline idea",
        subtitle: "idea",
        to: "/notes?note=n1",
        matchedTitle: true,
        updatedAt: "2026-08-06T00:00:00.000Z",
      },
    ]);

    renderCommandPalette();
    await user.click(screen.getByRole("button", { name: "Open command palette" }));
    await user.type(screen.getByLabelText("Search commands"), "timeline");

    expect(await screen.findByText("Wire the timeline")).toBeVisible();
    expect(screen.getByText("Timeline idea")).toBeVisible();
    expect(screen.getByRole("heading", { name: "Tasks" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Notes" })).toBeVisible();
  });

  it("shows a milestone result under its heading", async () => {
    const user = userEvent.setup();
    searchMocks.searchWorkspace.mockResolvedValue([
      {
        id: "m1",
        type: "milestone",
        title: "Ship the graph",
        subtitle: null,
        to: "/milestones/m1",
        matchedTitle: true,
        updatedAt: "2026-08-07T00:00:00.000Z",
      },
    ]);

    renderCommandPalette();
    await user.click(screen.getByRole("button", { name: "Open command palette" }));
    await user.type(screen.getByLabelText("Search commands"), "is:milestone graph");

    expect(await screen.findByText("Ship the graph")).toBeVisible();
    expect(screen.getByRole("heading", { name: "Milestones" })).toBeVisible();
  });

  it("navigates to a highlighted result with the keyboard", async () => {
    const user = userEvent.setup();
    searchMocks.searchWorkspace.mockResolvedValue([
      {
        id: "t1",
        type: "task",
        title: "Wire the timeline",
        subtitle: "PocketPup",
        to: "/projects/p1?task=t1",
        matchedTitle: true,
        updatedAt: "2026-08-07T00:00:00.000Z",
      },
    ]);

    renderCommandPalette();
    await user.click(screen.getByRole("button", { name: "Open command palette" }));
    await user.type(screen.getByLabelText("Search commands"), "timeline");
    expect(await screen.findByText("Wire the timeline")).toBeVisible();

    // No nav command matches "timeline", so the task is the only navigable row.
    await user.keyboard("{Enter}");

    expect(commandPaletteMocks.navigate).toHaveBeenCalledWith("/w/workspace-1/projects/p1?task=t1");
  });

  it("does not search below the minimum term length", async () => {
    const user = userEvent.setup();

    renderCommandPalette();
    await user.click(screen.getByRole("button", { name: "Open command palette" }));
    await user.type(screen.getByLabelText("Search commands"), "t");

    await waitFor(() => {
      expect(searchMocks.searchWorkspace).not.toHaveBeenCalled();
    });
  });
});
