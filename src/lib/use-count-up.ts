import { useEffect, useState } from "react";

const DEFAULT_DURATION_MS = 700;
const TICK_MS = 1000 / 30;

// Below this distance from the target, animating is pointless: the eased
// curve would round to the same displayed integer for most of its run, so
// skip the interval and land on the value directly. This also guards a
// fast-changing value (e.g. a live-updating stat) from restarting the
// interval on every render and never settling - once the remaining gap is
// this small, we commit instead of chasing a moving target.
const SNAP_THRESHOLD = 1;

/**
 * A number that ticks up to its value.
 *
 * Uses an interval rather than requestAnimationFrame because a counter updates
 * React state on every step, and 30 updates a second is already more than the
 * eye needs from a dashboard stat - rAF would do twice the renders for no
 * visible gain.
 *
 * Carries its own reduced-motion guard: a counting number is motion, and CSS
 * cannot reach a number.
 *
 * Despite the name, it counts down too when a stat drops - the animation
 * direction just follows whichever way `value` moves.
 */
export function useCountUp(value: number, durationMs: number = DEFAULT_DURATION_MS): number {
  const [display, setDisplay] = useState(() => {
    const query = typeof window !== "undefined" ? window.matchMedia?.("(prefers-reduced-motion: reduce)") : null;
    return query?.matches ? value : 0;
  });

  useEffect(() => {
    const query = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (query?.matches) {
      setDisplay(value);
      return;
    }

    const from = display;
    if (from === value) return;

    if (Math.abs(value - from) <= SNAP_THRESHOLD) {
      setDisplay(value);
      return;
    }

    const startedAt = Date.now();
    const timer = setInterval(() => {
      const progress = Math.min(1, (Date.now() - startedAt) / Math.max(durationMs, 1));
      // Ease-out: fast at first, settling at the end. A linear count reads
      // mechanical.
      const eased = 1 - (1 - progress) ** 3;
      setDisplay(Math.round(from + (value - from) * eased));
      if (progress >= 1) clearInterval(timer);
    }, TICK_MS);

    return () => clearInterval(timer);
    // `display` is deliberately not a dependency: including it would restart
    // the count on every tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, durationMs]);

  return display;
}
