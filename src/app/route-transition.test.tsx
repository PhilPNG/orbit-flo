import { fireEvent, render, screen } from "@testing-library/react";
import { act, useState } from "react";
import { MemoryRouter, useNavigate } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import routeWrapperStylesheet from "../styles.css?raw";
import { DelayedFallback, FALLBACK_DELAY_MS, RouteSettle } from "./route-transition";

describe("DelayedFallback", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("renders nothing before the delay", () => {
    // The point of the whole change: a cached route resolves inside this
    // window, so the user never sees a spinner flash.
    render(<DelayedFallback><div role="status" /></DelayedFallback>);

    act(() => { vi.advanceTimersByTime(FALLBACK_DELAY_MS - 1); });
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("renders the loader once the delay has passed", () => {
    // The other half. A fallback that never appears is as wrong as one that
    // always does - a genuinely slow route must still show progress.
    render(<DelayedFallback><div role="status" /></DelayedFallback>);

    act(() => { vi.advanceTimersByTime(FALLBACK_DELAY_MS); });
    expect(screen.getByRole("status")).toBeTruthy();
  });

  it("unmounting before the delay elapses does not throw or warn", () => {
    // Regression guard: a missing `clearTimeout` in the effect cleanup would
    // let this timer fire `setState` on an unmounted component once the
    // fake clock advances - a call neither of the two tests above would
    // ever trigger, since neither unmounts early.
    const warnSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { unmount } = render(<DelayedFallback><div role="status" /></DelayedFallback>);

    act(() => { vi.advanceTimersByTime(FALLBACK_DELAY_MS - 1); });
    expect(() => unmount()).not.toThrow();

    expect(() => {
      act(() => { vi.advanceTimersByTime(FALLBACK_DELAY_MS); });
    }).not.toThrow();
    expect(warnSpy).not.toHaveBeenCalled();

    warnSpy.mockRestore();
  });
});

describe("RouteSettle", () => {
  afterEach(() => {
    document.querySelectorAll("style[data-test-stylesheet]").forEach((node) => node.remove());
  });

  it("does not set will-change: transform on the route wrapper", () => {
    // Finding 1 (CRITICAL): `will-change: transform` on this wrapper - or a
    // retained `transform` value after its animation ends - makes it a
    // containing block for every `position: fixed` descendant of every
    // routed screen (the maps node inspector, the project workspace error
    // toast). jsdom does not do layout, so we cannot assert on measured
    // position the way a real browser reproduction would; the computed
    // `will-change` property is the proxy, because it is one of the two
    // independent things that create the containing block in the first
    // place (the other is a lingering `transform`, which the "no fill mode"
    // animation in styles.css's .orbit-route-enter avoids - not something a
    // computed-style snapshot outside a running animation can observe).
    //
    // The real stylesheet is loaded (not duplicated here) so this test
    // fails if the rule regresses, rather than only asserting a class name.
    const style = document.createElement("style");
    style.setAttribute("data-test-stylesheet", "true");
    style.textContent = routeWrapperStylesheet;
    document.head.appendChild(style);

    const { container } = render(
      <MemoryRouter initialEntries={["/w/workspace-1/dashboard"]}>
        <RouteSettle>
          <div>content</div>
        </RouteSettle>
      </MemoryRouter>,
    );

    const wrapper = container.querySelector(".orbit-route-enter");
    expect(wrapper).not.toBeNull();

    const computedWillChange = getComputedStyle(wrapper as Element).willChange;
    expect(computedWillChange).not.toContain("transform");
  });

  it("does not remount its children when the route path changes", () => {
    // Finding 2 (Important): the old `key={pathname}` forced a remount on
    // every navigation, discarding state such as the project workspace
    // page's active tab. A remount resets useState back to its initial
    // value, so bumping this counter and then navigating - driven through
    // the router via useNavigate, not by swapping MemoryRouter's
    // initialEntries prop, which the router only reads once on mount - is a
    // direct probe for whether the child instance (and its state) survived.
    function ProbeChild() {
      const [count, setCount] = useState(0);
      return (
        <button onClick={() => setCount((c) => c + 1)} type="button">
          count:{count}
        </button>
      );
    }

    function NavigationProbe() {
      const navigate = useNavigate();
      return (
        <>
          <button onClick={() => navigate("/w/workspace-1/projects/project-2")} type="button">
            Navigate
          </button>
          <RouteSettle>
            <ProbeChild />
          </RouteSettle>
        </>
      );
    }

    const { getByText } = render(
      <MemoryRouter initialEntries={["/w/workspace-1/projects/project-1"]}>
        <NavigationProbe />
      </MemoryRouter>,
    );

    fireEvent.click(getByText("count:0"));
    expect(getByText("count:1")).toBeTruthy();

    fireEvent.click(getByText("Navigate"));
    expect(getByText("count:1")).toBeTruthy();
  });
});
