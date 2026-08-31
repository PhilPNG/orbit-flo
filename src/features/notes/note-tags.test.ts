import { describe, expect, it } from "vitest";
import { buildTagIndex, matchesTags, normalizeTags, parseTagInput } from "./note-tags";

describe("parseTagInput", () => {
  it("splits on commas and trims", () => {
    expect(parseTagInput("design, risk ,  ops")).toEqual(["design", "risk", "ops"]);
  });

  it("lowercases so Design and design are one tag", () => {
    expect(parseTagInput("Design, DESIGN")).toEqual(["design"]);
  });

  it("drops empties rather than storing blanks", () => {
    expect(parseTagInput("design,,  ,risk")).toEqual(["design", "risk"]);
  });

  it("returns nothing for an empty field", () => {
    expect(parseTagInput("   ")).toEqual([]);
  });
});

describe("normalizeTags", () => {
  it("lowercases and dedupes an existing array", () => {
    expect(normalizeTags(["Design", "design", "Risk"])).toEqual(["design", "risk"]);
  });

  it("keeps first-seen order", () => {
    expect(normalizeTags(["ops", "design"])).toEqual(["ops", "design"]);
  });
});

describe("buildTagIndex", () => {
  it("counts each tag across the notes", () => {
    const index = buildTagIndex([
      { tags: ["design", "risk"] },
      { tags: ["design"] },
      { tags: [] },
    ]);

    expect(index).toEqual([
      { tag: "design", count: 2 },
      { tag: "risk", count: 1 },
    ]);
  });

  it("orders by count, then alphabetically for a stable list", () => {
    const index = buildTagIndex([{ tags: ["zebra", "alpha"] }, { tags: ["alpha"] }]);

    expect(index.map((entry) => entry.tag)).toEqual(["alpha", "zebra"]);
  });

  it("is empty when nothing is tagged", () => {
    expect(buildTagIndex([{ tags: [] }])).toEqual([]);
  });
});

describe("matchesTags", () => {
  it("keeps everything when nothing is selected", () => {
    expect(matchesTags(["design"], [])).toBe(true);
  });

  it("narrows with AND, not OR", () => {
    expect(matchesTags(["design", "risk"], ["design", "risk"])).toBe(true);
    expect(matchesTags(["design"], ["design", "risk"])).toBe(false);
  });

  it("ignores case on either side", () => {
    expect(matchesTags(["Design"], ["design"])).toBe(true);
  });
});
