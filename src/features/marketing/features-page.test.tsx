import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
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

    for (const title of [
      "Inbox",
      "Signals",
      "Brainstorm & linked notes",
      "Mind maps",
      "Calendar",
      "Weekly reviews",
      "Shared workspaces",
    ]) {
      expect(screen.getByRole("heading", { name: title })).toBeVisible();
    }

    // None of these seven get imagery - only three screenshot <img> tags exist
    // on the page, one per genuinely-seeded screenshot (plus the layout's
    // own logo image, which every marketing page carries).
    expect(screen.getAllByRole("img")).toHaveLength(4);
  });

  it("describes shared workspaces truthfully and gives the card an anchor for the home page link", () => {
    renderFeatures();

    const heading = screen.getByRole("heading", { name: "Shared workspaces" });
    expect(heading.closest("article")).toHaveAttribute("id", "shared-workspaces");
    expect(screen.getByText(/owner, admin or member/)).toBeVisible();
    expect(screen.getByText(/a workspace always keeps an owner/)).toBeVisible();
    expect(screen.getByText(/flight plan and inbox are private to you/)).toBeVisible();
  });

  it("says what a mind-map node can become - a task, a note or a milestone", () => {
    renderFeatures();

    expect(screen.getByText(/a task, a note or a milestone/)).toBeVisible();
    expect(screen.queryByText(/a task or a project/)).toBeNull();
  });

  it("scrolls to the section named in the URL hash", () => {
    const calls: string[] = [];
    const originalScrollIntoView = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = vi.fn(function (this: Element) {
      calls.push(this.id);
    });

    try {
      render(
        <MemoryRouter initialEntries={["/features#shared-workspaces"]}>
          <FeaturesPage />
        </MemoryRouter>,
      );

      expect(Element.prototype.scrollIntoView).toHaveBeenCalledTimes(1);
      expect(calls).toEqual(["shared-workspaces"]);
    } finally {
      Element.prototype.scrollIntoView = originalScrollIntoView;
    }
  });

  it("does not scroll when there is no URL hash", () => {
    const originalScrollIntoView = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = vi.fn();

    try {
      renderFeatures();

      expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled();
    } finally {
      Element.prototype.scrollIntoView = originalScrollIntoView;
    }
  });
});
