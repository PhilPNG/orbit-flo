import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RecurringTasksPanel } from "./recurring-tasks-panel";

const recurrenceMocks = vi.hoisted(() => ({
  listRecurrenceRules: vi.fn(),
  createRecurrenceRule: vi.fn(),
  updateRecurrenceRule: vi.fn(),
  deleteRecurrenceRule: vi.fn(),
}));

vi.mock("../../lib/supabase/client", () => ({ supabase: {} }));

vi.mock("./recurrence.queries", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./recurrence.queries")>()),
  ...recurrenceMocks,
}));

function rule(overrides: Record<string, unknown> = {}) {
  return {
    id: "rule-1",
    workspace_id: "workspace-1",
    project_id: "project-1",
    title: "Weekly review",
    description: null,
    priority: "medium",
    pattern: "weekly",
    weekdays: [1, 4],
    day_of_month: null,
    planned_at: null,
    planned_minutes: null,
    is_active: true,
    generated_through: null,
    created_by: "user-1",
    created_at: "",
    updated_at: "",
    ...overrides,
  };
}

function renderPanel() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return render(
    <QueryClientProvider client={queryClient}>
      <RecurringTasksPanel
        onHide={() => undefined}
        projectId="project-1"
        userId="user-1"
        workspaceId="workspace-1"
      />
    </QueryClientProvider>,
  );
}

describe("RecurringTasksPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    recurrenceMocks.createRecurrenceRule.mockResolvedValue({});
    recurrenceMocks.updateRecurrenceRule.mockResolvedValue(undefined);
    recurrenceMocks.deleteRecurrenceRule.mockResolvedValue(undefined);
    recurrenceMocks.listRecurrenceRules.mockResolvedValue([rule()]);
  });

  it("summarises each rule's pattern in words", async () => {
    renderPanel();

    expect(await screen.findByText("Weekly review")).toBeVisible();
    expect(screen.getByText("Weekly on Mon, Thu")).toBeVisible();
  });

  it("marks a paused rule", async () => {
    recurrenceMocks.listRecurrenceRules.mockResolvedValue([rule({ is_active: false })]);
    renderPanel();

    expect(await screen.findByText("Weekly on Mon, Thu · Paused")).toBeVisible();
  });

  it("pauses a rule", async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(await screen.findByRole("button", { name: "Pause Weekly review" }));

    await waitFor(() => {
      expect(recurrenceMocks.updateRecurrenceRule).toHaveBeenCalledWith(
        {},
        { id: "rule-1", workspaceId: "workspace-1", isActive: false },
      );
    });
  });

  it("creates a daily rule", async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.type(await screen.findByLabelText("Recurring task title"), "Daily standup");
    await user.click(screen.getByRole("button", { name: "Add recurring task" }));

    await waitFor(() => {
      expect(recurrenceMocks.createRecurrenceRule).toHaveBeenCalledWith(
        {},
        expect.objectContaining({
          workspaceId: "workspace-1",
          projectId: "project-1",
          title: "Daily standup",
          pattern: "daily",
          weekdays: [],
          dayOfMonth: null,
        }),
      );
    });
  });

  it("only asks for weekdays on a weekly rule", async () => {
    const user = userEvent.setup();
    renderPanel();

    expect(screen.queryByLabelText("Weekdays")).toBeNull();

    await user.selectOptions(await screen.findByLabelText("Recurrence pattern"), "weekly");

    expect(screen.getByLabelText("Weekdays")).toBeVisible();
    expect(screen.queryByLabelText("Day of month")).toBeNull();
  });
});
