import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { orbitAssets } from "../../lib/orbit-assets";
import type { Database } from "../../lib/supabase/database.types";
import { NotesPage } from "./notes-page";

vi.mock("../links/link-graph-panel", () => ({
  LinkGraphPanel: () => <div>Link graph</div>,
}));

vi.mock("../links/note-links.queries", () => ({
  listBacklinks: () => Promise.resolve([]),
  saveNoteLinks: () => Promise.resolve(),
  backlinksQueryKey: (workspaceId: string, kind: string, id: string) => [
    "note-links",
    "backlinks",
    workspaceId,
    kind,
    id,
  ],
}));

const notesMocks = vi.hoisted(() => ({
  createNote: vi.fn(),
  listNotes: vi.fn(),
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
    session: null,
    user: {
      id: "user-1",
    },
  }),
}));

vi.mock("./notes.queries", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./notes.queries")>();

  return {
    ...actual,
    createNote: notesMocks.createNote,
    listNotes: notesMocks.listNotes,
  };
});

vi.mock("../work-items/work-items.queries", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../work-items/work-items.queries")>();

  return {
    ...actual,
    createWorkItem: workItemMocks.createWorkItem,
  };
});

type Note = Database["public"]["Tables"]["notes"]["Row"];

function note(overrides: Partial<Note> = {}): Note {
  return {
    id: "note-1",
    workspace_id: "workspace-1",
    project_id: "project-1",
    work_item_id: null,
    note_type: "idea",
    title: "Turn this idea into work",
    body: "Build the smallest useful pass.",
    tags: [],
    created_by: "user-1",
    created_at: "2026-06-29T00:00:00.000Z",
    updated_at: "2026-06-29T00:00:00.000Z",
    ...overrides,
  };
}

