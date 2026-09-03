import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useNavigate } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Database } from "../../lib/supabase/database.types";
import { ProjectWorkspacePage } from "./project-workspace-page";

const workItemMocks = vi.hoisted(() => ({
  listWorkItems: vi.fn(),
}));

const boardColumnMocks = vi.hoisted(() => ({
  ensureDefaultBoardColumns: vi.fn(),
  moveWorkItemToColumn: vi.fn(),
}));

const detailMetaMocks = vi.hoisted(() => ({
  getWorkItemMeta: vi.fn(),
}));

const projectRowMocks = vi.hoisted(() => ({
  getProject: vi.fn(),
  updateProjectFavorite: vi.fn(),
}));

const ritualQueryMocks = vi.hoisted(() => ({
  ensureDefaultProjectRituals: vi.fn(),
  updateProjectRitualsTitle: vi.fn(),
}));

const milestoneMocks = vi.hoisted(() => ({
  createMilestone: vi.fn(),
  listProjectMilestones: vi.fn(),
  updateMilestone: vi.fn(),
}));

const projectBriefMocks = vi.hoisted(() => ({
  getProjectBrief: vi.fn(),
  upsertProjectBrief: vi.fn(),
}));

const launchChecklistMocks = vi.hoisted(() => ({
  createLaunchChecklist: vi.fn(),
  listLaunchChecklists: vi.fn(),
  updateLaunchChecklist: vi.fn(),
}));

const meetingMocks = vi.hoisted(() => ({
  convertMeetingActionItemToTask: vi.fn(),
  createMeetingNote: vi.fn(),
  listMeetingActionItems: vi.fn(),
  listMeetingNotes: vi.fn(),
}));

vi.mock("../../lib/supabase/client", () => ({
  supabase: {},
}));

vi.mock("../workspaces/workspace-context", () => ({
  useWorkspaceId: () => "workspace-1",
}));

vi.mock("../auth/use-auth", () => ({
  useAuth: () => ({
    isLoading: false,
    session: null,
    user: {
      id: "user-1",
    },
  }),
}));

vi.mock("./projects.queries", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./projects.queries")>();

  return {
    ...actual,
    getProject: projectRowMocks.getProject,
    updateProjectFavorite: projectRowMocks.updateProjectFavorite,
  };
});

vi.mock("./template-usage.queries", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./template-usage.queries")>();

  return {
    ...actual,
    listTemplateUsage: vi.fn().mockResolvedValue([]),
    incrementTemplateUsage: vi.fn().mockResolvedValue(undefined),
  };
});

vi.mock("./project-rituals.queries", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./project-rituals.queries")>();

  return {
    ...actual,
    ensureDefaultProjectRituals: ritualQueryMocks.ensureDefaultProjectRituals,
    updateProjectRitualsTitle: ritualQueryMocks.updateProjectRitualsTitle,
  };
});

vi.mock("../work-items/work-item-details.queries", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../work-items/work-item-details.queries")>();

  return {
    ...actual,
    getWorkItemMeta: detailMetaMocks.getWorkItemMeta,
    listComments: vi.fn().mockResolvedValue([]),
    listChecklistItems: vi.fn().mockResolvedValue([]),
    listAttachments: vi.fn().mockResolvedValue([]),
    listProjectLabels: vi.fn().mockResolvedValue([]),
    listWorkItemLabels: vi.fn().mockResolvedValue([]),
  };
});

vi.mock("../work-items/board-columns.queries", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../work-items/board-columns.queries")>();

  return {
    ...actual,
    ensureDefaultBoardColumns: boardColumnMocks.ensureDefaultBoardColumns,
    moveWorkItemToColumn: boardColumnMocks.moveWorkItemToColumn,
  };
});

vi.mock("../work-items/work-items.queries", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../work-items/work-items.queries")>();

  return {
    ...actual,
    createWorkItem: vi.fn(),
    listWorkItems: workItemMocks.listWorkItems,
    updateWorkItemStatus: vi.fn(),
  };
});

vi.mock("./milestones.queries", () => ({
  createMilestone: milestoneMocks.createMilestone,
  listProjectMilestones: milestoneMocks.listProjectMilestones,
  updateMilestone: milestoneMocks.updateMilestone,
}));

