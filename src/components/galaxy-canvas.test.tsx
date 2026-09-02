import { afterEach, describe, expect, it, vi } from "vitest";
import {
  advanceAnimationTime,
  decideQuality,
  FRAME_INTERVAL_MS,
  gpuReduced,
  isWebGLAvailable,
  REDUCE_GPU_KEY,
  shouldRenderFrame,
} from "./galaxy-canvas";

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

describe("decideQuality", () => {
  it("keeps the galaxy under 30 samples, however slow they are", () => {
    // Not enough of a look at the machine to trust a verdict - a burst of 29
    // terrible frames (say, from page-load contention) must not be enough to
    // flip a fine machine to the fallback permanently.
    const slowButFew = Array(29).fill(200);
    expect(decideQuality(slowButFew)).toBe("keep");
  });

  it("keeps the galaxy at exactly 30 samples when the median is at or under the threshold", () => {
    const fast = Array(30).fill(16);
    expect(decideQuality(fast)).toBe("keep");
  });

  it("falls back at exactly 30 samples once the median clears 40ms", () => {
    const slow = Array(30).fill(41);
    expect(decideQuality(slow)).toBe("fallback");
  });

  it("keeps the galaxy when the median sits exactly on the 40ms threshold", () => {
    // Strictly greater-than: a median of exactly 40ms is 25fps, not below it.
    const atThreshold = Array(30).fill(40);
    expect(decideQuality(atThreshold)).toBe("keep");
  });

  it("judges by the median, not the mean, so a few very slow frames don't skew the verdict", () => {
    // 29 fast frames and one catastrophic one: the mean would clear 40ms, the
    // median (16ms) does not.
    const mostlyFast = [...Array(29).fill(16), 5000];
    expect(decideQuality(mostlyFast)).toBe("keep");
  });

  it("handles unsorted input, since real frame intervals arrive in time order, not sorted order", () => {
    const unsorted = [50, 10, 90, 45, 60, 5, 100, 30, 70, 20, 55, 15, 95, 25, 65, 35, 80, 40, 75, 5, 85, 45, 60, 10, 50, 90, 30, 70, 20, 55];
    expect(unsorted.length).toBe(30);
    expect(decideQuality(unsorted)).toBe("fallback");
  });

  it("does not mutate the array it is given", () => {
    const samples = Array(30).fill(50);
    const original = [...samples];
    decideQuality(samples);
    expect(samples).toEqual(original);
  });
});

describe("gpuReduced", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    window.localStorage.removeItem(REDUCE_GPU_KEY);
  });

  it("reports false when the flag was never set", () => {
    expect(gpuReduced()).toBe(false);
  });

  it("reports true once the flag is set", () => {
    window.localStorage.setItem(REDUCE_GPU_KEY, "1");
    expect(gpuReduced()).toBe(true);
  });

  it("reports false when localStorage throws, rather than propagating", () => {
    // Some privacy tooling throws on access rather than returning null - the
    // same defensiveness isWebGLAvailable already applies to its own probe.
    vi.spyOn(window.localStorage, "getItem").mockImplementation(() => {
      throw new Error("localStorage blocked");
    });
    expect(gpuReduced()).toBe(false);
  });
});
