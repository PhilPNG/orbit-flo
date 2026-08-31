import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { orbitAssets } from "../../lib/orbit-assets";
import type { Database } from "../../lib/supabase/database.types";
import { listInboxCaptures } from "./captures.queries";
import { InboxPage } from "./inbox-page";

const inboxMocks = vi.hoisted(() => ({
  listInboxCaptures: vi.fn(),
  updateCapture: vi.fn(),
}));

const projectMocks = vi.hoisted(() => ({
  listProjects: vi.fn(),
}));

const noteMocks = vi.hoisted(() => ({
  createNote: vi.fn(),
}));

const workItemMocks = vi.hoisted(() => ({
  createWorkItem: vi.fn(),
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
    user: { id: "user-1" },
  }),
}));

vi.mock("./captures.queries", () => ({
  listInboxCaptures: inboxMocks.listInboxCaptures,
  updateCapture: inboxMocks.updateCapture,
}));

vi.mock("../projects/projects.queries", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../projects/projects.queries")>();
  return { ...actual, listProjects: projectMocks.listProjects };
});

vi.mock("../notes/notes.queries", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../notes/notes.queries")>();
  return { ...actual, createNote: noteMocks.createNote };
});

vi.mock("../work-items/work-items.queries", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../work-items/work-items.queries")>();
  return { ...actual, createWorkItem: workItemMocks.createWorkItem };
});

type Capture = Database["public"]["Tables"]["captures"]["Row"];
type Project = Database["public"]["Tables"]["projects"]["Row"];

function capture(overrides: Partial<Capture> = {}): Capture {
  return {
    id: "capture-1",
    workspace_id: "workspace-1",
    project_id: null,
    work_item_id: null,
    type: "task",
    title: "Inbox task",
    body: "Turn this into work.",
    processed_at: null,
    created_by: "user-1",
    created_at: "2026-06-29T00:00:00.000Z",
    updated_at: "2026-06-29T00:00:00.000Z",
    ...overrides,
  };
}

function project(overrides: Partial<Project> = {}): Project {
  return {
    id: "project-1",
    workspace_id: "workspace-1",
    name: "OrbitFlo",
    description: null,
    status: "active",
    priority: "medium",
    health: "good",
    color: null,
    rituals_title: null,
    is_favorite: false,
    created_by: "user-1",
    created_at: "2026-06-29T00:00:00.000Z",
    updated_at: "2026-06-29T00:00:00.000Z",
    ...overrides,
  };
}

function renderInboxPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return {
    queryClient,
    ...render(
      <QueryClientProvider client={queryClient}>
        <InboxPage />
      </QueryClientProvider>,
    ),
  };
}