vi.mock("./project-brief.queries", () => ({
  getProjectBrief: projectBriefMocks.getProjectBrief,
  upsertProjectBrief: projectBriefMocks.upsertProjectBrief,
}));

vi.mock("./launch-checklist.queries", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./launch-checklist.queries")>();

  return {
    ...actual,
    createLaunchChecklist: launchChecklistMocks.createLaunchChecklist,
    listLaunchChecklists: launchChecklistMocks.listLaunchChecklists,
    updateLaunchChecklist: launchChecklistMocks.updateLaunchChecklist,
  };
});

vi.mock("../meetings/meeting-notes.queries", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../meetings/meeting-notes.queries")>();

  return {
    ...actual,
    convertMeetingActionItemToTask: meetingMocks.convertMeetingActionItemToTask,
    createMeetingNote: meetingMocks.createMeetingNote,
    listMeetingActionItems: meetingMocks.listMeetingActionItems,
    listMeetingNotes: meetingMocks.listMeetingNotes,
  };
});

vi.mock("../maps/project-maps-tab", () => ({
  ProjectMapsTab: ({ projectId }: { projectId: string }) => (
    <>
      <h1>Maps</h1>
      <p>Maps project ID: {projectId}</p>
    </>
  ),
}));

type Milestone = Database["public"]["Tables"]["milestones"]["Row"];
type MeetingActionItem = Database["public"]["Tables"]["meeting_action_items"]["Row"];
type WorkItem = Database["public"]["Tables"]["work_items"]["Row"];

function milestone(overrides: Partial<Milestone> = {}): Milestone {
  return {
    id: "milestone-1",
    workspace_id: "workspace-1",
    project_id: "project-1",
    title: "Beta launch",
    description: null,
    target_date: "2026-07-18",
    completed_at: null,
    sort_order: 0,
    created_by: "user-1",
    created_at: "2026-06-28T00:00:00.000Z",
    updated_at: "2026-06-28T00:00:00.000Z",
    ...overrides,
  };
}

function workItem(overrides: Partial<WorkItem> = {}): WorkItem {
  return {
    id: "work-item-1",
    workspace_id: "workspace-1",
    project_id: "project-1",
    milestone_id: null,
    assigned_to: null,
    column_id: null,
    recurrence_rule_id: null,
    occurrence_date: null,
    planned_at: null,
    planned_minutes: null,
    title: "Wire timeline",
    description: null,
    status: "ready",
    priority: "high",
    due_date: "2026-07-14",
    estimate_points: null,
    sort_order: 0,
    blocked_reason: null,
    created_by: "user-1",
    created_at: "2026-06-28T00:00:00.000Z",
    updated_at: "2026-06-28T00:00:00.000Z",
    completed_at: null,
    ...overrides,
  };
}

function meetingActionItem(overrides: Partial<MeetingActionItem> = {}): MeetingActionItem {
  return {
    id: "action-1",
    workspace_id: "workspace-1",
    meeting_note_id: "meeting-1",
    project_id: "project-1",
    work_item_id: null,
    title: "Follow up on launch risk",
    owner_label: "",
    due_date: "2026-07-15",
    is_converted: false,
    created_by: "user-1",
    created_at: "2026-07-01T00:00:00.000Z",
    updated_at: "2026-07-01T00:00:00.000Z",
    ...overrides,
  };
}

function RouteSwitcher() {
  const navigate = useNavigate();

  return (
    <button onClick={() => navigate("/projects/project-2")} type="button">
      Open project 2
    </button>
  );
}

