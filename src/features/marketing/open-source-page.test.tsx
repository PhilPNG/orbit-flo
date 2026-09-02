import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import { OpenSourcePage } from "./open-source-page";

function renderOpenSource() {
  return render(
    <MemoryRouter>
      <OpenSourcePage />
    </MemoryRouter>,
  );
}

afterEach(() => {
  document.title = "";
});

describe("OpenSourcePage", () => {
  it("sets the page title", () => {
    renderOpenSource();

    expect(document.title).toBe("Open source — Orbit Flo");
  });

  it("leads with MIT and free-while-in-beta, and links to the repo", () => {
    renderOpenSource();

    expect(
      screen.getByRole("heading", { name: "MIT licensed. Free while in beta." }),
    ).toBeVisible();
    expect(screen.getByRole("link", { name: "View the repo" })).toHaveAttribute(
      "href",
      "https://github.com/PhilPNG/orbit-flo",
    );
  });

  it("tells the real verification story - no invented numbers", () => {
    renderOpenSource();

    expect(screen.getByText(/851 tests/)).toBeVisible();
    expect(screen.getByText(/CI-verified privilege grants/i)).toBeVisible();
    expect(screen.getByText(/two-account RLS harness/i)).toBeVisible();
  });

  it("points self-hosters at the README", () => {
    renderOpenSource();

    expect(screen.getByText(/The README walks through/)).toBeVisible();
  });
});
