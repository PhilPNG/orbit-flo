import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AppleMark, GitHubMark, GoogleMark } from "./brand-icons";

describe("brand icons", () => {
  it.each([
    ["google", GoogleMark],
    ["github", GitHubMark],
    ["apple", AppleMark],
  ])("renders the %s mark as decorative svg", (_name, Mark) => {
    const { container } = render(<Mark className="h-4 w-4" />);
    const svg = container.querySelector("svg");

    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(svg).toHaveClass("h-4", "w-4");
    expect(container.querySelectorAll("path").length).toBeGreaterThan(0);
  });
});
