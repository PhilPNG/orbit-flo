import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import { FeaturesPage } from "./features-page";

function renderFeatures() {
  return render(
    <MemoryRouter>
      <FeaturesPage />
    </MemoryRouter>,
  );
}

afterEach(() => {
  document.title = "";
});

describe("FeaturesPage", () => {
  it("sets the page title", () => {
    renderFeatures();

    expect(document.title).toBe("Features — Orbit Flo");
  });

  it("shows the three screenshots the seed data can genuinely produce", () => {
    renderFeatures();

    expect(screen.getByAltText(/mission board/i)).toHaveAttribute("src", "/assets/landing/board.png");
    expect(screen.getByAltText(/mission control dashboard/i)).toHaveAttribute(
      "src",
      "/assets/landing/dashboard.png",
    );
    expect(screen.getByAltText(/daily flight plan/i)).toHaveAttribute(
      "src",
      "/assets/landing/flight-plan.png",
    );
  });

  it("gives the un-screenshottable features an honest paragraph and no staged image", () => {
    renderFeatures();

    for (const title of ["Inbox", "Signals", "Brainstorm & linked notes", "Mind maps", "Calendar", "Weekly reviews"]) {
      expect(screen.getByRole("heading", { name: title })).toBeVisible();
    }

    // None of these six get imagery - only three screenshot <img> tags exist
    // on the page, one per genuinely-seeded screenshot (plus the layout's
    // own logo image, which every marketing page carries).
    expect(screen.getAllByRole("img")).toHaveLength(4);
  });
});
