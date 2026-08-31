import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProjectRitualsPanel } from "./project-rituals-panel";

const ritualMocks = vi.hoisted(() => ({
  ensureDefaultProjectRituals: vi.fn(),
  createProjectRitual: vi.fn(),
  renameProjectRitual: vi.fn(),
  toggleProjectRitual: vi.fn(),
  deleteProjectRitual: vi.fn(),
}));

vi.mock("../../lib/supabase/client", () => ({ supabase: {} }));

vi.mock("./project-rituals.queries", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./project-rituals.queries")>();
  return { ...actual, ...ritualMocks };
});

function ritual(id: string, title: string, isDone: boolean, sortOrder: number) {
  return {
    id,
    workspace_id: "workspace-1",
    project_id: "project-1",
    title,
    is_done: isDone,
    sort_order: sortOrder,
    created_by: "user-1",
    created_at: "2026-07-12T00:00:00.000Z",
    updated_at: "2026-07-12T00:00:00.000Z",
  };
}

function renderPanel(overrides: { ritualsTitle?: string | null } = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const onRenameTitle = vi.fn<(title: string) => void>();
  const onHide = vi.fn<() => void>();

  render(
    <QueryClientProvider client={queryClient}>
      <ProjectRitualsPanel
        workspaceId="workspace-1"
        projectId="project-1"
        userId="user-1"
        ritualsTitle={overrides.ritualsTitle ?? null}
        onRenameTitle={onRenameTitle}
        onHide={onHide}
      />
    </QueryClientProvider>,
  );

  return { onRenameTitle, onHide };
}

describe("ProjectRitualsPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ritualMocks.ensureDefaultProjectRituals.mockResolvedValue([
      ritual("r1", "Weekly review ritual", true, 0),
      ritual("r2", "Backlog cleanup ritual", true, 1),
      ritual("r3", "Milestone check ritual", false, 2),
      ritual("r4", "Release prep ritual", false, 3),
    ]);
    ritualMocks.createProjectRitual.mockResolvedValue({});
    ritualMocks.renameProjectRitual.mockResolvedValue({});
    ritualMocks.toggleProjectRitual.mockResolvedValue({});
    ritualMocks.deleteProjectRitual.mockResolvedValue(undefined);
  });

  it("renders rituals with progress and the default title", async () => {
    renderPanel();

    expect(await screen.findByText("2/4 rituals checked")).toBeTruthy();
    expect(screen.getByText("Operating cadence")).toBeTruthy();
    expect(screen.getByRole("checkbox", { name: "Milestone check ritual" })).not.toBeChecked();
  });

  it("toggles a ritual", async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(await screen.findByRole("checkbox", { name: "Milestone check ritual" }));

    expect(ritualMocks.toggleProjectRitual).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ id: "r3", isDone: true }),
    );
  });

  it("adds a ritual with Enter using the next sort order", async () => {
    const user = userEvent.setup();
    renderPanel();

    await screen.findByText("2/4 rituals checked");
    await user.type(screen.getByLabelText("New ritual"), "Demo day prep{Enter}");

    expect(ritualMocks.createProjectRitual).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ title: "Demo day prep", sortOrder: 4 }),
    );
  });

  it("renames a ritual inline", async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(await screen.findByRole("button", { name: "Release prep ritual" }));
    const input = screen.getByLabelText("Ritual title");
    await user.clear(input);
    await user.type(input, "Launch prep{Enter}");

    expect(ritualMocks.renameProjectRitual).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ id: "r4", title: "Launch prep" }),
    );
  });

  it("renames the section title", async () => {
    const user = userEvent.setup();
    const { onRenameTitle } = renderPanel({ ritualsTitle: "Operating cadence" });

    await user.click(await screen.findByRole("button", { name: "Rename rituals section" }));
    const input = screen.getByLabelText("Rituals section title");
    await user.clear(input);
    await user.type(input, "Weekly habits{Enter}");

    expect(onRenameTitle).toHaveBeenCalledWith("Weekly habits");
  });

  it("hides via the close button", async () => {
    const user = userEvent.setup();
    const { onHide } = renderPanel();

    await user.click(await screen.findByRole("button", { name: "Hide rituals" }));

    expect(onHide).toHaveBeenCalled();
  });
});
