import { describe, expect, it } from "vitest";
import { advanceAnimationTime, FRAME_INTERVAL_MS, isWebGLAvailable, shouldRenderFrame } from "./galaxy-canvas";

describe("shouldRenderFrame", () => {
  it("never renders while the tab is hidden", () => {
    // The battery claim in the spec. An animation loop in a background tab is
    // pure cost, and this app is one people leave open all day.
    expect(shouldRenderFrame(100_000, 0, true)).toBe(false);
  });

  it("skips frames that arrive before the interval has elapsed", () => {
    // The frame cap. A 240Hz display should not do four times the work for no
    // visible benefit.
    expect(shouldRenderFrame(1_000, 1_000 - (FRAME_INTERVAL_MS - 1), false)).toBe(false);
  });

  it("renders once the interval has elapsed", () => {
    expect(shouldRenderFrame(1_000, 1_000 - FRAME_INTERVAL_MS, false)).toBe(true);
  });

  it("renders the very first frame", () => {
    // lastFrameAt starts at 0, so the first call must not be gated.
    expect(shouldRenderFrame(16, 0, false)).toBe(true);
  });
});

describe("advanceAnimationTime", () => {
  it("adds no delta on the first frame, since there is no prior frame to measure from", () => {
    // lastRenderAt starts null on mount. A delta here would mean the first
    // frame's timestamp (large, since it's ms since navigation start) leaks
    // straight into the accumulator.
    expect(advanceAnimationTime(0, 1_000, null)).toBe(0);
  });

  it("accumulates the real gap between two rendered frames", () => {
    expect(advanceAnimationTime(500, 1_600, 1_000)).toBe(1_100);
  });

  it("does not count a hidden-tab (or reduced-motion) pause as elapsed animation time", () => {
    // The caller resets lastRenderAt to null while paused. Resuming after an
    // arbitrarily long gap must not fold that gap into the accumulator — this
    // is what keeps rotation continuing smoothly instead of snapping.
    expect(advanceAnimationTime(2_000, 500_000, null)).toBe(2_000);
  });

  it("keeps accumulating across many small frames the way a real loop would", () => {
    let elapsed = 0;
    let last: number | null = null;
    for (const now of [16, 33, 49, 66]) {
      elapsed = advanceAnimationTime(elapsed, now, last);
      last = now;
    }
    // The first frame (now = 16) contributes no delta, since there is no
    // prior frame yet — total elapsed is measured from that first frame, not
    // from zero, so it is 66 - 16, not 66.
    expect(elapsed).toBe(50);
  });
});

describe("isWebGLAvailable", () => {
  it("reports false under jsdom, which has no WebGL", () => {
    // This is what keeps the existing suite green: StarFieldBackground asks
    // this question and takes the CSS path. If this ever returns true here,
    // the guard is not doing what the whole design depends on.
    expect(isWebGLAvailable()).toBe(false);
  });
});
