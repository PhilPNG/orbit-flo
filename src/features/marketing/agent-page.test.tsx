import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import { AgentPage } from "./agent-page";

function renderAgent() {
  return render(
    <MemoryRouter>
      <AgentPage />
    </MemoryRouter>,
  );
}

afterEach(() => {
  document.title = "";
});

describe("AgentPage", () => {
  it("sets the page title", () => {
    renderAgent();

    expect(document.title).toBe("Agent — Orbit Flo");
  });

  it("leads with the WebMCP headline", () => {
    renderAgent();

    expect(screen.getByRole("heading", { name: "Your agent works here too." })).toBeVisible();
  });

  it("pins exactly the ten real tool names, sorted - drift here means this page fell out of sync with agent-tools.ts", () => {
    const { container } = renderAgent();

    const names = Array.from(container.querySelectorAll("tbody tr td:first-child")).map(
      (cell) => cell.textContent,
    );

    expect([...names].sort()).toEqual([
      "add_to_flight_plan",
      "capture_thought",
      "complete_plan_item",
      "create_task",
      "file_capture_as_task",
      "get_flight_plan",
      "list_inbox",
      "list_projects",
      "move_task",
      "search_workspace",
    ]);
  });

  it("gives every tool a one-line description", () => {
    const { container } = renderAgent();

    const descriptions = container.querySelectorAll("tbody tr td:nth-child(2)");
    expect(descriptions).toHaveLength(10);
    for (const cell of descriptions) {
      expect(cell.textContent?.length).toBeGreaterThan(0);
    }
  });
});
