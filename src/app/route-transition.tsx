import { useEffect, useRef, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";

/** Long enough that a cached chunk resolves first, short enough that a genuinely
 *  slow route still reports progress promptly. */
export const FALLBACK_DELAY_MS = 150;

/**
 * The loader, withheld briefly.
 *
 * Most navigations in this app resolve almost immediately because the chunk is
 * already cached, and showing a spinner for three frames reads as jank rather
 * than as feedback. This renders nothing until the route has actually been slow
 * enough to warrant saying so.
 */
export function DelayedFallback({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), FALLBACK_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);

  return visible ? <>{children}</> : null;
}

export function RouteSettle({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const sweepRef = useRef<HTMLDivElement | null>(null);
  const isFirstRender = useRef(true);

  useEffect(() => {
    // The very first paint already gets its settle from the CSS animation on
    // .orbit-route-enter (styles.css), which is gated on
    // prefers-reduced-motion by its own @media block. This effect only
    // replays the settle for the navigations that follow: the wrapper is no
    // longer remounted by keying it on the pathname (that used to discard
    // component state - e.g. the active tab on the project workspace page -
    // on every navigation), so the element persists and a CSS animation on a
    // persisting element does not restart on its own.
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    // The Web Animations API isn't reached by the CSS prefers-reduced-motion
    // rule in styles.css (that rule only neutralises `animation` and
    // `transition`), so this needs its own guard - the same reason
    // click-spark.tsx carries one. Missing matchMedia is treated as "allow",
    // matching that same file's fallback.
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) return;

    // jsdom (used in tests) does not implement Element.animate; guard so this
    // never throws there, or in any other environment lacking it.
    if (typeof wrapper.animate !== "function") return;

    const sweep = sweepRef.current;
    if (sweep) {
      sweep.classList.remove("orbit-route-sweep--playing");
      // Reading offsetWidth forces a reflow, which is what makes the class
      // re-add restart the animation rather than being coalesced away.
      void sweep.offsetWidth;
      sweep.classList.add("orbit-route-sweep--playing");
    }

    wrapper.animate(
      [
        { opacity: 0, transform: "translateY(0.45rem)" },
        { opacity: 1, transform: "translateY(0)" },
      ],
      // fill: "none" so nothing lingers on the element once the replay ends -
      // the same reasoning behind styles.css's .orbit-route-enter keyframe
      // omitting a fill mode: a retained transform value would make this
      // wrapper a containing block for any `position: fixed` descendant.
      { duration: 420, easing: "ease-out", fill: "none" },
    );
  }, [pathname]);

  return (
    <>
      <div className="orbit-route-enter" ref={wrapperRef}>
        {children}
      </div>
      <div className="orbit-route-sweep" ref={sweepRef} />
    </>
  );
}
