import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Database } from "../../lib/supabase/database.types";
import { DailyMissionControlPage } from "./daily-mission-control-page";
import type { DailyPlanItemWithWorkItem } from "./daily-plan.queries";
import { formatPlanDate } from "./daily-plan.utils";

const dailyPlanMocks = vi.hoisted(() => ({
  completeDailyPlanItem: vi.fn(),
  addDailyPlanItem: vi.fn(),
  createCapture: vi.fn(),
  getDailyMissionControlData: vi.fn(),
  getOrCreateDailyPlan: vi.fn(),
  resetDailyPlanItem: vi.fn(),
  skipDailyPlanItem: vi.fn(),
}));

const dailyShutdownMocks = vi.hoisted(() => ({
  getDailyShutdown: vi.fn(),
  upsertDailyShutdown: vi.fn(),
}));

const privateReflectionMocks = vi.hoisted(() => ({
  createPrivateReflection: vi.fn(),
  listPrivateReflections: vi.fn(),
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

vi.mock("../recurrence/recurrence.queries", () => ({
  ensureRecurringOccurrences: vi.fn().mockResolvedValue({ created: 0, missed: 0 }),
}));

vi.mock("./daily-plan.queries", () => ({
  addDailyPlanItem: dailyPlanMocks.addDailyPlanItem,
  completeDailyPlanItem: dailyPlanMocks.completeDailyPlanItem,
  createCapture: dailyPlanMocks.createCapture,
  getDailyMissionControlData: dailyPlanMocks.getDailyMissionControlData,
  getOrCreateDailyPlan: dailyPlanMocks.getOrCreateDailyPlan,
  resetDailyPlanItem: dailyPlanMocks.resetDailyPlanItem,
  skipDailyPlanItem: dailyPlanMocks.skipDailyPlanItem,
}));

vi.mock("./daily-shutdown.queries", () => ({
  getDailyShutdown: dailyShutdownMocks.getDailyShutdown,
  upsertDailyShutdown: dailyShutdownMocks.upsertDailyShutdown,
}));

vi.mock("./private-reflections.queries", () => ({
  createPrivateReflection: privateReflectionMocks.createPrivateReflection,
  listPrivateReflections: privateReflectionMocks.listPrivateReflections,
}));

type DailyPlan = Database["public"]["Tables"]["daily_plans"]["Row"];
type DailyPlanItem = Database["public"]["Tables"]["daily_plan_items"]["Row"];
type Capture = Database["public"]["Tables"]["captures"]["Row"];
type Project = Database["public"]["Tables"]["projects"]["Row"];
type WorkItem = Database["public"]["Tables"]["work_items"]["Row"];

function dailyPlan(overrides: Partial<DailyPlan> = {}): DailyPlan {
  return {
    id: "daily-plan-1",
    workspace_id: "workspace-1",
    plan_date: "2026-06-29",
    status: "active",
    reflection: null,
    completed_count: 0,
    skipped_count: 0,

    recurring_missed_count: 0,
    created_by: "user-1",
    created_at: "2026-06-29T00:00:00.000Z",
    updated_at: "2026-06-29T00:00:00.000Z",
    ...overrides,
  };
}

function dailyPlanItem(overrides: Partial<DailyPlanItem> = {}): DailyPlanItem {
  return {
    id: "daily-plan-item-1",
    workspace_id: "workspace-1",
    daily_plan_id: "daily-plan-1",
    work_item_id: "work-item-1",
    sort_order: 0,
    is_primary: false,
    state: "planned",
    completed_at: null,
    skipped_at: null,
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
    title: "Work item",
    description: null,
    status: "ready",
    priority: "medium",
    due_date: null,
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

function capture(overrides: Partial<Capture> = {}): Capture {
  return {
    id: "capture-1",
    workspace_id: "workspace-1",
    project_id: null,
    work_item_id: null,
    type: "note",
    title: "Captured signal",
    body: null,
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
    name: "PocketPup",
    description: null,
    status: "active",
    priority: "high",
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

function renderDailyMissionControlPage() {
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
        <DailyMissionControlPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("DailyMissionControlPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dailyPlanMocks.getOrCreateDailyPlan.mockResolvedValue({
      ...dailyPlan(),
    });
    dailyPlanMocks.getDailyMissionControlData.mockResolvedValue({
      availableWorkItems: [],
      captures: [],
      dailyPlanItems: [],
      milestones: [],
      plan: dailyPlan(),
      projects: [],
    });
    dailyPlanMocks.createCapture.mockResolvedValue({});
    dailyPlanMocks.addDailyPlanItem.mockResolvedValue({});
    dailyPlanMocks.resetDailyPlanItem.mockResolvedValue({});
    dailyShutdownMocks.getDailyShutdown.mockResolvedValue(null);
    dailyShutdownMocks.upsertDailyShutdown.mockResolvedValue({});
    privateReflectionMocks.listPrivateReflections.mockResolvedValue([]);
    privateReflectionMocks.createPrivateReflection.mockResolvedValue({});
    window.localStorage.clear();
  });

  it("reports recurring tasks missed while away", async () => {
    dailyPlanMocks.getDailyMissionControlData.mockResolvedValue({
      availableWorkItems: [],
      captures: [],
      dailyPlanItems: [],
      milestones: [],
      plan: dailyPlan({ recurring_missed_count: 3 }),
      projects: [project()],
    });

    renderDailyMissionControlPage();

    expect(
      await screen.findByText("3 recurring tasks were missed while you were away."),
    ).toBeVisible();
  });

  it("says nothing when none were missed", async () => {
    renderDailyMissionControlPage();

    await screen.findByRole("heading", { name: "Today" });
    expect(screen.queryByText(/recurring tasks were missed/)).toBeNull();
  });

  it("renders the Today shell", async () => {
    renderDailyMissionControlPage();

    expect(await screen.findByRole("heading", { name: "Today" })).toBeTruthy();
    expect(await screen.findByText("No objectives locked")).toBeTruthy();
    expect(screen.getByText("A clear sky. Add an objective to begin.")).toBeTruthy();
    expect(screen.getByPlaceholderText("Capture a thought — Enter to dock it")).toBeTruthy();
    expect(screen.getByText("Mission log")).toBeTruthy();
  });

  it("shows recommendations, Quick Capture, and collapsed Mission log on an empty day", async () => {
    dailyPlanMocks.getDailyMissionControlData.mockResolvedValue({
      availableWorkItems: [
        workItem({
          id: "suggestion-1",
          title: "Define the smallest useful version",
          priority: "critical",
          due_date: "2026-07-11",
        }),
        workItem({
          id: "suggestion-2",
          title: "Polish the release path",
          priority: "high",
          due_date: "2026-07-12",
        }),
        workItem({ id: "suggestion-3", title: "Build the first usable slice", priority: "high" }),
        workItem({ id: "suggestion-4", title: "Test", priority: "medium" }),
      ],
      captures: [],
      dailyPlanItems: [],
      milestones: [],
      plan: dailyPlan({ plan_date: formatPlanDate() }),
      projects: [project()],
    });

    renderDailyMissionControlPage();

    expect(await screen.findByText("No objectives locked")).toBeVisible();
    expect(screen.getByText(formatPlanDate())).toBeVisible();
    expect(screen.getByRole("heading", { name: "Today" }).closest("section")).toHaveClass("gap-5");
    expect(
      screen.getByText("A clear sky. 4 suggestions waiting when you're ready."),
    ).toBeVisible();
    expect(screen.getByText("4 suggestions for today")).toBeVisible();
    expect(screen.getByText("Define the smallest useful version")).toBeVisible();
    expect(screen.getAllByText("PocketPup")).toHaveLength(4);
    expect(screen.getByText("Polish the release path")).toBeVisible();
    expect(screen.getByText("Build the first usable slice")).toBeVisible();
    expect(screen.getByText("Test")).toBeVisible();
    expect(within(screen.getByRole("list", { name: "Suggested for today" })).getAllByRole("listitem"))
      .toHaveLength(4);
    expect(screen.getByRole("form", { name: "Quick capture" })).toBeVisible();
    expect(screen.getByText("Mission log")).toBeVisible();
    expect(screen.getByText("Mission log").closest("details")).not.toHaveAttribute("open");
  });

  it("renders today's primary flight plan objective and momentum", async () => {
    const primaryItem: DailyPlanItemWithWorkItem = {
      ...dailyPlanItem({ is_primary: true, state: "planned" }),
      workItem: workItem({ title: "Ship onboarding polish" }),
    };

    dailyPlanMocks.getDailyMissionControlData.mockResolvedValue({
      availableWorkItems: [],
      captures: [],
      dailyPlanItems: [primaryItem],
      milestones: [],
      plan: dailyPlan(),
      projects: [],
    });

    const user = userEvent.setup();
    renderDailyMissionControlPage();

    expect(await screen.findAllByText("Ship onboarding polish")).toHaveLength(2);
    expect(screen.getAllByText("Primary burn").length).toBeGreaterThan(0);
    expect(screen.getByText("1 objective in orbit")).toBeTruthy();

    await user.click(screen.getByText("Mission log"));
    await user.click(screen.getByRole("tab", { name: "Review" }));
    expect(screen.getByText("0% complete")).toBeTruthy();

    await user.click(screen.getByRole("tab", { name: "Timeline" }));
    expect(screen.getByRole("heading", { name: "Today Timeline" })).toBeTruthy();
  });

  it("renders focus and review panels with captured signals", async () => {
    dailyPlanMocks.getDailyMissionControlData.mockResolvedValue({
      availableWorkItems: [],
      captures: [capture({ title: "Pricing idea" })],
      dailyPlanItems: [],
      milestones: [],
      plan: dailyPlan({ status: "active" }),
      projects: [],
    });

    const user = userEvent.setup();
    renderDailyMissionControlPage();

    expect(await screen.findByText("Focus Cockpit")).toBeTruthy();

    await user.click(screen.getByText("Mission log"));
    await user.click(screen.getByRole("tab", { name: "Review" }));
    expect(screen.getByText("Mission Debrief")).toBeTruthy();
    expect(screen.getAllByText("Pricing idea").length).toBeGreaterThan(0);
  });

  it("disables terminal flight plan item actions", async () => {
    const completedItem: DailyPlanItemWithWorkItem = {
      ...dailyPlanItem({ id: "daily-plan-item-completed", is_primary: true, state: "completed" }),
      workItem: workItem({ id: "work-item-completed", title: "Completed objective" }),
    };
    const skippedItem: DailyPlanItemWithWorkItem = {
      ...dailyPlanItem({ id: "daily-plan-item-skipped", state: "skipped" }),
      workItem: workItem({ id: "work-item-skipped", title: "Skipped objective" }),
    };

    dailyPlanMocks.getDailyMissionControlData.mockResolvedValue({
      availableWorkItems: [],
      captures: [],
      dailyPlanItems: [completedItem, skippedItem],
      milestones: [],
      plan: dailyPlan(),
      projects: [],
    });

    renderDailyMissionControlPage();

    expect(await screen.findByRole("button", { name: "Complete Completed objective" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Skip Completed objective" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Complete Skipped objective" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Skip Skipped objective" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Launch focus session" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Complete focus objective" })).toBeDisabled();
  });

  it("docks a quick capture signal", async () => {
    const user = userEvent.setup();

    renderDailyMissionControlPage();

    const titleInput = await screen.findByPlaceholderText("Capture a thought — Enter to dock it");

    await user.type(titleInput, "Remember pricing page idea");
    await user.click(screen.getByRole("button", { name: "Dock signal" }));

    expect(await screen.findByText("Signal docked.")).toBeTruthy();
    expect(titleInput).toHaveValue("");
    expect(dailyPlanMocks.createCapture).toHaveBeenCalledWith(
      {},
      {
        workspaceId: "workspace-1",
        userId: "user-1",
        type: "task",
        title: "Remember pricing page idea",
        body: "",
      },
    );
  });

  it("celebrates a completed flight plan objective", async () => {
    const user = userEvent.setup();
    const primaryItem: DailyPlanItemWithWorkItem = {
      ...dailyPlanItem({ is_primary: true, state: "planned" }),
      workItem: workItem({ title: "Finish launch checklist" }),
    };

    dailyPlanMocks.getDailyMissionControlData.mockResolvedValue({
      availableWorkItems: [],
      captures: [],
      dailyPlanItems: [primaryItem],
      milestones: [],
      plan: dailyPlan(),
      projects: [],
    });
    dailyPlanMocks.completeDailyPlanItem.mockResolvedValue({});

    renderDailyMissionControlPage();

    await user.click(await screen.findByRole("button", { name: "Complete Finish launch checklist" }));

    expect(await screen.findByText("Finish launch checklist completed. Momentum updated.")).toBeTruthy();
  });

  it("nudges users to pick the next objective after completing primary work", async () => {
    const user = userEvent.setup();
    const primaryItem: DailyPlanItemWithWorkItem = {
      ...dailyPlanItem({ is_primary: true, state: "planned" }),
      workItem: workItem({ title: "Finish launch checklist" }),
    };

    dailyPlanMocks.getDailyMissionControlData.mockResolvedValue({
      availableWorkItems: [workItem({ id: "next-work", title: "Draft launch notes", priority: "high" })],
      captures: [],
      dailyPlanItems: [primaryItem],
      milestones: [],
      plan: dailyPlan(),
      projects: [],
    });
    dailyPlanMocks.completeDailyPlanItem.mockResolvedValue({});

    renderDailyMissionControlPage();

    await user.click(await screen.findByRole("button", { name: "Complete Finish launch checklist" }));
    await user.click(await screen.findByRole("button", { name: "1 suggestion for today" }));
    await user.click(await screen.findByRole("button", { name: "Add Draft launch notes to today" }));

    expect(dailyPlanMocks.addDailyPlanItem).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        workItemId: "next-work",
      }),
    );
  });

  it("allows users to undo a completed objective", async () => {
    const user = userEvent.setup();
    const primaryItem: DailyPlanItemWithWorkItem = {
      ...dailyPlanItem({ is_primary: true, state: "planned" }),
      workItem: workItem({ title: "Finish launch checklist" }),
    };

    dailyPlanMocks.getDailyMissionControlData.mockResolvedValue({
      availableWorkItems: [],
      captures: [],
      dailyPlanItems: [primaryItem],
      milestones: [],
      plan: dailyPlan(),
      projects: [],
    });
    dailyPlanMocks.completeDailyPlanItem.mockResolvedValue({});

    renderDailyMissionControlPage();

    await user.click(await screen.findByRole("button", { name: "Complete Finish launch checklist" }));
    await user.click(await screen.findByRole("button", { name: "Undo completed objective" }));

    expect(dailyPlanMocks.resetDailyPlanItem).toHaveBeenCalledWith(
      {},
      {
        id: "daily-plan-item-1",
        workspaceId: "workspace-1",
      },
    );
  });

  it("respects personalized home module visibility", async () => {
    window.localStorage.setItem(
      "orbitflo:daily-home-layout",
      JSON.stringify({
        quickCapture: false,
        momentum: true,
        suggestions: true,
        review: true,
      }),
    );
    renderDailyMissionControlPage();

    expect(await screen.findByText("No objectives locked")).toBeTruthy();
    expect(screen.queryByPlaceholderText("Capture a thought — Enter to dock it")).toBeNull();
  });

  it("adds a suggested work item to today's flight plan", async () => {
    const user = userEvent.setup();
    dailyPlanMocks.getDailyMissionControlData.mockResolvedValue({
      availableWorkItems: [
        workItem({
          id: "suggested-work",
          title: "Fix overdue launch blocker",
          priority: "critical",
          due_date: "2026-06-28",
        }),
      ],
      captures: [],
      dailyPlanItems: [],
      milestones: [],
      plan: dailyPlan(),
      projects: [],
    });

    renderDailyMissionControlPage();

    expect(await screen.findByRole("button", { name: "Hide suggestions" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    await user.click(await screen.findByRole("button", { name: "Add Fix overdue launch blocker to today" }));

    expect(dailyPlanMocks.addDailyPlanItem).toHaveBeenCalledWith(
      {},
      {
        workspaceId: "workspace-1",
        dailyPlanId: "daily-plan-1",
        workItemId: "suggested-work",
        sortOrder: 0,
        isPrimary: true,
      },
    );
  });

  it("preserves quick capture text when docking fails", async () => {
    const user = userEvent.setup();
    dailyPlanMocks.createCapture.mockRejectedValue(new Error("Docking bay offline"));

    renderDailyMissionControlPage();

    const titleInput = await screen.findByPlaceholderText("Capture a thought — Enter to dock it");
    await user.click(screen.getByRole("button", { name: "More capture options" }));
    const bodyInput = screen.getByLabelText("Signal notes");

    await user.type(titleInput, "Preserve this signal");
    await user.type(bodyInput, "The details should survive failure.");
    await user.click(screen.getByRole("button", { name: "Dock signal" }));

    expect(await screen.findByText("Docking bay offline")).toBeTruthy();
    expect(titleInput).toHaveValue("Preserve this signal");
    expect(bodyInput).toHaveValue("The details should survive failure.");
  });

  it("saves shutdown with workspace, user, date, and plan context", async () => {
    const user = userEvent.setup();

    renderDailyMissionControlPage();

    await user.click(await screen.findByText("Mission log"));
    await user.click(screen.getByRole("tab", { name: "Shutdown" }));
    await user.type(await screen.findByLabelText("What shipped"), "Closed project command center");
    await user.type(screen.getByLabelText("Resume tomorrow"), "Review inbox triage");
    await user.click(screen.getByRole("button", { name: "Save shutdown ritual" }));

    await waitFor(() => {
      expect(dailyShutdownMocks.upsertDailyShutdown).toHaveBeenCalledWith(
        {},
        expect.objectContaining({
          workspaceId: "workspace-1",
          userId: "user-1",
          shutdownDate: expect.any(String),
          dailyPlanId: "daily-plan-1",
          shipped: "Closed project command center",
          resumeTomorrow: "Review inbox triage",
        }),
      );
    });
  });

  it("saves a private reflection with workspace, user, date, and empty tags", async () => {
    const user = userEvent.setup();

    renderDailyMissionControlPage();

    await user.click(await screen.findByText("Mission log"));
    await user.click(screen.getByRole("tab", { name: "Reflection" }));
    await user.type(await screen.findByLabelText("Reflection title"), "What I learned today");
    await user.type(screen.getByLabelText("Private reflection"), "Smaller planning blocks helped.");
    await user.click(screen.getByRole("button", { name: "Save private reflection" }));

    await waitFor(() => {
      expect(privateReflectionMocks.createPrivateReflection).toHaveBeenCalledWith(
        {},
        expect.objectContaining({
          workspaceId: "workspace-1",
          userId: "user-1",
          reflectionDate: expect.any(String),
          title: "What I learned today",
          body: "Smaller planning blocks helped.",
          mood: "clear",
          tags: [],
        }),
      );
    });
  });
});
