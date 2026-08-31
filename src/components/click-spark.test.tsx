import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ClickSpark } from "./click-spark";

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

describe("ClickSpark", () => {
  afterEach(() => vi.restoreAllMocks());

  it("renders its children", () => {
    setReducedMotion(false);
    render(<ClickSpark><button type="button">Launch</button></ClickSpark>);

    expect(screen.getByRole("button", { name: "Launch" })).toBeTruthy();
  });

  it("draws nothing when the user prefers reduced motion", () => {
    // Canvas is the one thing the global CSS reduced-motion rule cannot reach,
    // so this guard is the only thing standing between a reduce-preference user
    // and an animation. It gets its own test for that reason.
    setReducedMotion(true);
    const { container } = render(
      <ClickSpark><button type="button">Launch</button></ClickSpark>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Launch" }));
    expect(container.querySelector("canvas")).toBeNull();
  });

  it("mounts a canvas when motion is allowed", () => {
    setReducedMotion(false);
    const { container } = render(
      <ClickSpark><button type="button">Launch</button></ClickSpark>,
    );

    expect(container.querySelector("canvas")).not.toBeNull();
  });
});
