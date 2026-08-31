import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ElectricBorder } from "./electric-border";

function setReducedMotion(matches: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: query.includes("reduce") ? matches : false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
    onchange: null,
  })) as unknown as typeof window.matchMedia;
}

describe("ElectricBorder", () => {
  afterEach(() => vi.restoreAllMocks());

  it("draws nothing when the user prefers reduced motion", () => {
    // Canvas is the one thing the global CSS reduced-motion rule cannot reach.
    // This guard is the only thing between a reduce-preference user and a
    // continuously animating border, so it gets its own test.
    setReducedMotion(true);
    const { container } = render(<ElectricBorder />);

    expect(container.querySelector("canvas")).toBeNull();
  });

  it("mounts a canvas when motion is allowed", () => {
    setReducedMotion(false);
    const { container } = render(<ElectricBorder />);

    expect(container.querySelector("canvas")).not.toBeNull();
  });

  it("marks the canvas decorative", () => {
    setReducedMotion(false);
    const { container } = render(<ElectricBorder />);

    expect(container.querySelector("canvas")).toHaveAttribute("aria-hidden", "true");
  });
});
