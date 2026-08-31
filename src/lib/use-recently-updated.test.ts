import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MAX_FLAGGED_CHANGES, pickRecentlyChanged, useRecentlyUpdated } from "./use-recently-updated";

const map = (entries: Array<[string, string]>) => new Map(entries);

describe("pickRecentlyChanged", () => {
  it("returns nothing when no signature changed", () => {
    const before = map([["a", "1"], ["b", "1"]]);
    expect(pickRecentlyChanged(before, map([["a", "1"], ["b", "1"]]))).toEqual([]);
  });

  it("returns an id whose signature changed", () => {
    expect(pickRecentlyChanged(map([["a", "1"]]), map([["a", "2"]]))).toEqual(["a"]);
  });

  it("ignores ids it has never seen before", () => {
    // The load-flash guard, and the most important case here. On first render
    // the previous map is empty; treating new ids as "updated" would flash
    // every card on the board at once - exactly the failure this design exists
    // to avoid.
    expect(pickRecentlyChanged(new Map(), map([["a", "1"], ["b", "1"]]))).toEqual([]);
  });

  it("ignores ids that disappeared", () => {
    expect(pickRecentlyChanged(map([["a", "1"]]), new Map())).toEqual([]);
  });

  it("returns every changed id, not just the first", () => {
    const before = map([["a", "1"], ["b", "1"], ["c", "1"]]);
    const after = map([["a", "2"], ["b", "1"], ["c", "9"]]);
    expect(pickRecentlyChanged(before, after).sort()).toEqual(["a", "c"]);
  });

  it(`returns all ids when exactly ${MAX_FLAGGED_CHANGES} changed`, () => {
    const before = map([["a", "1"], ["b", "1"], ["c", "1"]]);
    const after = map([["a", "2"], ["b", "2"], ["c", "2"]]);
    expect(pickRecentlyChanged(before, after).sort()).toEqual(["a", "b", "c"]);
  });

  it("returns nothing when more than the cap changed - a sync, not an event", () => {
    const before = map([["a", "1"], ["b", "1"], ["c", "1"], ["d", "1"]]);
    const after = map([["a", "2"], ["b", "2"], ["c", "2"], ["d", "2"]]);
    expect(pickRecentlyChanged(before, after)).toEqual([]);
  });
});

describe("useRecentlyUpdated", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("flags a changed id and clears it after the hold", () => {
    const { result, rerender } = renderHook(({ sig }) => useRecentlyUpdated(sig, 1000), {
      initialProps: { sig: map([["a", "1"]]) },
    });

    expect([...result.current]).toEqual([]);

    rerender({ sig: map([["a", "2"]]) });
    expect([...result.current]).toEqual(["a"]);

    act(() => { vi.advanceTimersByTime(1000); });
    expect([...result.current]).toEqual([]);
  });

  it("restarts the hold when an id changes again", () => {
    // Without the clearTimeout in the implementation, the first timer would
    // fire 400ms after the second change and clear a border that is still
    // fresh.
    const { result, rerender } = renderHook(({ sig }) => useRecentlyUpdated(sig, 1000), {
      initialProps: { sig: map([["a", "1"]]) },
    });

    rerender({ sig: map([["a", "2"]]) });
    act(() => { vi.advanceTimersByTime(600); });
    rerender({ sig: map([["a", "3"]]) });

    act(() => { vi.advanceTimersByTime(600); });
    expect([...result.current]).toEqual(["a"]);

    act(() => { vi.advanceTimersByTime(400); });
    expect([...result.current]).toEqual([]);
  });

  it("does not update state after unmounting mid-hold", () => {
    // A broken cleanup would still pass every test above - none of them
    // unmount before the hold elapses. The regression this guards against is
    // a setFlagged call firing on an unmounted component, which React treats
    // as an error.
    const { result, rerender, unmount } = renderHook(({ sig }) => useRecentlyUpdated(sig, 1000), {
      initialProps: { sig: map([["a", "1"]]) },
    });

    rerender({ sig: map([["a", "2"]]) });
    expect([...result.current]).toEqual(["a"]);

    unmount();

    expect(() => {
      act(() => { vi.advanceTimersByTime(1000); });
    }).not.toThrow();
  });
});
