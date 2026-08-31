import { describe, expect, it } from "vitest";
import { findMentionTrigger, formatMention } from "./mention";

describe("formatMention", () => {
  it("stores the id, so renames never break the mention", () => {
    expect(formatMention("abc", "Ada Lovelace")).toBe("[@Ada Lovelace](orbit:user/abc)");
  });

  it("neutralises brackets that would end the link early", () => {
    expect(formatMention("abc", "Ada [L]")).toBe("[@Ada (L)](orbit:user/abc)");
  });
});

describe("findMentionTrigger", () => {
  it("triggers at the start of the body", () => {
    expect(findMentionTrigger("@ad", 3)).toEqual({ start: 0, query: "ad" });
  });

  it("triggers after whitespace", () => {
    expect(findMentionTrigger("hi @ad", 6)).toEqual({ start: 3, query: "ad" });
  });

  it("does NOT trigger inside an email address", () => {
    // Without the word-boundary rule, typing any address opens the picker.
    expect(findMentionTrigger("mail ada@example.com", 20)).toBeNull();
  });

  it("abandons the trigger at a newline", () => {
    expect(findMentionTrigger("@ada\nmore", 9)).toBeNull();
  });
});
