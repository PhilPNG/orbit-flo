import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as galaxyCanvas from "./galaxy-canvas";
import { REDUCE_GPU_KEY } from "./galaxy-canvas";
import { Orb } from "./orb";

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

describe("Orb", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    window.localStorage.removeItem(REDUCE_GPU_KEY);
  });

  it("draws nothing when the user prefers reduced motion", () => {
    // Stubbed to true so the reduced-motion guard is the only thing that can
    // prevent a canvas here - jsdom has no WebGL either way, so without this
    // stub this test would pass whether or not the guard exists. The guard
    // returns before `new Renderer()`, so this does not hit jsdom's WebGL
    // throw.
    vi.spyOn(galaxyCanvas, "isWebGLAvailable").mockReturnValue(true);
    setReducedMotion(true);
    const { container } = render(<Orb />);

    expect(container.querySelector("canvas")).toBeNull();
  });

  it("mounts no canvas when WebGL is unavailable", () => {
    // jsdom has no WebGL, so this is the real path exercised here - and it is
    // also exactly what a user with a blocked or unavailable GPU sees: no
    // canvas at all, rather than an empty one occupying the layout slot.
    setReducedMotion(false);
    const { container } = render(<Orb />);

    expect(container.querySelector("canvas")).toBeNull();
  });

  it("still renders a decorative host element when the canvas can't mount", () => {
    setReducedMotion(false);
    const { container } = render(<Orb />);

    const host = container.querySelector(".auth-orb-host");
    expect(host).not.toBeNull();
    expect(host).toHaveAttribute("aria-hidden", "true");
  });

  it("renders the static CSS fallback when the canvas can't mount", () => {
    // Regression coverage: without this, a reduced-motion or GPU-blocked
    // visitor sees the four feature cards floating around an empty host.
    setReducedMotion(true);
    const { container } = render(<Orb />);

    expect(container.querySelector(".auth-orb-fallback")).not.toBeNull();
  });

  it("draws nothing when a prior measurement flagged this machine, even though WebGL is available", () => {
    // Stubbed true so the reduce-gpu flag is the only thing that can prevent a
    // canvas here - jsdom has no WebGL either way, so without this stub this
    // test would pass whether or not the guard exists. The guard returns
    // before `new Renderer()`, so this does not hit jsdom's WebGL throw.
    vi.spyOn(galaxyCanvas, "isWebGLAvailable").mockReturnValue(true);
    setReducedMotion(false);
    window.localStorage.setItem(REDUCE_GPU_KEY, "1");

    const { container } = render(<Orb />);

    expect(container.querySelector("canvas")).toBeNull();
    expect(container.querySelector(".auth-orb-fallback")).not.toBeNull();
  });
});
