import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import type { Database } from "../../lib/supabase/database.types";
import { WorkItemCardModal } from "./work-item-card-modal";

vi.mock("../workspaces/workspace-context", () => ({
  useWorkspaceId: () => "workspace-1",
}));

vi.mock("../links/unlinked-mentions.queries", () => ({
  listUnlinkedMentions: () => Promise.resolve([]),
  linkMention: () => Promise.resolve(""),
  unlinkedMentionsQueryKey: (workspaceId: string, kind: string, id: string) => [
    "note-links",
    "mentions",
    workspaceId,
    kind,
    id,
  ],
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

type WorkItem = Database["public"]["Tables"]["work_items"]["Row"];

const detailMocks = vi.hoisted(() => ({
  listComments: vi.fn(),
  createComment: vi.fn(),
  deleteComment: vi.fn(),
  listProjectLabels: vi.fn(),
  createLabel: vi.fn(),
  assignLabel: vi.fn(),
  unassignLabel: vi.fn(),
  listWorkItemLabels: vi.fn(),
  listChecklistItems: vi.fn(),
  createChecklistItem: vi.fn(),
  toggleChecklistItem: vi.fn(),
  deleteChecklistItem: vi.fn(),
  listAttachments: vi.fn(),
  uploadAttachment: vi.fn(),
  deleteAttachment: vi.fn(),
  getAttachmentUrl: vi.fn(),
}));

vi.mock("../../lib/supabase/client", () => ({ supabase: {} }));

vi.mock("../auth/use-auth", () => ({
  useAuth: () => ({ isLoading: false, user: { id: "user-1" } }),
}));

vi.mock("./work-item-details.queries", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./work-item-details.queries")>();
  return { ...actual, ...detailMocks };
});

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
    description: "Original notes",
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

function renderModal(onSubmit = vi.fn(), item = workItem()) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <WorkItemCardModal item={item} milestones={[]} onClose={() => undefined} onSubmit={onSubmit} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return onSubmit;
}

describe("WorkItemCardModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    detailMocks.listComments.mockResolvedValue([
      {
        id: "c1",
        workspace_id: "workspace-1",
        work_item_id: "work-item-1",
        body: "First pass looks good",
        created_by: "user-1",
        created_at: "2026-07-09T00:00:00.000Z",
        updated_at: "2026-07-09T00:00:00.000Z",
      },
    ]);
    detailMocks.listChecklistItems.mockResolvedValue([
      { id: "ck1", workspace_id: "workspace-1", work_item_id: "work-item-1", title: "Draft schema", is_done: true, sort_order: 0, created_by: "user-1", created_at: "", updated_at: "" },
      { id: "ck2", workspace_id: "workspace-1", work_item_id: "work-item-1", title: "Write tests", is_done: false, sort_order: 1, created_by: "user-1", created_at: "", updated_at: "" },
    ]);
    detailMocks.listAttachments.mockResolvedValue([
      { id: "att1", workspace_id: "workspace-1", work_item_id: "work-item-1", file_name: "spec.pdf", storage_path: "workspace-1/work-item-1/spec.pdf", mime_type: "application/pdf", size_bytes: 2048, created_by: "user-1", created_at: "" },
    ]);
    detailMocks.listProjectLabels.mockResolvedValue([
      { id: "l1", workspace_id: "workspace-1", project_id: "project-1", name: "Design", color: "violet", created_by: "user-1", created_at: "", updated_at: "" },
      { id: "l2", workspace_id: "workspace-1", project_id: "project-1", name: "Backend", color: "cyan", created_by: "user-1", created_at: "", updated_at: "" },
    ]);
    detailMocks.listWorkItemLabels.mockResolvedValue([
      { id: "l1", workspace_id: "workspace-1", project_id: "project-1", name: "Design", color: "violet", created_by: "user-1", created_at: "", updated_at: "" },
    ]);
    detailMocks.createComment.mockResolvedValue({});
    detailMocks.createChecklistItem.mockResolvedValue({});
    detailMocks.toggleChecklistItem.mockResolvedValue({});
    detailMocks.assignLabel.mockResolvedValue(undefined);
    detailMocks.createLabel.mockResolvedValue({});
  });

  it("renders comments, checklist progress, attachments, and labels", async () => {
    renderModal();

    expect(await screen.findByText("First pass looks good")).toBeTruthy();
    expect(await screen.findByText("1/2")).toBeTruthy();
    expect(await screen.findByText("spec.pdf")).toBeTruthy();
    expect(await screen.findByRole("button", { name: "Remove label Design" })).toBeTruthy();
  });

  it("renders the approved hierarchy and announces checklist progress", async () => {
    detailMocks.listChecklistItems.mockResolvedValue([
      { id: "ck1", workspace_id: "workspace-1", work_item_id: "work-item-1", title: "Define the user outcome", is_done: true, sort_order: 0, created_by: "user-1", created_at: "", updated_at: "" },
      { id: "ck2", workspace_id: "workspace-1", work_item_id: "work-item-1", title: "Confirm the smallest workflow", is_done: true, sort_order: 1, created_by: "user-1", created_at: "", updated_at: "" },
      { id: "ck3", workspace_id: "workspace-1", work_item_id: "work-item-1", title: "Capture empty and error states", is_done: false, sort_order: 2, created_by: "user-1", created_at: "", updated_at: "" },
      { id: "ck4", workspace_id: "workspace-1", work_item_id: "work-item-1", title: "Write acceptance criteria", is_done: false, sort_order: 3, created_by: "user-1", created_at: "", updated_at: "" },
    ]);

    renderModal(vi.fn(), workItem({ title: "Define the smallest useful version" }));

    expect(await screen.findByRole("heading", { name: "Define the smallest useful version" })).toBeVisible();
    expect(screen.getByText("Context snapshot")).toBeVisible();
    const progress = await screen.findByRole("progressbar", { name: "Checklist progress" });
    expect(progress).toHaveAttribute("aria-valuenow", "50");
    expect(progress).toHaveAccessibleDescription("2 of 4 complete");
  });

  it("shows the user-facing Ready to Launch status label", async () => {
    renderModal();

    expect(await screen.findByRole("option", { name: "Ready to Launch" })).toBeVisible();
    expect(screen.queryByRole("option", { name: "ready" })).not.toBeInTheDocument();
  });

  it("closes on Escape and restores focus", async () => {
    const user = userEvent.setup();

    function Harness() {
      const [isOpen, setIsOpen] = useState(false);
      return (
        <>
          <button onClick={() => setIsOpen(true)} type="button">
            Open card
          </button>
          {isOpen ? (
            <WorkItemCardModal
              item={workItem()}
              milestones={[]}
              onClose={() => setIsOpen(false)}
              onSubmit={vi.fn()}
            />
          ) : null}
        </>
      );
    }

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <Harness />
      </QueryClientProvider>,
    );
    const opener = screen.getByRole("button", { name: "Open card" });

    await user.click(opener);
    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });

  it("adds a checklist item with Enter", async () => {
    const user = userEvent.setup();
    renderModal();

    await user.type(await screen.findByLabelText("New checklist item"), "Verify RLS{Enter}");

    expect(detailMocks.createChecklistItem).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ title: "Verify RLS", workItemId: "work-item-1", sortOrder: 2 }),
    );
  });

  it("toggles a checklist item", async () => {
    const user = userEvent.setup();
    renderModal();

    await user.click(await screen.findByRole("checkbox", { name: "Write tests" }));

    expect(detailMocks.toggleChecklistItem).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ id: "ck2", isDone: true }),
    );
  });

  it("renders comment bodies as markdown with mentions", async () => {
    // Switching to LinkedText gives comments markdown as a deliberate side effect.
    detailMocks.listComments.mockResolvedValue([
      {
        id: "c1",
        workspace_id: "workspace-1",
        work_item_id: "work-item-1",
        body: "Ping [@Ada](orbit:user/11111111-1111-1111-1111-111111111111)",
        created_by: "user-1",
        created_at: "2026-07-09T00:00:00.000Z",
        updated_at: "2026-07-09T00:00:00.000Z",
      },
    ]);

    renderModal();

    expect(await screen.findByText("@Ada")).toBeInTheDocument();
  });

  it("posts a comment", async () => {
    const user = userEvent.setup();
    renderModal();

    await user.type(await screen.findByLabelText("Add a comment"), "Shipping tomorrow");
    await user.click(screen.getByRole("button", { name: "Comment" }));

    expect(detailMocks.createComment).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ body: "Shipping tomorrow" }),
    );
  });

  it("assigns an unassigned label via its checkbox", async () => {
    const user = userEvent.setup();
    renderModal();

    await user.click(await screen.findByRole("checkbox", { name: "Backend" }));

    expect(detailMocks.assignLabel).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ labelId: "l2", workItemId: "work-item-1" }),
    );
  });

  it("creates a new label with a chosen color", async () => {
    const user = userEvent.setup();
    renderModal();

    await user.type(await screen.findByLabelText("New label name"), "Research");
    await user.click(screen.getByRole("radio", { name: "Label color emerald" }));
    await user.click(screen.getByRole("button", { name: "Add label" }));

    expect(detailMocks.createLabel).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ name: "Research", color: "emerald" }),
    );
  });

  it("saves the core fields through onSubmit", async () => {
    const user = userEvent.setup();
    const onSubmit = renderModal();

    const title = await screen.findByLabelText("Title");
    await user.clear(title);
    await user.type(title, "Wire the full timeline");
    await user.click(screen.getByRole("button", { name: "Save task" }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Wire the full timeline", status: "ready", priority: "high" }),
    );
  });

  it("edits planned time and duration through onSubmit", async () => {
    const user = userEvent.setup();
    const onSubmit = renderModal();

    const plannedTime = await screen.findByLabelText("Planned time");
    await user.clear(plannedTime);
    await user.type(plannedTime, "14:30");
    await user.type(screen.getByLabelText("Planned minutes"), "45");
    await user.click(screen.getByRole("button", { name: "Save task" }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ plannedAt: "14:30", plannedMinutes: "45" }),
    );
  });

  it("renders the description as markdown without entering edit mode", async () => {
    renderModal(vi.fn(), workItem({ description: "**bold** notes" }));

    // The rendered <strong> proves LinkedText ran, not a raw textarea value.
    expect(await screen.findByText("bold")).toBeInTheDocument();
    expect(screen.queryByLabelText("Description")).not.toBeInTheDocument();
  });

  it("reveals the editor when the description is clicked", async () => {
    const user = userEvent.setup();
    renderModal(vi.fn(), workItem({ description: "Original notes" }));

    await user.click(await screen.findByText("Original notes"));

    expect(await screen.findByLabelText("Description")).toHaveValue("Original notes");
  });

  it("reveals the editor from the Edit description button", async () => {
    // The keyboard-reachable path, independent of clicking the text.
    const user = userEvent.setup();
    renderModal(vi.fn(), workItem({ description: "Original notes" }));

    await user.click(await screen.findByRole("button", { name: "Edit description" }));

    expect(await screen.findByLabelText("Description")).toHaveValue("Original notes");
  });

  it("invites a description when there is none", async () => {
    renderModal(vi.fn(), workItem({ description: "" }));

    expect(await screen.findByText("Add a description")).toBeInTheDocument();
  });

  it("submits an edited description", async () => {
    const user = userEvent.setup();
    const onSubmit = renderModal(vi.fn(), workItem({ description: "Original notes" }));

    await user.click(await screen.findByText("Original notes"));
    const editor = await screen.findByLabelText("Description");
    await user.clear(editor);
    await user.type(editor, "Rewritten");
    await user.click(screen.getByRole("button", { name: "Save task" }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ description: "Rewritten" }),
    );
  });

  it("follows a link in the description instead of opening the editor", async () => {
    renderModal(
      vi.fn(),
      workItem({
        description: "See [the plan](orbit:note/11111111-1111-1111-1111-111111111111)",
      }),
    );

    // fireEvent, not userEvent: userEvent.click drives jsdom's real anchor
    // navigation, which jsdom doesn't implement and which never reaches the
    // parent's onClick handler either way — the test would pass regardless
    // of whether the guard exists. fireEvent dispatches a plain bubbling
    // click that actually reaches handleDescriptionClick.
    fireEvent.click(await screen.findByRole("link", { name: "the plan" }));

    // The editor must NOT have opened, or the link could never be followed.
    expect(screen.queryByLabelText("Description")).not.toBeInTheDocument();
  });
});
