import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { LandingPage } from "./landing-page";

function renderLanding() {
  return render(
    <MemoryRouter>
      <LandingPage />
    </MemoryRouter>,
  );
}

describe("LandingPage", () => {
  it("leads with the mission-control headline", () => {
    renderLanding();

    expect(
      screen.getByRole("heading", { name: /Mission control for your projects/ }),
    ).toBeVisible();
  });

  it("sends both hero calls to action to the right places", () => {
    renderLanding();

    expect(screen.getByRole("link", { name: "Enter orbit" })).toHaveAttribute("href", "/auth");
    expect(screen.getByRole("link", { name: "View source" })).toHaveAttribute(
      "href",
      "https://github.com/PhilPNG/orbit-flo",
    );
  });

  it("names all seven agent tools, because the WebMCP story is the differentiator", () => {
    renderLanding();

    for (const tool of [
      "list_projects",
      "get_flight_plan",
      "create_task",
      "move_task",
      "search_workspace",
      "capture_thought",
      "complete_plan_item",
    ]) {
      expect(screen.getByText(tool)).toBeVisible();
    }
  });

  it("closes honestly - open source, free while in beta, no fabricated proof", () => {
    renderLanding();

    expect(screen.getByText(/Open source under MIT/)).toBeVisible();
    expect(screen.getByText(/Free while in beta/)).toBeVisible();
    // The truthful-SaaS rule, pinned: these genre staples must never appear.
    expect(screen.queryByText(/Trusted by/i)).toBeNull();
    expect(screen.queryByText(/testimonial/i)).toBeNull();
  });

  it("shows the product, not placeholders", () => {
    renderLanding();

    expect(screen.getByAltText(/mission board/i)).toHaveAttribute(
      "src",
      "/assets/landing/board.png",
    );
  });
});
