import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useCountUp } from "./use-count-up";

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

describe("useCountUp", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("returns the final value immediately under reduced motion", () => {
    // A number ticking up is motion, and CSS cannot reach a number. Without
    // this branch a reduce-preference user watches every stat animate.
    setReducedMotion(true);
    const { result } = renderHook(() => useCountUp(42, 500));

    expect(result.current).toBe(42);
  });

  it("starts at zero and reaches the value", () => {
    setReducedMotion(false);
    const { result } = renderHook(() => useCountUp(50, 500));

    expect(result.current).toBe(0);

    act(() => { vi.advanceTimersByTime(500); });
    expect(result.current).toBe(50);
  });

  it("retargets when the value changes mid-count", () => {
    // A refetch that changes the number must not leave it stranded partway to
    // the old target.
    setReducedMotion(false);
    const { result, rerender } = renderHook(({ v }) => useCountUp(v, 500), {
      initialProps: { v: 50 },
    });

    act(() => { vi.advanceTimersByTime(250); });
    rerender({ v: 80 });
    act(() => { vi.advanceTimersByTime(500); });

    expect(result.current).toBe(80);
  });

  it("handles zero without dividing by it", () => {
    setReducedMotion(false);
    const { result } = renderHook(() => useCountUp(0, 500));

    act(() => { vi.advanceTimersByTime(500); });
    expect(result.current).toBe(0);
  });

  it("settles on a fast-changing value instead of chasing it forever", () => {
    // If `value` changes more often than the animation's duration, restarting
    // the effect on every change means the count converges but never lands,
    // and the interval it schedules never gets a chance to clear itself.
    // Once the remaining gap is small enough, the hook should snap straight
    // to the target instead of scheduling another interval.
    setReducedMotion(false);
    const { result, rerender } = renderHook(({ v }) => useCountUp(v, 700), {
      initialProps: { v: 0 },
    });

    let value = 0;
    for (let i = 0; i < 20; i++) {
      value += 1;
      rerender({ v: value });
      act(() => { vi.advanceTimersByTime(100); });
    }

    // No interval should still be pending: nothing left to schedule work,
    // and advancing time further must not change the displayed value.
    expect(vi.getTimerCount()).toBe(0);
    const settled = result.current;
    act(() => { vi.advanceTimersByTime(2000); });
    expect(result.current).toBe(settled);
    expect(result.current).toBe(value);
  });
});
