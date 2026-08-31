import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { MilestonePage } from "./milestone-page";

vi.mock("../../lib/supabase/client", () => ({ supabase: {} }));

vi.mock("../workspaces/workspace-context", () => ({
  useWorkspaceId: () => "workspace-1",
}));

const { loadMilestoneMock } = vi.hoisted(() => ({
  loadMilestoneMock: vi.fn().mockResolvedValue({
    id: "m1",
    projectId: "p1",
    projectName: "Orbit Flo",
    title: "Ship the graph",
    description: "Here is the **bold** plan.",
    targetDate: "2026-09-01",
    completedAt: null,
    tasks: [{ id: "t1", title: "Draw the link graph" }],
  }),
}));

vi.mock("./milestone.queries", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./milestone.queries")>()),
  loadMilestone: loadMilestoneMock,
}));

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/w/workspace-1/milestones/m1"]}>
        <Routes>
          <Route element={<MilestonePage />} path="/w/:workspaceId/milestones/:milestoneId" />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("MilestonePage", () => {
  it("renders the title and a linked task", async () => {
    renderPage();

    expect(await screen.findByText("Ship the graph")).toBeInTheDocument();
    expect(await screen.findByText("Draw the link graph")).toBeInTheDocument();
  });

  it("renders the description as markdown, not raw", async () => {
    renderPage();

    const bold = await screen.findByText("bold");
    expect(bold.tagName).toBe("STRONG");
    expect(screen.queryByText("**bold**")).not.toBeInTheDocument();
  });

  it("renders a not-found state and no title when the milestone is absent", async () => {
    loadMilestoneMock.mockResolvedValueOnce(null);

    renderPage();

    expect(await screen.findByText("Milestone not found")).toBeInTheDocument();
    expect(screen.queryByText("Ship the graph")).not.toBeInTheDocument();
  });

  it("renders an error state distinct from not-found when the query rejects", async () => {
    loadMilestoneMock.mockRejectedValueOnce(new Error("Network request failed"));

    renderPage();

    expect(await screen.findByText("Could not load the milestone")).toBeInTheDocument();
    expect(screen.getByText("Network request failed")).toBeInTheDocument();
    expect(screen.queryByText("Milestone not found")).not.toBeInTheDocument();
  });
});
