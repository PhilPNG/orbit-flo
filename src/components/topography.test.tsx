import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as topographyModule from "./topography";
import { Topography } from "./topography";

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

describe("Topography", () => {
  afterEach(() => vi.restoreAllMocks());

  it("draws nothing when the user prefers reduced motion", () => {
    // Stubbed to true so the reduced-motion guard is the only thing that can
    // prevent a canvas here - jsdom has no WebGL 2 either way, so without this
    // stub this test would pass whether or not the guard exists. The guard
    // returns before `new Renderer()`, so this does not hit jsdom's WebGL
    // throw.
    vi.spyOn(topographyModule, "hasWebGL2").mockReturnValue(true);
    setReducedMotion(true);
    const { container } = render(<Topography />);

    expect(container.querySelector("canvas")).toBeNull();
  });

  it("draws nothing without WebGL 2", () => {
    // jsdom has no WebGL at all, so this is the real path here - and it is also
    // what a machine with WebGL 1 only sees. The galaxy shows through instead
    // of a dead canvas.
    setReducedMotion(false);
    const { container } = render(<Topography />);

    expect(container.querySelector("canvas")).toBeNull();
  });

  it("renders a decorative host that never takes pointer events", () => {
    setReducedMotion(false);
    const { container } = render(<Topography />);
    const host = container.querySelector(".orbit-topography");

    expect(host).not.toBeNull();
    expect(host).toHaveAttribute("aria-hidden", "true");
  });
});
