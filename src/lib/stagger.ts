export const STAGGER_STEP_MS = 40;
/** Past this, everything shares the final delay. A 200-row list staggered
 *  uncapped would take eight seconds to finish arriving. */
export const STAGGER_MAX_INDEX = 12;

export function staggerDelayMs(index: number): number {
  if (index <= 0) return 0;
  return Math.min(index, STAGGER_MAX_INDEX) * STAGGER_STEP_MS;
}
