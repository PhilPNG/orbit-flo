import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import { HomePage } from "./home-page";

function renderHome() {
  return render(
    <MemoryRouter>
      <HomePage />
    </MemoryRouter>,
  );
}

afterEach(() => {
  document.title = "";
});

describe("HomePage", () => {
  it("sets the page title", () => {
    renderHome();

    expect(document.title).toBe("Orbit Flo — Mission control for your projects");
  });

  it("leads with the mission-control headline", () => {
    renderHome();

    expect(
      screen.getByRole("heading", { name: /Mission control for your projects/ }),
    ).toBeVisible();
  });

  it("sends both hero calls to action to the right places", () => {
    renderHome();

    expect(screen.getByRole("link", { name: "Enter orbit" })).toHaveAttribute("href", "/auth");
    expect(screen.getByRole("link", { name: "View source" })).toHaveAttribute(
      "href",
      "https://github.com/PhilPNG/orbit-flo",
    );
  });

  it("names all ten agent tools, because the WebMCP story is the differentiator", () => {
    renderHome();

    for (const tool of [
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
    ]) {
      expect(screen.getByText(tool)).toBeVisible();
    }
  });

  it("links deeper into the site for the full agent and feature stories", () => {
    renderHome();

    expect(screen.getByRole("link", { name: /See what each tool does/ })).toHaveAttribute(
      "href",
      "/agent",
    );
    expect(screen.getByRole("link", { name: /Explore all features/ })).toHaveAttribute(
      "href",
      "/features",
    );
  });

  it("closes honestly - open source, free while in beta, no fabricated proof", () => {
    renderHome();

    expect(screen.getByText(/Open source under MIT/)).toBeVisible();
    expect(screen.getByText(/Free while in beta/)).toBeVisible();
  });

  it("shows the product, not placeholders", () => {
    renderHome();

    expect(screen.getByAltText(/mission board/i)).toHaveAttribute(
      "src",
      "/assets/landing/board.png",
    );
  });

  it("teases three features that link back into the full feature tour", () => {
    renderHome();

    expect(screen.getByRole("heading", { name: "Today's flight plan" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Mission control" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Mission boards" })).toBeVisible();
  });
});
