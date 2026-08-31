import { describe, expect, it } from "vitest";
import { hasSearchCriteria, parseSearchQuery } from "./search-query";

describe("parseSearchQuery", () => {
  it("treats a plain query as free text", () => {
    expect(parseSearchQuery("release path")).toEqual({
      text: "release path",
      kinds: [],
      tags: [],
      noteTypes: [],
    });
  });

  it("pulls out is: as an entity kind", () => {
    expect(parseSearchQuery("is:note payments")).toMatchObject({
      text: "payments",
      kinds: ["note"],
    });
  });

  it("collects several kinds", () => {
    expect(parseSearchQuery("is:task is:project").kinds).toEqual(["task", "project"]);
  });

  it("leaves an unrecognised kind in the text so the typo is visible", () => {
    expect(parseSearchQuery("is:sprint x")).toMatchObject({
      text: "is:sprint x",
      kinds: [],
    });
  });

  it("accepts is:milestone", () => {
    expect(parseSearchQuery("is:milestone beta").kinds).toContain("milestone");
  });

  it("pulls out tag:, lowercased to match how tags are stored", () => {
    expect(parseSearchQuery("tag:Design").tags).toEqual(["design"]);
  });

  it("pulls out type: as a note type", () => {
    expect(parseSearchQuery("type:decision").noteTypes).toEqual(["decision"]);
  });

  it("leaves an unrecognised note type in the text for the same reason", () => {
    expect(parseSearchQuery("type:invented")).toMatchObject({
      text: "type:invented",
      noteTypes: [],
    });
  });

  it("keeps the rest of the words as text", () => {
    expect(parseSearchQuery("tag:ops deploy the thing type:risk")).toMatchObject({
      text: "deploy the thing",
      tags: ["ops"],
      noteTypes: ["risk"],
    });
  });

  it("allows a query that is only operators", () => {
    expect(parseSearchQuery("tag:design")).toEqual({
      text: "",
      kinds: [],
      tags: ["design"],
      noteTypes: [],
    });
  });

  it("leaves a bare operator with no value as text", () => {
    expect(parseSearchQuery("tag:")).toMatchObject({ text: "tag:", tags: [] });
  });

  it("collapses repeated whitespace in the remaining text", () => {
    expect(parseSearchQuery("  find   this  ").text).toBe("find this");
  });
});

describe("hasSearchCriteria", () => {
  it("is false for nothing", () => {
    expect(hasSearchCriteria(parseSearchQuery(""))).toBe(false);
  });

  it("is false for text shorter than the minimum", () => {
    expect(hasSearchCriteria(parseSearchQuery("a"))).toBe(false);
  });

  it("is true for long enough text", () => {
    expect(hasSearchCriteria(parseSearchQuery("ab"))).toBe(true);
  });

  it("is true for an operator alone, with no text at all", () => {
    expect(hasSearchCriteria(parseSearchQuery("tag:design"))).toBe(true);
  });
});
