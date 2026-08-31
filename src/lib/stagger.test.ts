import { describe, expect, it } from "vitest";
import { STAGGER_STEP_MS, STAGGER_MAX_INDEX, staggerDelayMs } from "./stagger";

describe("staggerDelayMs", () => {
  it("steps evenly for early items", () => {
    expect(staggerDelayMs(0)).toBe(0);
    expect(staggerDelayMs(3)).toBe(3 * STAGGER_STEP_MS);
  });

  it("caps so a long list does not trickle in for seconds", () => {
    // Uncapped, a 200-row list would take eight seconds to finish appearing and
    // the last rows would arrive long after the user started reading.
    expect(staggerDelayMs(50)).toBe(STAGGER_MAX_INDEX * STAGGER_STEP_MS);
    expect(staggerDelayMs(200)).toBe(STAGGER_MAX_INDEX * STAGGER_STEP_MS);
  });

  it("never returns a negative delay", () => {
    expect(staggerDelayMs(-4)).toBe(0);
  });
});
