import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { MarketingLayout } from "./marketing-layout";

function renderLayout() {
  return render(
    <MemoryRouter>
      <MarketingLayout>
        <p>page content</p>
      </MarketingLayout>
    </MemoryRouter>,
  );
}

describe("MarketingLayout", () => {
  it("links the logo back home and the nav across the marketing site", () => {
    renderLayout();

    expect(screen.getByRole("link", { name: "Orbit Flo home" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "Features" })).toHaveAttribute("href", "/features");
    expect(screen.getByRole("link", { name: "Agent" })).toHaveAttribute("href", "/agent");
    expect(screen.getByRole("link", { name: "Open source" })).toHaveAttribute("href", "/open-source");
    expect(screen.getByRole("link", { name: "GitHub" })).toHaveAttribute(
      "href",
      "https://github.com/PhilPNG/orbit-flo",
    );
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/auth");
  });

  it("renders the honest footer", () => {
    renderLayout();

    expect(screen.getByText(/MIT licensed/)).toBeVisible();
    expect(screen.getByText("github.com/PhilPNG/orbit-flo")).toHaveAttribute(
      "href",
      "https://github.com/PhilPNG/orbit-flo",
    );
  });

  it("renders the children between the nav and the footer", () => {
    renderLayout();

    expect(screen.getByText("page content")).toBeVisible();
  });

  it("stays truthful - these genre staples must never appear on the marketing site", () => {
    renderLayout();

    expect(screen.queryByText(/Trusted by/i)).toBeNull();
    expect(screen.queryByText(/testimonial/i)).toBeNull();
  });
});
