import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import type { Database } from "../../lib/supabase/database.types";
import { ProjectsPage } from "./projects-page";

const projectsPageMocks = vi.hoisted(() => ({
  listProjects: vi.fn(),
  listRepositoryLinks: vi.fn(),
  listWorkspaceWorkItems: vi.fn(),
  updateProjectFavorite: vi.fn(),
}));

vi.mock("../../lib/supabase/client", () => ({
  supabase: {},
}));

vi.mock("../auth/use-auth", () => ({
  useAuth: () => ({ isLoading: false, user: { id: "user-1" } }),
}));

vi.mock("../workspaces/workspace-context", () => ({
  useWorkspaceId: () => "workspace-1",
}));

vi.mock("./projects.queries", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./projects.queries")>()),
  listProjects: projectsPageMocks.listProjects,
  updateProjectFavorite: projectsPageMocks.updateProjectFavorite,
}));

vi.mock("./project-links.queries", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./project-links.queries")>()),
  listRepositoryLinks: projectsPageMocks.listRepositoryLinks,
}));

vi.mock("../work-items/work-items.queries", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../work-items/work-items.queries")>()),
  listWorkspaceWorkItems: projectsPageMocks.listWorkspaceWorkItems,
}));

function renderProjectsPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  projectsPageMocks.listWorkspaceWorkItems.mockResolvedValue([]);
  // The card's repository link now comes from project_links, not a column.
  projectsPageMocks.listRepositoryLinks.mockResolvedValue(
    new Map([["project-1", "https://github.com/PhilPNG/PocketPup"]]),
  );

  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <ProjectsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

// Health degrades to "watch" once an active project goes 21 days without an
// update, so this stays relative to now rather than a fixed date.
const recentlyUpdatedAt = new Date(Date.now() - 2 * 86_400_000).toISOString();

const pocketPupProject: Database["public"]["Tables"]["projects"]["Row"] = {
  id: "project-1",
  workspace_id: "workspace-1",
  name: "PocketPup",
  description: "Digital dog care app",
  status: "active",
  priority: "medium",
  health: "good",
  color: null,
  rituals_title: null,
  is_favorite: false,
  created_by: "user-1",
  created_at: "2026-07-01T12:00:00.000Z",
  updated_at: recentlyUpdatedAt,
};

describe("ProjectsPage", () => {
  it("groups mission identity and telemetry in a navigable registry row", async () => {
    projectsPageMocks.listProjects.mockResolvedValue([pocketPupProject]);
    renderProjectsPage();

    const mission = await screen.findByRole("article", { name: "PocketPup mission" });
    expect(within(mission).getByText("active")).toBeVisible();
    expect(within(mission).getByText("medium")).toBeVisible();
    expect(within(mission).getByText("good")).toBeVisible();
    expect(within(mission).getByText("Project orbit looks stable.")).toBeVisible();
    expect(within(mission).getByRole("link", { name: "Open PocketPup mission" })).toHaveAttribute(
      "href",
      "/w/workspace-1/projects/project-1",
    );
    // The repository link resolves from a second query, so it lands after the card.
    expect(
      await within(mission).findByRole("link", { name: "https://github.com/PhilPNG/PocketPup" }),
    ).toHaveAttribute("href", "https://github.com/PhilPNG/PocketPup");
  });

  it("summarizes the registry with mission telemetry", async () => {
    projectsPageMocks.listProjects.mockResolvedValue([pocketPupProject]);
    renderProjectsPage();

    expect(await screen.findByText("Active projects")).toBeVisible();
    expect(screen.getByLabelText("Active projects count")).toHaveTextContent("1");
    expect(screen.getByLabelText("On track count")).toHaveTextContent("1");
    expect(screen.getByLabelText("Overall health count")).toHaveTextContent("Nominal");
  });

  it("toggles a mission favorite from the row star", async () => {
    const user = userEvent.setup();
    projectsPageMocks.listProjects.mockResolvedValue([pocketPupProject]);
    projectsPageMocks.updateProjectFavorite.mockResolvedValue(pocketPupProject);
    renderProjectsPage();

    await user.click(await screen.findByRole("button", { name: "Favorite PocketPup" }));

    expect(projectsPageMocks.updateProjectFavorite).toHaveBeenCalledWith(
      {},
      { id: pocketPupProject.id, workspaceId: "workspace-1", isFavorite: true },
    );
  });

  it("opens the Launch project modal", async () => {
    const user = userEvent.setup();
    projectsPageMocks.listProjects.mockResolvedValue([]);
    renderProjectsPage();

    await user.click(await screen.findByRole("button", { name: "Launch project" }));
    expect(screen.getByRole("dialog", { name: "Launch project" })).toBeVisible();
  });
});
