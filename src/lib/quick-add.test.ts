import { describe, expect, it } from "vitest";
import { parseQuickAdd } from "./quick-add";

describe("parseQuickAdd", () => {
  it("parses an idea prefix without metadata", () => {
    expect(parseQuickAdd("idea: Better onboarding prompts")).toEqual({
      type: "idea",
      title: "Better onboarding prompts",
      body: "Captured from global quick add.",
    });
  });

  it("parses a task prefix with due date and priority metadata", () => {
    expect(parseQuickAdd("task: Fix auth callback tomorrow high")).toEqual({
      type: "task",
      title: "Fix auth callback",
      body: "Parsed metadata: due tomorrow, priority high.",
    });
  });

  it("defaults blocked input to a blocker while keeping the title intact", () => {
    expect(parseQuickAdd("OAuth is blocked by provider setup")).toEqual({
      type: "blocker",
      title: "OAuth is blocked by provider setup",
      body: "Captured from global quick add.",
    });
  });

  it("uses the original trimmed input when metadata removal empties the title", () => {
    expect(parseQuickAdd("today high")).toEqual({
      type: "task",
      title: "today high",
      body: "Parsed metadata: due today, priority high.",
    });
  });

  it("removes repeated due metadata tokens from the title", () => {
    expect(parseQuickAdd("task: today Ship today tomorrow checklist tomorrow")).toEqual({
      type: "task",
      title: "Ship checklist",
      body: "Parsed metadata: due today, due tomorrow.",
    });
  });

  it("removes all priority metadata tokens while recording the first priority", () => {
    expect(parseQuickAdd("task: Investigate auth critical high medium low")).toEqual({
      type: "task",
      title: "Investigate auth",
      body: "Parsed metadata: priority critical.",
    });
  });
});
