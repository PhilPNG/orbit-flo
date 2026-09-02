import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as galaxyCanvas from "./galaxy-canvas";
import { REDUCE_GPU_KEY } from "./galaxy-canvas";
import { SatelliteLoader, StarFieldBackground, starfieldRootClassName } from "./space-visuals";

describe("space visuals", () => {
  it("labels the satellite loader as a status indicator", () => {
    render(<SatelliteLoader label="Systems online" />);

    expect(screen.getByRole("status", { name: "Systems online" })).toBeTruthy();
    expect(screen.getByTestId("satellite-loader-trail")).toHaveAttribute("aria-hidden", "true");
  });

  it("renders layered starfield depth without exposing decorative layers", () => {
    const { container } = render(
      <div className="relative">
        <StarFieldBackground />
      </div>,
    );

    expect(container.querySelector(".orbit-starfield-far")).toBeTruthy();
    expect(container.querySelector(".orbit-starfield-mid")).toBeTruthy();
    expect(container.querySelector(".orbit-starfield-near")).toBeTruthy();
    expect(container.querySelector(".orbit-nebula")).toBeTruthy();
    expect(container.querySelector(".orbit-grain")).toBeTruthy();
    expect(container.querySelector(".orbit-star-flare")).toHaveAttribute("aria-hidden", "true");
  });

  it("uses the slow star layers, PNG grain, and occasional meteors", () => {
    const { container } = render(<StarFieldBackground />);

    expect(container.querySelectorAll(".orbit-star-layer")).toHaveLength(3);
    expect(container.querySelector(".orbit-grain")).toHaveStyle({
      backgroundImage: 'url("/assets/textures/deep-space-grain-v2.png")',
    });
    expect(container.querySelectorAll(".orbit-meteor")).toHaveLength(3);
  });

  it("keeps every decorative layer out of the accessibility tree", () => {
    const { container } = render(<StarFieldBackground />);

    const root = container.querySelector(".orbit-starfield-root");

    expect(root).toHaveAttribute("aria-hidden", "true");
    for (const meteor of container.querySelectorAll(".orbit-meteor")) {
      expect(meteor).toHaveAttribute("aria-hidden", "true");
    }
  });

  it("falls back to CSS layers when WebGL is unavailable", () => {
    // jsdom has no WebGL, so this is the real path here — and it is also what
    // a user with a blocked GPU sees. The CSS layers must survive.
    const { container } = render(<StarFieldBackground />);

    expect(container.querySelector(".orbit-galaxy-canvas")).toBeNull();
    expect(container.querySelectorAll(".orbit-star-layer")).toHaveLength(3);
    expect(container.querySelector(".orbit-starfield-root--webgl")).toBeNull();
  });

  it("keeps the nebula and grain on the fallback path", () => {
    // The nebula carries the colour. Losing it would make the fallback a flat
    // black rectangle rather than a quieter version of the same product.
    const { container } = render(<StarFieldBackground />);

    expect(container.querySelector(".orbit-nebula")).not.toBeNull();
    expect(container.querySelector(".orbit-grain")).not.toBeNull();
  });

  it("hides decorative layers from assistive technology either way", () => {
    const { container } = render(<StarFieldBackground />);

    expect(container.querySelector(".orbit-starfield-root")).toHaveAttribute("aria-hidden", "true");
  });

  describe("starfieldRootClassName", () => {
    // A real webglcontextlost event cannot be produced in jsdom (there is no
    // WebGL context to lose), so context-loss recovery is proven against the
    // pure class-name decision instead of a mocked WebGL context.

    it("applies the --webgl modifier when the galaxy is selected and its context is intact", () => {
      expect(starfieldRootClassName(true, false)).toContain("orbit-starfield-root--webgl");
    });

    it("drops the --webgl modifier once the WebGL context is lost, even though the galaxy was selected", () => {
      // This is the recovery path: a driver reset should bring the CSS star
      // layers back rather than leaving the user with nebula and grain only.
      expect(starfieldRootClassName(true, true)).not.toContain("orbit-starfield-root--webgl");
    });

    it("never applies the --webgl modifier when the galaxy was never selected", () => {
      expect(starfieldRootClassName(false, false)).not.toContain("orbit-starfield-root--webgl");
    });
  });

  describe("adaptive quality flag", () => {
    afterEach(() => {
      vi.restoreAllMocks();
      window.localStorage.removeItem(REDUCE_GPU_KEY);
    });

    it("stays on the CSS fallback when a prior measurement flagged this machine, even though WebGL is available", () => {
      // Stubbed true so the reduce-gpu flag is the only thing that can prevent
      // a canvas here - jsdom has no WebGL either way, so without this stub
      // this test would pass whether or not the guard exists.
      vi.spyOn(galaxyCanvas, "isWebGLAvailable").mockReturnValue(true);
      window.localStorage.setItem(REDUCE_GPU_KEY, "1");

      const { container } = render(<StarFieldBackground />);

      expect(container.querySelector(".orbit-galaxy-canvas")).toBeNull();
      expect(container.querySelector(".orbit-starfield-root--webgl")).toBeNull();
      expect(container.querySelectorAll(".orbit-star-layer")).toHaveLength(3);
    });
  });
});
