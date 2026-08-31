import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { upsertDailyShutdown } from "./daily-shutdown.queries";
import { DailyShutdownPanel } from "./daily-shutdown-panel";

describe("DailyShutdownPanel", () => {
  it("saves a daily shutdown ritual", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();

    render(<DailyShutdownPanel isSaving={false} shutdown={null} onSave={onSave} />);

    await user.type(screen.getByLabelText("What shipped"), "Calendar planning blocks");
    await user.type(screen.getByLabelText("Resume tomorrow"), "Wire dashboard widgets");
    await user.click(screen.getByRole("button", { name: "Save shutdown ritual" }));

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        shipped: "Calendar planning blocks",
        resumeTomorrow: "Wire dashboard widgets",
      }),
    );
  });

  it("preloads existing shutdown values", () => {
    render(
      <DailyShutdownPanel
        isSaving={false}
        shutdown={{
          id: "shutdown-1",
          workspace_id: "workspace-1",
          created_by: "user-1",
          shutdown_date: "2026-07-01",
          daily_plan_id: "daily-plan-1",
          shipped: "Shipped the orbit board",
          moved_forward: "Moved import polish",
          blocked: "Waiting on copy review",
          resume_tomorrow: "Start with billing QA",
          created_at: "2026-07-01T00:00:00.000Z",
          updated_at: "2026-07-01T00:00:00.000Z",
        }}
        onSave={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("What shipped")).toHaveValue("Shipped the orbit board");
    expect(screen.getByLabelText("What moved forward")).toHaveValue("Moved import polish");
    expect(screen.getByLabelText("What got blocked")).toHaveValue("Waiting on copy review");
    expect(screen.getByLabelText("Resume tomorrow")).toHaveValue("Start with billing QA");
  });

  it("disables fields and keeps the idle button label while loading", () => {
    render(<DailyShutdownPanel isLoading isSaving={false} shutdown={null} onSave={vi.fn()} />);

    expect(screen.getByLabelText("What shipped")).toBeDisabled();
    expect(screen.getByLabelText("What moved forward")).toBeDisabled();
    expect(screen.getByLabelText("What got blocked")).toBeDisabled();
    expect(screen.getByLabelText("Resume tomorrow")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Save shutdown ritual" })).toBeDisabled();
  });

  it("preserves shutdown text after save is requested", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();

    render(<DailyShutdownPanel isSaving={false} shutdown={null} onSave={onSave} />);

    const shippedInput = screen.getByLabelText("What shipped");
    const blockedInput = screen.getByLabelText("What got blocked");

    await user.type(shippedInput, "Keep this shipped note");
    await user.type(blockedInput, "Keep this blocker");
    await user.click(screen.getByRole("button", { name: "Save shutdown ritual" }));

    expect(onSave).toHaveBeenCalled();
    expect(shippedInput).toHaveValue("Keep this shipped note");
    expect(blockedInput).toHaveValue("Keep this blocker");
  });
});

describe("upsertDailyShutdown", () => {
  it("does not update daily plan identity for an existing shutdown", async () => {
    const updatePayload = vi.fn();
    const client = {
      from: vi
        .fn()
        .mockReturnValueOnce({
          select: () => ({
            eq: () => ({
              eq: () => ({
                eq: () => ({
                  maybeSingle: () =>
                    Promise.resolve({
                      data: { id: "shutdown-1" },
                      error: null,
                    }),
                }),
              }),
            }),
          }),
        })
        .mockReturnValueOnce({
          update: (payload: unknown) => {
            updatePayload(payload);
            return {
              eq: () => ({
                eq: () => ({
                  select: () => ({
                    single: () =>
                      Promise.resolve({
                        data: { id: "shutdown-1" },
                        error: null,
                      }),
                  }),
                }),
              }),
            };
          },
        }),
    };

    await upsertDailyShutdown(client as never, {
      workspaceId: "workspace-1",
      userId: "user-1",
      shutdownDate: "2026-07-01",
      dailyPlanId: "daily-plan-2",
      shipped: "Shipped",
      movedForward: "Moved",
      blocked: "Blocked",
      resumeTomorrow: "Resume",
    });

    expect(updatePayload).toHaveBeenCalledWith({
      shipped: "Shipped",
      moved_forward: "Moved",
      blocked: "Blocked",
      resume_tomorrow: "Resume",
    });
  });
});