function renderProjectWorkspacePage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/projects/project-1"]}>
        <RouteSwitcher />
        <Routes>
          <Route path="/projects/:projectId" element={<ProjectWorkspacePage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("ProjectWorkspacePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    workItemMocks.listWorkItems.mockResolvedValue([]);
    boardColumnMocks.ensureDefaultBoardColumns.mockResolvedValue(
      [
        ["col-backlog", "Docked", "backlog"],
        ["col-ready", "Ready to Launch", "ready"],
        ["col-progress", "Launching", "in_progress"],
        ["col-blocked", "Signal Lost", "blocked"],
        ["col-review", "In Orbit", "review"],
        ["col-done", "Mission Success", "done"],
      ].map(([id, title, status], index) => ({
        id,
        workspace_id: "workspace-1",
        project_id: "project-1",
        title,
        status_category: status,
        sort_order: index,
        created_by: "user-1",
        created_at: "2026-07-08T00:00:00.000Z",
        updated_at: "2026-07-08T00:00:00.000Z",
      })),
    );
    boardColumnMocks.moveWorkItemToColumn.mockResolvedValue({});
    detailMetaMocks.getWorkItemMeta.mockResolvedValue({
      labelsByItem: new Map(),
      checklistByItem: new Map(),
      commentCountByItem: new Map(),
      attachmentCountByItem: new Map(),
    });
    projectRowMocks.getProject.mockResolvedValue({
      id: "project-1",
      workspace_id: "workspace-1",
      name: "Project One",
      description: null,
      status: "active",
      priority: "medium",
      health: "on_track",
      color: null,
      rituals_title: null,
      is_favorite: false,
      created_by: "user-1",
      created_at: "2026-06-28T00:00:00.000Z",
      updated_at: "2026-06-28T00:00:00.000Z",
    });
    ritualQueryMocks.ensureDefaultProjectRituals.mockResolvedValue([]);
    ritualQueryMocks.updateProjectRitualsTitle.mockResolvedValue(undefined);
    window.localStorage.clear();
    milestoneMocks.createMilestone.mockResolvedValue({});
    milestoneMocks.listProjectMilestones.mockResolvedValue([]);
    milestoneMocks.updateMilestone.mockResolvedValue({});
    projectBriefMocks.getProjectBrief.mockResolvedValue(null);
    projectBriefMocks.upsertProjectBrief.mockResolvedValue({});
    launchChecklistMocks.createLaunchChecklist.mockResolvedValue({});
    launchChecklistMocks.listLaunchChecklists.mockResolvedValue([]);
    launchChecklistMocks.updateLaunchChecklist.mockResolvedValue({});
    meetingMocks.convertMeetingActionItemToTask.mockResolvedValue({});
    meetingMocks.createMeetingNote.mockResolvedValue({});
    meetingMocks.listMeetingActionItems.mockResolvedValue([]);
    meetingMocks.listMeetingNotes.mockResolvedValue([]);
    projectRowMocks.updateProjectFavorite.mockResolvedValue({});
  });

  it("opens the task named by the task search parameter", async () => {
    workItemMocks.listWorkItems.mockResolvedValue([workItem({ id: "work-item-1", title: "Wire timeline" })]);

    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter initialEntries={["/projects/project-1?task=work-item-1"]}>
          <Routes>
            <Route element={<ProjectWorkspacePage />} path="/projects/:projectId" />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    // The shared Modal names the dialog after the task title.
    expect(await screen.findByRole("dialog", { name: "Wire timeline" })).toBeTruthy();
  });

  it("copies the project ID to the clipboard", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });

    renderProjectWorkspacePage();

    await user.click(await screen.findByRole("button", { name: "Copy project ID" }));

    expect(writeText).toHaveBeenCalledWith("project-1");
  });

  it("toggles the mission favorite from the header star", async () => {
    const user = userEvent.setup();
    renderProjectWorkspacePage();

    await user.click(await screen.findByRole("button", { name: "Favorite mission" }));

    await waitFor(() => {
      expect(projectRowMocks.updateProjectFavorite).toHaveBeenCalledWith(
        {},
        { id: "project-1", workspaceId: "workspace-1", isFavorite: true },
      );
    });
  });

  it("lets the section tabs scroll rather than squashing them", () => {
    renderProjectWorkspacePage();

    const tab = screen.getByRole("tab", { name: "Meetings" });

    expect(tab.className).toContain("shrink-0");
    expect(tab.className).toContain("whitespace-nowrap");
  });

  it("keeps every workspace tab keyboard-focusable", () => {
    renderProjectWorkspacePage();

    for (const tabName of ["Board", "Tasks", "Timeline", "Meetings", "Launch", "Maps", "Notes", "Review"]) {
      const tab = screen.getByRole("tab", { name: tabName });

      expect(tab).not.toBeDisabled();
      expect(tab.tabIndex).toBe(0);
    }
  });

  it("keeps the compact board header, utilities, and every workspace tab", async () => {
    renderProjectWorkspacePage();

    expect(await screen.findByRole("heading", { name: "Mission workspace" })).toBeVisible();
    expect(screen.getByText("Project brief")).toBeVisible();
    expect(screen.getByText("Templates")).toBeVisible();
    expect(screen.getByText("Operating cadence")).toBeVisible();

    for (const tab of ["Board", "Tasks", "Timeline", "Meetings", "Launch", "Maps", "Notes", "Review"]) {
      expect(screen.getByRole("tab", { name: tab })).toBeVisible();
    }
  });

  it("renders task list and timeline tabs", async () => {
    const user = userEvent.setup();
    workItemMocks.listWorkItems.mockResolvedValue([workItem()]);
    milestoneMocks.listProjectMilestones.mockResolvedValue([milestone()]);

    renderProjectWorkspacePage();

    await user.click(screen.getByRole("tab", { name: "Tasks" }));
    expect(await screen.findByRole("heading", { name: "Task List" })).toBeTruthy();
    expect(screen.getByText("Wire timeline")).toBeTruthy();

    await user.click(screen.getByRole("tab", { name: "Timeline" }));
    expect(await screen.findByRole("heading", { name: "Project Timeline" })).toBeTruthy();
    expect(screen.getAllByText("Beta launch").length).toBeGreaterThan(0);
  });

  it("renders the project brief panel", async () => {
    renderProjectWorkspacePage();

    expect(await screen.findByText("Project brief")).toBeTruthy();
    expect(screen.getByLabelText("Project goal")).toBeTruthy();
  });

  it("resets a dirty empty project brief when opening another project with no brief", async () => {
    const user = userEvent.setup();
    renderProjectWorkspacePage();

    const projectGoal = await screen.findByLabelText("Project goal");
    await user.type(projectGoal, "Draft for the first project");
    await user.click(screen.getByRole("button", { name: "Open project 2" }));

    expect(await screen.findByText("Project ID: project-2")).toBeTruthy();
    expect(screen.getByLabelText("Project goal")).toHaveValue("");
  });

  it("creates a launch checklist from the Launch tab", async () => {
    const user = userEvent.setup();
    renderProjectWorkspacePage();

    await user.click(screen.getByRole("tab", { name: "Launch" }));
    await user.click(await screen.findByLabelText("Tests pass"));
    await user.click(screen.getByRole("button", { name: "Save launch checklist" }));

    expect(launchChecklistMocks.createLaunchChecklist).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        workspaceId: "workspace-1",
        projectId: "project-1",
        userId: "user-1",
        title: "Launch checklist",
      }),
    );
  });

  it("defers tab-specific data until the related workspace tab is opened", async () => {
    const user = userEvent.setup();
    renderProjectWorkspacePage();

    await screen.findByText("Project brief");

    expect(milestoneMocks.listProjectMilestones).not.toHaveBeenCalled();
    expect(launchChecklistMocks.listLaunchChecklists).not.toHaveBeenCalled();
    expect(meetingMocks.listMeetingNotes).not.toHaveBeenCalled();
    expect(meetingMocks.listMeetingActionItems).not.toHaveBeenCalled();

    await user.click(screen.getByRole("tab", { name: "Timeline" }));
    await screen.findByRole("heading", { name: "Milestones" });

    await waitFor(() => expect(milestoneMocks.listProjectMilestones).toHaveBeenCalled());
    expect(launchChecklistMocks.listLaunchChecklists).not.toHaveBeenCalled();
    expect(meetingMocks.listMeetingNotes).not.toHaveBeenCalled();

    await user.click(screen.getByRole("tab", { name: "Launch" }));
    await screen.findByRole("heading", { name: "Launch checklist" });

    expect(launchChecklistMocks.listLaunchChecklists).toHaveBeenCalled();

    await user.click(screen.getByRole("tab", { name: "Meetings" }));
    await screen.findByRole("heading", { name: "Meeting notes" });

    expect(meetingMocks.listMeetingNotes).toHaveBeenCalled();
    expect(meetingMocks.listMeetingActionItems).toHaveBeenCalled();
  });

  it("prefetches tab data when previewing project workspace tabs", async () => {
    const user = userEvent.setup();
    renderProjectWorkspacePage();

    await screen.findByText("Project brief");

    await user.hover(screen.getByRole("tab", { name: "Timeline" }));
    await waitFor(() => expect(milestoneMocks.listProjectMilestones).toHaveBeenCalled());
    expect(launchChecklistMocks.listLaunchChecklists).not.toHaveBeenCalled();
    expect(meetingMocks.listMeetingNotes).not.toHaveBeenCalled();

    await user.hover(screen.getByRole("tab", { name: "Launch" }));
    await waitFor(() => expect(launchChecklistMocks.listLaunchChecklists).toHaveBeenCalled());

    await user.hover(screen.getByRole("tab", { name: "Meetings" }));
    await waitFor(() => expect(meetingMocks.listMeetingNotes).toHaveBeenCalled());
    await waitFor(() => expect(meetingMocks.listMeetingActionItems).toHaveBeenCalled());
  });

  it("renders project maps from the Maps tab", async () => {
    const user = userEvent.setup();
    renderProjectWorkspacePage();

    await user.click(screen.getByRole("tab", { name: "Maps" }));

    expect(await screen.findByRole("heading", { name: "Maps" }, { timeout: 8000 })).toBeTruthy();
  }, 10000);

  it("opens the Maps tab when the URL carries ?map=", async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/projects/project-1?map=map-1"]}>
          <Routes>
            <Route element={<ProjectWorkspacePage />} path="/projects/:projectId" />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(screen.getByRole("tab", { name: "Maps" })).toHaveAttribute("aria-selected", "true");
    expect(await screen.findByRole("heading", { name: "Maps" })).toBeTruthy();
  });

  it("converts a meeting action item from the Meetings tab", async () => {
    const user = userEvent.setup();
    meetingMocks.listMeetingActionItems.mockResolvedValue([meetingActionItem()]);
    renderProjectWorkspacePage();

    await user.click(screen.getByRole("tab", { name: "Meetings" }));
    await user.click(await screen.findByRole("button", { name: "Convert Follow up on launch risk to task" }));

    expect(meetingMocks.convertMeetingActionItemToTask).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        id: "action-1",
        workspaceId: "workspace-1",
        projectId: "project-1",
        userId: "user-1",
      }),
    );
  });

  it("surfaces project brief load errors and disables saving", async () => {
    projectBriefMocks.getProjectBrief.mockRejectedValue(new Error("Brief telemetry offline"));

    renderProjectWorkspacePage();

    expect(await screen.findByText("Could not load project brief")).toBeTruthy();
    expect(screen.getByText("Brief telemetry offline")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Save project brief" })).toBeDisabled();
  });

  it("surfaces project brief save errors", async () => {
    const user = userEvent.setup();
    projectBriefMocks.upsertProjectBrief.mockRejectedValue(new Error("Brief save failed"));
    renderProjectWorkspacePage();

    await user.type(await screen.findByLabelText("Project goal"), "Save this brief");
    await user.click(screen.getByRole("button", { name: "Save project brief" }));

    expect(await screen.findByText("Brief save failed")).toBeTruthy();
  });

  it("clears stale project brief save errors when opening another project", async () => {
    const user = userEvent.setup();
    projectBriefMocks.upsertProjectBrief.mockRejectedValueOnce(new Error("First project save failed"));
    renderProjectWorkspacePage();

    await user.type(await screen.findByLabelText("Project goal"), "Save this brief");
    await user.click(screen.getByRole("button", { name: "Save project brief" }));

    expect(await screen.findByText("First project save failed")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Open project 2" }));

    expect(await screen.findByText("Project ID: project-2")).toBeTruthy();
    expect(screen.queryByText("First project save failed")).toBeNull();
  });
});
