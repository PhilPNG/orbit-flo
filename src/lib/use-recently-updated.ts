import { useEffect, useRef, useState } from "react";

const DEFAULT_HOLD_MS = 1200;

/**
 * Above this many changed ids in one pass, report none of them.
 *
 * A handful of changes is *something happened* - a card someone else edited,
 * worth pointing at. A dozen at once is a *sync* - a refetch after a tab
 * refocus, a bulk import - and a sync is not an event worth pointing at.
 * Flagging nothing is the correct response to a bulk update; flagging all of
 * them is the "forty shimmering cards" failure this design exists to
 * prevent, arriving via staleness instead of mount.
 */
export const MAX_FLAGGED_CHANGES = 3;

/**
 * Ids whose signature differs between two snapshots.
 *
 * An id absent from `previous` is deliberately NOT reported. On first render
 * the previous snapshot is empty, so treating new ids as updated would flag
 * every card on the board at once. The cost of that choice is that a
 * newly-created card does not flash; the alternative is that all forty do.
 */
export function pickRecentlyChanged(
  previous: ReadonlyMap<string, string>,
  next: ReadonlyMap<string, string>,
): string[] {
  const changed: string[] = [];
  next.forEach((value, id) => {
    const before = previous.get(id);
    if (before !== undefined && before !== value) changed.push(id);
  });
  if (changed.length > MAX_FLAGGED_CHANGES) return [];
  return changed;
}

/**
 * Which ids changed recently, for the one-pass "just updated" border.
 *
 * The effect runs on every render with no dependency array, on purpose. A
 * `Map` built inline by the caller has a new identity every render, so a
 * dependency on it would fire constantly — and asking callers to memoise is
 * the same footgun that made GalaxyCanvas take no props. Running every render
 * is safe because a render in which nothing changed does no work: the ref is
 * already up to date, `pickRecentlyChanged` returns empty, and the effect
 * returns before touching state.
 */
export function useRecentlyUpdated(
  signature: ReadonlyMap<string, string>,
  holdMs: number = DEFAULT_HOLD_MS,
): ReadonlySet<string> {
  const previousRef = useRef<ReadonlyMap<string, string>>(new Map());
  const timersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const [flagged, setFlagged] = useState<ReadonlySet<string>>(new Set());

  useEffect(() => {
    const changed = pickRecentlyChanged(previousRef.current, signature);
    previousRef.current = signature;
    if (changed.length === 0) return;

    setFlagged((current) => {
      const next = new Set(current);
      changed.forEach((id) => next.add(id));
      return next;
    });

    const timers = timersRef.current;
    changed.forEach((id) => {
      // An id that changes twice in quick succession restarts its hold. Without
      // this the first timer would clear the border while the second change is
      // still fresh.
      const running = timers.get(id);
      if (running) clearTimeout(running);

      timers.set(
        id,
        setTimeout(() => {
          timers.delete(id);
          setFlagged((current) => {
            if (!current.has(id)) return current;
            const next = new Set(current);
            next.delete(id);
            return next;
          });
        }, holdMs),
      );
    });
  });

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach((timer) => clearTimeout(timer));
      timers.clear();
    };
  }, []);

  return flagged;
}
