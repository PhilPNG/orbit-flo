import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Database } from "../../lib/supabase/database.types";
import { CalendarPage, DeadlineCard } from "./calendar-page";
import { toDateKey } from "./calendar.utils";

// Kept relative to now so the fixture always lands inside the visible month.
function todayKey() {
  return toDateKey(new Date());
}

const calendarMocks = vi.hoisted(() => ({
  listDueWorkItems: vi.fn(),
  updateWorkItemDetails: vi.fn(),
  listProjects: vi.fn(),
}));

vi.mock("../../lib/supabase/client", () => ({ supabase: {} }));

vi.mock("../workspaces/workspace-context", () => ({
  useWorkspaceId: () => "workspace-1",
}));

vi.mock("../auth/use-auth", () => ({
  useAuth: () => ({ isLoading: false, user: { id: "user-1" } }),
}));

vi.mock("../projects/projects.queries", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../projects/projects.queries")>()),
  listProjects: calendarMocks.listProjects,
}));

vi.mock("../work-items/work-items.queries", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../work-items/work-items.queries")>()),
  listDueWorkItems: calendarMocks.listDueWorkItems,
  updateWorkItemDetails: calendarMocks.updateWorkItemDetails,
}));

vi.mock("../work-items/work-item-details.queries", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../work-items/work-item-details.queries")>()),
  listComments: vi.fn().mockResolvedValue([]),
  listChecklistItems: vi.fn().mockResolvedValue([]),
  listAttachments: vi.fn().mockResolvedValue([]),
  listProjectLabels: vi.fn().mockResolvedValue([]),
  listWorkItemLabels: vi.fn().mockResolvedValue([]),
}));

type Project = Database["public"]["Tables"]["projects"]["Row"];
type WorkItem = Database["public"]["Tables"]["work_items"]["Row"];

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
    title: "Deadline task",
    description: null,
    status: "ready",
    priority: "high",
    due_date: "2026-07-02",
    estimate_points: null,
    sort_order: 0,
    blocked_reason: null,
    created_by: "user-1",
    created_at: "2026-06-29T00:00:00.000Z",
    updated_at: "2026-06-29T00:00:00.000Z",
    completed_at: null,
    ...overrides,
  };
}

describe("DeadlineCard", () => {
  it("marks urgent deadline cards with danger pulse styling", () => {
    render(<DeadlineCard item={workItem()} motionTone="urgent" onOpenItem={vi.fn()} projectsById={new Map([["project-1", project()]])} />);

    expect(screen.getByRole("button", { name: /Deadline task/i })).toHaveClass("orbit-deadline-pulse", "orbit-deadline-pulse-danger");
  });

  it("marks today's deadline cards with orbital pulse styling", () => {
    render(<DeadlineCard item={workItem({ title: "Today task" })} motionTone="today" onOpenItem={vi.fn()} projectsById={new Map([["project-1", project()]])} />);

    expect(screen.getByRole("button", { name: /Today task/i })).toHaveClass("orbit-deadline-pulse");
    expect(screen.getByRole("button", { name: /Today task/i })).not.toHaveClass("orbit-deadline-pulse-danger");
  });
});

describe("CalendarPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    calendarMocks.listProjects.mockResolvedValue([project()]);
    calendarMocks.updateWorkItemDetails.mockResolvedValue({});
    calendarMocks.listDueWorkItems.mockResolvedValue([
      workItem({ milestone_id: "milestone-7", due_date: todayKey() }),
    ]);
  });

  it("keeps the milestone when saving a task from the calendar", async () => {
    const user = userEvent.setup();
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    render(
      <QueryClientProvider client={queryClient}>
        <CalendarPage />
      </QueryClientProvider>,
    );

    const cards = await screen.findAllByRole("button", { name: /Deadline task/i });
    await user.click(cards[0]);
    await user.click(await screen.findByRole("button", { name: "Save task" }));

    await waitFor(() => {
      expect(calendarMocks.updateWorkItemDetails).toHaveBeenCalledWith(
        {},
        expect.objectContaining({ id: "work-item-1", milestoneId: "milestone-7" }),
      );
    });
  });
});