function renderNotesPage(projectId: string | null = "project-1") {
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
        <NotesPage projectId={projectId ?? undefined} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("NotesPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    notesMocks.listNotes.mockResolvedValue([note()]);
    workItemMocks.createWorkItem.mockResolvedValue({});
  });

  it("creates a project task from a note", async () => {
    const user = userEvent.setup();

    renderNotesPage();

    await user.click(await screen.findByRole("button", { name: "Create task from Turn this idea into work" }));

    expect(workItemMocks.createWorkItem).toHaveBeenCalledWith(
      {},
      {
        workspaceId: "workspace-1",
        projectId: "project-1",
        userId: "user-1",
        title: "Turn this idea into work",
        description: "Build the smallest useful pass.",
        priority: "medium",
        status: "backlog",
      },
    );
    expect(await screen.findByText("Task created from note.")).toBeTruthy();
  });

  it("renders zero-count filters and the Brainstorm signal illustration", async () => {
    notesMocks.listNotes.mockResolvedValue([]);

    renderNotesPage();

    expect(await screen.findByRole("tab", { name: "All 0" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Idea 0" })).toBeVisible();
    expect(screen.getByRole("tab", { name: "Question 0" })).toBeVisible();
    expect(screen.getByRole("tab", { name: "Decision 0" })).toBeVisible();
    expect(screen.getByRole("tab", { name: "Risk 0" })).toBeVisible();
    expect(screen.getByRole("tab", { name: "Reference 0" })).toBeVisible();
    expect(await screen.findByRole("img", { name: "Signal nebula waiting for an idea" })).toHaveAttribute(
      "src",
      orbitAssets.illustrations.emptyBrainstorm,
    );
  });

  it("derives each filter count from the loaded notes", async () => {
    notesMocks.listNotes.mockResolvedValue([
      note(),
      note({ id: "note-2", note_type: "idea" }),
      note({ id: "note-3", note_type: "question" }),
    ]);

    renderNotesPage();

    expect(await screen.findByRole("tab", { name: "All 3" })).toBeVisible();
    expect(screen.getByRole("tab", { name: "Idea 2" })).toBeVisible();
    expect(screen.getByRole("tab", { name: "Question 1" })).toBeVisible();
    expect(screen.getByRole("tab", { name: "Decision 0" })).toBeVisible();
  });

  it("supports roving keyboard navigation across note filters", async () => {
    const user = userEvent.setup();
    notesMocks.listNotes.mockResolvedValue([]);

    renderNotesPage();

    const allFilter = await screen.findByRole("tab", { name: "All 0" });
    const ideaFilter = screen.getByRole("tab", { name: "Idea 0" });
    const referenceFilter = screen.getByRole("tab", { name: "Reference 0" });
    expect(allFilter).toHaveAttribute("tabindex", "0");
    expect(ideaFilter).toHaveAttribute("tabindex", "-1");

    allFilter.focus();
    await user.keyboard("{ArrowRight}");
    expect(ideaFilter).toHaveFocus();
    expect(ideaFilter).toHaveAttribute("aria-selected", "true");
    expect(allFilter).toHaveAttribute("tabindex", "-1");

    await user.keyboard("{ArrowLeft}");
    expect(allFilter).toHaveFocus();
    expect(allFilter).toHaveAttribute("aria-selected", "true");

    await user.keyboard("{ArrowLeft}");
    expect(referenceFilter).toHaveFocus();
    expect(referenceFilter).toHaveAttribute("aria-selected", "true");

    await user.keyboard("{Home}");
    expect(allFilter).toHaveFocus();
    expect(allFilter).toHaveAttribute("aria-selected", "true");
    await user.keyboard("{End}");
    expect(referenceFilter).toHaveFocus();
    expect(referenceFilter).toHaveAttribute("aria-selected", "true");

    await user.keyboard("{ArrowDown}");
    expect(allFilter).toHaveFocus();
    expect(allFilter).toHaveAttribute("aria-selected", "true");
    await user.keyboard("{ArrowUp}");
    expect(referenceFilter).toHaveFocus();
    expect(referenceFilter).toHaveAttribute("aria-selected", "true");
  });

  it("associates each filter tab with the filtered notes panel", async () => {
    notesMocks.listNotes.mockResolvedValue([
      note(),
      note({ id: "note-2", note_type: "question", title: "What should launch first?" }),
    ]);
    const user = userEvent.setup();

    renderNotesPage();

    const allFilter = await screen.findByRole("tab", { name: "All 2" });
    const questionFilter = screen.getByRole("tab", { name: "Question 1" });
    const results = screen.getByRole("tabpanel");

    expect(allFilter).toHaveAttribute("id", "brainstorm-filter-all");
    expect(allFilter).toHaveAttribute("aria-controls", "brainstorm-filter-results");
    expect(questionFilter).toHaveAttribute("aria-controls", "brainstorm-filter-results");
    expect(results).toHaveAttribute("id", "brainstorm-filter-results");
    expect(results).toHaveAttribute("aria-labelledby", "brainstorm-filter-all");

    await user.click(questionFilter);

    expect(results).toHaveAttribute("aria-labelledby", "brainstorm-filter-question");
    expect(screen.getByRole("heading", { name: "What should launch first?" })).toBeVisible();
  });

  it("keeps both capture entry points functional without equal emphasis", async () => {
    const user = userEvent.setup();
    notesMocks.listNotes.mockResolvedValue([]);

    renderNotesPage();

    await screen.findByRole("heading", { name: "No signals captured" });
    const buttons = screen.getAllByRole("button", { name: "Capture note" });
    expect(buttons).toHaveLength(2);
    expect(buttons[0]).toHaveClass("orbit-button");
    expect(buttons[1]).toHaveClass("orbit-button-tertiary");

    await user.click(buttons[0]);
    expect(screen.getByRole("dialog", { name: "Capture note" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog", { name: "Capture note" })).not.toBeInTheDocument();

    await user.click(screen.getAllByRole("button", { name: "Capture note" })[1]);
    expect(screen.getByRole("dialog", { name: "Capture note" })).toBeVisible();
  });

  it("shows the Orbit insights rail and privacy line on workspace notes", async () => {
    renderNotesPage(null);

    expect(await screen.findByRole("complementary", { name: "Orbit insights" })).toBeVisible();
    expect(screen.getByText("Capture early")).toBeVisible();
    expect(screen.getByText("Private to you. Your signals stay in your orbit.")).toBeVisible();
  });

  it("reveals and highlights the note named by the note search parameter", async () => {
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
    notesMocks.listNotes.mockResolvedValue([note({ id: "note-1", title: "Turn this idea into work" })]);

    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter initialEntries={["/notes?note=note-1"]}>
          <NotesPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    const heading = await screen.findByText("Turn this idea into work");
    expect(heading.closest("li")).toHaveClass("ring-2");
  });

  it("hides the Orbit insights rail on project notes", async () => {
    renderNotesPage();

    expect(await screen.findByText("Turn this idea into work")).toBeVisible();
    expect(screen.queryByRole("complementary", { name: "Orbit insights" })).not.toBeInTheDocument();
    expect(screen.queryByText("Private to you. Your signals stay in your orbit.")).not.toBeInTheDocument();
  });

  it("narrows to notes carrying a tag when its pill is pressed", async () => {
    notesMocks.listNotes.mockResolvedValue([
      note({ id: "note-1", title: "Design the empty state", tags: ["design"] }),
      note({ id: "note-2", title: "Ship the migration", tags: ["ops"] }),
    ]);
    const user = userEvent.setup();
    renderNotesPage();

    expect(await screen.findByText("Ship the migration")).toBeVisible();

    const rail = screen.getByLabelText("Filter by tag");
    await user.click(within(rail).getByRole("button", { name: /design/ }));

    expect(screen.getByText("Design the empty state")).toBeVisible();
    expect(screen.queryByText("Ship the migration")).toBeNull();
  });

  it("narrows with AND when two tags are pressed", async () => {
    notesMocks.listNotes.mockResolvedValue([
      note({ id: "note-1", title: "Both tags", tags: ["design", "ops"] }),
      note({ id: "note-2", title: "Only design", tags: ["design"] }),
    ]);
    const user = userEvent.setup();
    renderNotesPage();

    const rail = await screen.findByLabelText("Filter by tag");
    await user.click(within(rail).getByRole("button", { name: /design/ }));
    await user.click(within(rail).getByRole("button", { name: /ops/ }));

    expect(screen.getByText("Both tags")).toBeVisible();
    expect(screen.queryByText("Only design")).toBeNull();
  });

  it("counts each tag once however it was capitalised", async () => {
    notesMocks.listNotes.mockResolvedValue([
      note({ id: "note-1", tags: ["Design"] }),
      note({ id: "note-2", tags: ["design"] }),
    ]);
    renderNotesPage();

    const rail = await screen.findByLabelText("Filter by tag");

    expect(within(rail).getAllByRole("button", { name: /design/ })).toHaveLength(1);
    expect(within(rail).getByRole("button", { name: /design/ })).toHaveTextContent("2");
  });

  it("swaps the note list for the graph and back", async () => {
    notesMocks.listNotes.mockResolvedValue([note({ title: "Ship the migration" })]);
    const user = userEvent.setup();
    renderNotesPage(null);

    expect(await screen.findByText("Ship the migration")).toBeVisible();

    await user.click(screen.getByRole("tab", { name: "Graph" }));

    expect(screen.getByText("Link graph")).toBeVisible();
    expect(screen.queryByText("Ship the migration")).not.toBeVisible();

    await user.click(screen.getByRole("tab", { name: "List" }));

    expect(screen.getByText("Ship the migration")).toBeVisible();
  });

  it("does not offer the graph inside a project, where it would show the whole workspace", async () => {
    notesMocks.listNotes.mockResolvedValue([note()]);
    renderNotesPage("project-1");

    await screen.findByText("Turn this idea into work");

    expect(screen.queryByRole("tab", { name: "Graph" })).toBeNull();
  });
});
