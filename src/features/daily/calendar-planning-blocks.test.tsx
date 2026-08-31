import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CalendarPlanningBlocks } from "./calendar-planning-blocks";

describe("CalendarPlanningBlocks", () => {
  it("plans a dragged task into a calendar block", () => {
    const onPlanWorkItem = vi.fn();

    render(<CalendarPlanningBlocks onPlanWorkItem={onPlanWorkItem} />);

    fireEvent.drop(screen.getByLabelText("Morning planning block"), {
      dataTransfer: {
        getData: () => "work-item-1",
      },
    });

    expect(onPlanWorkItem).toHaveBeenCalledWith("work-item-1", "morning", 0);
  });
});
