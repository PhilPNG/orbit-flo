import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { DailyPlanItemWithWorkItem } from "./daily-plan.queries";

import { FlightPlan } from "./flight-plan";

describe("FlightPlan", () => {
  it("shows a smart empty action when suggested work is available", async () => {
    const user = userEvent.setup();
    const onPullSuggested = vi.fn();

    render(
      <FlightPlan
        isUpdating={false}
        items={[]}
        onComplete={() => undefined}
        onPullSuggested={onPullSuggested}
        onSkip={() => undefined}
        suggestedCount={3}
      />,
    );

    expect(screen.getByText("No objectives locked")).toBeTruthy();
    expect(screen.getByLabelText("Drop tasks into today's plan")).toHaveClass("today-flight-target");
    expect(screen.getByRole("img", { name: "Daily orbit waiting for an objective" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Add top suggested task" }));

    expect(onPullSuggested).toHaveBeenCalledTimes(1);
  });

  it("accepts a dragged task into today's plan", () => {
    const onDropWorkItemId = vi.fn();

    render(
      <FlightPlan
        isUpdating={false}
        items={[]}
        onComplete={() => undefined}
        onDropWorkItemId={onDropWorkItemId}
        onSkip={() => undefined}
      />,
    );

    fireEvent.drop(screen.getByLabelText("Drop tasks into today's plan"), {
      dataTransfer: {
        getData: () => "work-item-1",
      },
    });

    expect(onDropWorkItemId).toHaveBeenCalledWith("work-item-1");
  });

  it("announces a recent completion", () => {
    render(
      <FlightPlan
        completedItemTitle="Launch polish"
        isUpdating={false}
        items={[] as DailyPlanItemWithWorkItem[]}
        onComplete={() => undefined}
        onSkip={() => undefined}
      />,
    );

    expect(screen.getByText("Launch polish completed. Momentum updated.")).toBeTruthy();
    const completionToast = screen.getByText("Launch polish completed. Momentum updated.").closest("div");
    expect(completionToast).toHaveClass("daily-completion-flare", "orbit-launch-completion");
  });
});
