import { describe, expect, it } from "vitest";
import { buildTodayGreeting } from "./daily-plan.utils";

type PlanState = { state: "planned" | "completed" | "skipped" };

describe("buildTodayGreeting", () => {
  it("invites a first objective on an empty day", () => {
    expect(buildTodayGreeting([], 0)).toBe("A clear sky. Add an objective to begin.");
  });

  it("points at waiting suggestions on an empty day", () => {
    expect(buildTodayGreeting([], 3)).toBe("A clear sky. 3 suggestions waiting when you're ready.");
  });

  it("uses singular forms", () => {
    expect(buildTodayGreeting([], 1)).toBe("A clear sky. 1 suggestion waiting when you're ready.");
    const items: PlanState[] = [{ state: "planned" }];
    expect(buildTodayGreeting(items, 0)).toBe("1 objective in orbit");
  });

  it("summarizes an active day", () => {
    const items: PlanState[] = [
      { state: "planned" },
      { state: "planned" },
      { state: "completed" },
    ];
    expect(buildTodayGreeting(items, 2)).toBe("3 objectives in orbit · 1 complete · 2 suggestions waiting");
  });

  it("omits zero parts", () => {
    const items: PlanState[] = [{ state: "planned" }, { state: "planned" }];
    expect(buildTodayGreeting(items, 0)).toBe("2 objectives in orbit");
  });
});