describe("InboxPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    inboxMocks.listInboxCaptures.mockResolvedValue([capture()]);
    inboxMocks.updateCapture.mockResolvedValue({});
    noteMocks.createNote.mockResolvedValue({});
    projectMocks.listProjects.mockResolvedValue([project()]);
    workItemMocks.createWorkItem.mockResolvedValue({});
  });

  it("renders the compact signal receiver state with the queue count", async () => {
    vi.mocked(listInboxCaptures).mockResolvedValue([]);
    renderInboxPage();
    expect(await screen.findByRole("heading", { name: "Inbox" })).toBeVisible();
    expect(screen.getByText("0 open")).toBeVisible();
    expect(await screen.findByRole("img", { name: "Quiet orbital signal receiver" })).toHaveAttribute(
      "src",
      orbitAssets.illustrations.emptyInbox,
    );
    expect(screen.getByText("Inbox clear")).toBeVisible();
    expect(screen.getByText("New quick captures will arrive here until you process them.")).toBeVisible();
    expect(screen.getByText("Quick captures are stored here")).toBeVisible();
    expect(screen.getByText("We'll keep them safe until you're ready to take action.")).toBeVisible();
  });

  it("does not show the clear state while projects are loading", async () => {
    inboxMocks.listInboxCaptures.mockResolvedValue([]);
    projectMocks.listProjects.mockReturnValue(new Promise(() => undefined));

    renderInboxPage();

    expect(await screen.findByRole("heading", { name: "Loading inbox" })).toBeVisible();
    expect(screen.queryByText("Inbox clear")).not.toBeInTheDocument();
  });

  it("does not show the clear state when projects fail to load", async () => {
    inboxMocks.listInboxCaptures.mockResolvedValue([]);
    projectMocks.listProjects.mockRejectedValue(new Error("Project telemetry unavailable"));

    renderInboxPage();

    expect(await screen.findByRole("heading", { name: "Could not load projects" })).toBeVisible();
    expect(screen.queryByText("Inbox clear")).not.toBeInTheDocument();
  });

  it("converts a capture into a project task", async () => {
    const user = userEvent.setup();

    renderInboxPage();

    await user.selectOptions(await screen.findByLabelText("Task project"), "project-1");
    await user.click(screen.getByRole("button", { name: "Create task from Inbox task" }));

    expect(workItemMocks.createWorkItem).toHaveBeenCalledWith(
      {},
      {
        workspaceId: "workspace-1",
        projectId: "project-1",
        userId: "user-1",
        title: "Inbox task",
        description: "Turn this into work.",
        priority: "medium",
        status: "backlog",
      },
    );
    expect(inboxMocks.updateCapture).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        id: "capture-1",
        workspaceId: "workspace-1",
        projectId: "project-1",
        processedAt: expect.any(String),
      }),
    );
  });

  it("raises the selected capture above the quiet queue", async () => {
    renderInboxPage();

    await screen.findByRole("button", { name: /Inbox task\s*task/i });

    const detailPanel = screen.getByRole("heading", { name: "Inbox task" }).closest(".surface-raised");
    expect(detailPanel).toHaveClass("surface-raised");
    expect(screen.getByText("Up next").closest(".surface-quiet")).toHaveClass("surface-quiet");
  });

  it("converts a capture into a task with triage metadata", async () => {
    const user = userEvent.setup();

    renderInboxPage();

    await user.selectOptions(await screen.findByLabelText("Task project"), "project-1");
    await user.selectOptions(screen.getByLabelText("Task priority"), "high");
    await user.selectOptions(screen.getByLabelText("Task status"), "ready");
    await user.type(screen.getByLabelText("Task due date"), "2026-07-10");
    await user.click(screen.getByRole("button", { name: "Create task from Inbox task" }));

    expect(workItemMocks.createWorkItem).toHaveBeenCalledWith(
      {},
      {
        workspaceId: "workspace-1",
        projectId: "project-1",
        userId: "user-1",
        title: "Inbox task",
        description: "Turn this into work.",
        dueDate: "2026-07-10",
        priority: "high",
        status: "ready",
      },
    );
  });

  it("resets task metadata when a refetch changes the selected capture", async () => {
    const user = userEvent.setup();
    const captureA = capture({
      id: "capture-a",
      title: "Capture A",
      body: "First capture.",
      project_id: null,
    });
    const captureB = capture({
      id: "capture-b",
      title: "Capture B",
      body: "Second capture.",
      project_id: "project-2",
    });

    inboxMocks.listInboxCaptures.mockResolvedValueOnce([captureA, captureB]).mockResolvedValueOnce([captureB]);
    projectMocks.listProjects.mockResolvedValue([
      project({ id: "project-1", name: "Selected for A" }),
      project({ id: "project-2", name: "Default for B" }),
    ]);

    const { queryClient } = renderInboxPage();

    await user.selectOptions(await screen.findByLabelText("Task project"), "project-1");
    await user.selectOptions(screen.getByLabelText("Task priority"), "high");
    await user.selectOptions(screen.getByLabelText("Task status"), "ready");
    await user.type(screen.getByLabelText("Task due date"), "2026-07-10");

    await queryClient.invalidateQueries({ queryKey: ["inbox-captures", "workspace-1"] });
    await user.click(await screen.findByRole("button", { name: "Create task from Capture B" }));

    expect(workItemMocks.createWorkItem).toHaveBeenCalledWith(
      {},
      {
        workspaceId: "workspace-1",
        projectId: "project-2",
        userId: "user-1",
        title: "Capture B",
        description: "Second capture.",
        priority: "medium",
        status: "backlog",
      },
    );
  });

  it("creates a note from the selected capture", async () => {
    const user = userEvent.setup();

    renderInboxPage();

    await user.click(await screen.findByRole("button", { name: "Show note options for Inbox task" }));
    await user.selectOptions(screen.getByLabelText("Note project"), "project-1");
    await user.click(screen.getByRole("button", { name: "Create note from Inbox task" }));

    expect(noteMocks.createNote).toHaveBeenCalledWith(
      {},
      {
        workspaceId: "workspace-1",
        projectId: "project-1",
        userId: "user-1",
        noteType: "reference",
        title: "Inbox task",
        body: "Turn this into work.",
        tags: ["inbox"],
      },
    );
  });

  it("preserves the capture project when creating a note without changing the note project", async () => {
    const user = userEvent.setup();

    inboxMocks.listInboxCaptures.mockResolvedValue([capture({ project_id: "project-1" })]);

    renderInboxPage();

    await user.click(await screen.findByRole("button", { name: "Show note options for Inbox task" }));
    await user.click(screen.getByRole("button", { name: "Create note from Inbox task" }));

    expect(noteMocks.createNote).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        projectId: "project-1",
      }),
    );
  });

  it("archives the selected capture", async () => {
    const user = userEvent.setup();

    renderInboxPage();

    await user.click(await screen.findByRole("button", { name: "Archive Inbox task" }));

    expect(inboxMocks.updateCapture).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        id: "capture-1",
        workspaceId: "workspace-1",
        processedAt: expect.any(String),
      }),
    );
  });
});
