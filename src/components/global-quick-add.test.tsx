import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GlobalQuickAdd } from "./global-quick-add";

const dailyPlanMocks = vi.hoisted(() => ({
  createCapture: vi.fn(),
}));

vi.mock("../lib/supabase/client", () => ({
  supabase: {},
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
  createCapture: dailyPlanMocks.createCapture,
}));

function renderGlobalQuickAdd() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <GlobalQuickAdd />
    </QueryClientProvider>,
  );
}

describe("GlobalQuickAdd", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dailyPlanMocks.createCapture.mockResolvedValue({});
  });

  it("creates an inbox capture from a quick add command", async () => {
    const user = userEvent.setup();

    renderGlobalQuickAdd();

    await user.type(screen.getByLabelText("Quick add"), "idea: Try split view planning tomorrow high");
    await user.click(screen.getByRole("button", { name: "Dock quick add" }));

    expect(dailyPlanMocks.createCapture).toHaveBeenCalledWith(
      {},
      {
        workspaceId: "workspace-1",
        userId: "user-1",
        type: "idea",
        title: "Try split view planning",
        body: "Parsed metadata: due tomorrow, priority high.",
      },
    );
    expect(await screen.findByText("Quick add docked.")).toBeTruthy();
    expect(screen.getByLabelText("Quick add")).toHaveValue("");
  });

  it("shows the shortcut hint and focuses the input on Ctrl+N", async () => {
    const user = userEvent.setup();

    renderGlobalQuickAdd();

    expect(screen.getByText("Ctrl N")).toBeTruthy();

    const input = screen.getByLabelText("Quick add");
    expect(input).not.toHaveFocus();

    await user.keyboard("{Control>}n{/Control}");

    expect(input).toHaveFocus();
  });
});
