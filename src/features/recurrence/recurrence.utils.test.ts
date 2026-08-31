import { describe, expect, it } from "vitest";
import {
  countMissedOccurrences,
  describeRecurrence,
  matchesRecurrence,
  type RecurrenceRule,
} from "./recurrence.utils";

function rule(overrides: Partial<RecurrenceRule> = {}): RecurrenceRule {
  return { id: "rule-1", pattern: "daily", weekdays: [], dayOfMonth: null, ...overrides };
}

describe("matchesRecurrence", () => {
  it("fires every day for a daily rule", () => {
    expect(matchesRecurrence(rule(), "2026-08-09")).toBe(true);
    expect(matchesRecurrence(rule(), "2026-08-10")).toBe(true);
  });

  it("skips weekends for a weekdays rule", () => {
    // 2026-08-09 is a Sunday, 2026-08-10 a Monday, 2026-08-15 a Saturday.
    expect(matchesRecurrence(rule({ pattern: "weekdays" }), "2026-08-09")).toBe(false);
    expect(matchesRecurrence(rule({ pattern: "weekdays" }), "2026-08-10")).toBe(true);
    expect(matchesRecurrence(rule({ pattern: "weekdays" }), "2026-08-15")).toBe(false);
  });

  it("fires only on the chosen weekdays", () => {
    const weekly = rule({ pattern: "weekly", weekdays: [1, 4] });

    expect(matchesRecurrence(weekly, "2026-08-10")).toBe(true);
    expect(matchesRecurrence(weekly, "2026-08-13")).toBe(true);
    expect(matchesRecurrence(weekly, "2026-08-11")).toBe(false);
  });

  it("fires on the chosen day of the month", () => {
    const monthly = rule({ pattern: "monthly", dayOfMonth: 12 });

    expect(matchesRecurrence(monthly, "2026-08-12")).toBe(true);
    expect(matchesRecurrence(monthly, "2026-08-13")).toBe(false);
  });

  it("clamps a day beyond the month to the last day", () => {
    const monthly = rule({ pattern: "monthly", dayOfMonth: 31 });

    expect(matchesRecurrence(monthly, "2026-02-28")).toBe(true);
    expect(matchesRecurrence(monthly, "2026-04-30")).toBe(true);
    expect(matchesRecurrence(monthly, "2026-12-31")).toBe(true);
    expect(matchesRecurrence(monthly, "2026-12-30")).toBe(false);
  });
});

describe("countMissedOccurrences", () => {
  it("returns zero when the rule has never been evaluated", () => {
    expect(countMissedOccurrences(rule(), null, "2026-08-09")).toBe(0);
  });

  it("excludes both the watermark day and today", () => {
    // Aug 5 through Aug 9 exclusive leaves the 6th, 7th and 8th.
    expect(countMissedOccurrences(rule(), "2026-08-05", "2026-08-09")).toBe(3);
  });

  it("counts only matching days", () => {
    const weekly = rule({ pattern: "weekly", weekdays: [1] });

    // Aug 3 through Aug 18 covers the Mondays of the 3rd, 10th and 17th.
    expect(countMissedOccurrences(weekly, "2026-08-02", "2026-08-19")).toBe(3);
  });

  it("returns zero when the watermark already reaches today", () => {
    expect(countMissedOccurrences(rule(), "2026-08-09", "2026-08-09")).toBe(0);
  });
});

describe("describeRecurrence", () => {
  it("summarises each pattern in words", () => {
    expect(describeRecurrence(rule())).toBe("Every day");
    expect(describeRecurrence(rule({ pattern: "weekdays" }))).toBe("Every weekday");
    expect(describeRecurrence(rule({ pattern: "weekly", weekdays: [1, 4] }))).toBe("Weekly on Mon, Thu");
    expect(describeRecurrence(rule({ pattern: "monthly", dayOfMonth: 12 }))).toBe("Monthly on day 12");
  });
});
