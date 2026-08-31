import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { WorkspaceProvider } from "../workspaces/workspace-context";
import { DashboardPage } from "./dashboard-page";

vi.mock("../../lib/supabase/client", () => ({ supabase: {} }));

vi.mock("../auth/use-auth", () => ({
  useAuth: () => ({
    isLoading: false,
    session: null,
    user: { id: "user-1" },
  }),
}));

const { getDashboardDataMock } = vi.hoisted(() => ({
  getDashboardDataMock: vi.fn().mockResolvedValue({
    projects: [],
    priorityWork: [
      {
        id: "w1",
        workspace_id: "workspace-1",
        project_id: "project-1",
        title: "Ship it",
        description: "Ship [the graph](orbit:task/8f2c1e04-1111-2222-3333-444455556666)",
        status: "ready",
        priority: "high",
        blocked_reason: null,
      },
    ],
    blockedWork: [],
    upcomingMilestones: [
      {
        id: "m1",
        project_id: "project-1",
        title: "Beta launch",
        description: "Ship [the graph](orbit:task/8f2c1e04-1111-2222-3333-444455556666)",
        target_date: null,
      },
    ],
    recentDecisions: [
      {
        id: "d1",
        title: "Ship the graph decision",
        body: "Ship [the graph](orbit:task/8f2c1e04-1111-2222-3333-444455556666)",
        updated_at: "2026-01-01T00:00:00.000Z",
      },
    ],
  }),
}));

vi.mock("./dashboard.queries", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./dashboard.queries")>()),
  getDashboardData: getDashboardDataMock,
}));

vi.mock("./dashboard-widgets.queries", () => ({
  listDashboardWidgetPreferences: vi.fn().mockResolvedValue([]),
  upsertDashboardWidgetPreferences: vi.fn().mockResolvedValue([]),
}));

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <WorkspaceProvider workspaceId="workspace-1">
          <DashboardPage />
        </WorkspaceProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("DashboardPage", () => {
  it("previews work item and milestone descriptions as text, not markup", async () => {
    renderPage();

    // 4 matches: the work item description, the milestone description, the
    // decision's own title ("Ship the graph decision"), and the decision
    // body preview text asserted separately below.
    expect(await screen.findAllByText(/Ship the graph/)).toHaveLength(4);
    expect(screen.queryByText(/orbit:task/)).not.toBeInTheDocument();
  });

  it("previews a decision note's body as its link label, not raw markdown", async () => {
    renderPage();

    // Decision notes are markdown too (authored via LinkingTextarea, rendered
    // with LinkedText on Brainstorm), so the dashboard card must strip them
    // the same way it strips work item and milestone descriptions.
    expect(await screen.findByText("Ship the graph decision")).toBeInTheDocument();
    const preview = await screen.findAllByText(/Ship the graph$/);
    expect(preview.length).toBeGreaterThan(0);
    expect(screen.queryByText(/orbit:task/)).not.toBeInTheDocument();
  });
});
