import { describe, expect, it } from "vitest";
import { findLinkTrigger, findTrigger, replaceTrigger } from "./link-trigger";

describe("findLinkTrigger", () => {
  it("is inactive without the trigger", () => {
    expect(findLinkTrigger("just typing", 11)).toBeNull();
  });

  it("activates on an empty trigger", () => {
    expect(findLinkTrigger("see [[", 6)).toEqual({ start: 4, query: "" });
  });

  it("reports what has been typed since", () => {
    expect(findLinkTrigger("see [[pol", 9)).toEqual({ start: 4, query: "pol" });
  });

  it("ignores a trigger after the caret", () => {
    expect(findLinkTrigger("see [[pol", 3)).toBeNull();
  });

  it("gives up once the run is closed", () => {
    expect(findLinkTrigger("see [[pol]", 10)).toBeNull();
  });

  it("gives up across a newline", () => {
    expect(findLinkTrigger("see [[pol\nmore", 14)).toBeNull();
  });

  it("uses the nearest trigger when there are several", () => {
    expect(findLinkTrigger("[[one]] then [[tw", 17)).toEqual({ start: 13, query: "tw" });
  });
});

describe("replaceTrigger", () => {
  it("swaps the run for the finished link and moves the caret after it", () => {
    const trigger = findLinkTrigger("see [[pol", 9)!;

    expect(replaceTrigger("see [[pol", trigger, 9, "[Polish](orbit:task/x)")).toEqual({
      body: "see [Polish](orbit:task/x)",
      caret: 26,
    });
  });

  it("keeps whatever followed the caret", () => {
    const trigger = findLinkTrigger("see [[pol tail", 9)!;

    expect(replaceTrigger("see [[pol tail", trigger, 9, "[P](orbit:note/x)").body).toBe(
      "see [P](orbit:note/x) tail",
    );
  });
});

describe("findTrigger", () => {
  it("recognises a link trigger", () => {
    expect(findTrigger("see [[gra", 9)).toEqual({ kind: "link", start: 4, query: "gra" });
  });

  it("recognises a mention trigger", () => {
    expect(findTrigger("see @ad", 7)).toEqual({ kind: "mention", start: 4, query: "ad" });
  });

  it("prefers whichever trigger started later", () => {
    // `[[` then `@` inside it: the one the caret is actually inside wins.
    expect(findTrigger("[[note @ad", 10)?.kind).toBe("mention");
  });
});
