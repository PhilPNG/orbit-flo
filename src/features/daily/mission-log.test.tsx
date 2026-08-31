import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { MissionLog } from "./mission-log";

const panels = {
  Focus: <div>Focus panel</div>,
  Review: <div>Review panel</div>,
  Timeline: <div>Timeline panel</div>,
  Shutdown: <div>Shutdown panel</div>,
  Reflection: <div>Reflection panel</div>,
};

describe("MissionLog", () => {
  it("is collapsed by default", () => {
    render(<MissionLog panels={panels} />);

    expect(screen.getByText("Mission log")).toBeTruthy();
    expect(screen.getByText("Mission log").closest("details"))
      .toHaveClass("today-mission-log");
    expect(screen.getByText("Mission log").closest("details")).not.toHaveAttribute("open");
  });

  it("shows the Focus tab first and switches tabs", async () => {
    const user = userEvent.setup();
    render(<MissionLog defaultOpen panels={panels} />);

    expect(screen.getByText("Focus panel")).toBeTruthy();
    expect(screen.queryByText("Shutdown panel")).toBeNull();
    expect(screen.getByRole("tab", { name: "Focus" })).toHaveAttribute("aria-selected", "true");

    await user.click(screen.getByRole("tab", { name: "Shutdown" }));

    expect(screen.getByText("Shutdown panel")).toBeTruthy();
    expect(screen.queryByText("Focus panel")).toBeNull();
    expect(screen.getByRole("tab", { name: "Shutdown" })).toHaveAttribute("aria-selected", "true");
  });
});
