import { describe, expect, it } from "vitest";
import { toPlainText } from "./plain-text";

describe("toPlainText", () => {
  it("shows a link's label and never its uuid", () => {
    // The case this function exists for. A three-line clamp was being eaten
    // by 36 characters of uuid.
    const preview = toPlainText(
      "Ship [the graph](orbit:task/8f2c1e04-1111-2222-3333-444455556666) first",
    );

    expect(preview).toBe("Ship the graph first");
    expect(preview).not.toContain("orbit:");
    expect(preview).not.toContain("8f2c1e04");
  });

  it("keeps a mention reading as a mention", () => {
    // The @ is part of the stored label, so it survives the strip.
    expect(toPlainText("ask [@Ada Lovelace](orbit:user/11111111-1111-1111-1111-111111111111)"))
      .toBe("ask @Ada Lovelace");
  });

  it("strips an ordinary link to its text", () => {
    expect(toPlainText("see [the docs](https://example.com)")).toBe("see the docs");
  });

  it("strips emphasis and code spans", () => {
    expect(toPlainText("**bold** and *italic* and _under_ and `code`"))
      .toBe("bold and italic and under and code");
  });

  it("strips headings, list markers and quotes", () => {
    expect(toPlainText("# Heading")).toBe("Heading");
    expect(toPlainText("- item")).toBe("item");
    expect(toPlainText("* item")).toBe("item");
    expect(toPlainText("1. item")).toBe("item");
    expect(toPlainText("> quote")).toBe("quote");
  });

  it("collapses newlines, because every caller is a single clamped block", () => {
    expect(toPlainText("first\nsecond\n\nthird")).toBe("first second third");
  });

  it("returns empty for empty input", () => {
    expect(toPlainText("")).toBe("");
  });

  it("leaves ordinary prose untouched", () => {
    // The common case: most descriptions contain no markup at all and must
    // survive byte-for-byte.
    expect(toPlainText("Just a normal sentence, with punctuation."))
      .toBe("Just a normal sentence, with punctuation.");
  });

  it("strips an image without stranding its bang", () => {
    // The image rule must run BEFORE the link rule: an image is a link with a
    // leading !, so link-first would consume the brackets and leave a bare !.
    // Swapping those two lines passes every other test in this file.
    expect(toPlainText("see ![a diagram](https://example.com/d.png) here"))
      .toBe("see a diagram here");
  });

  it("leaves arithmetic and dimensions alone", () => {
    expect(toPlainText("resize to 1920 * 1080")).toBe("resize to 1920 * 1080");
    expect(toPlainText("2 * 3 * 4")).toBe("2 * 3 * 4");
  });

  it("leaves snake_case and file names alone", () => {
    expect(toPlainText("my_file_name.txt")).toBe("my_file_name.txt");
    expect(toPlainText("call snake_case_helper first")).toBe("call snake_case_helper first");
  });

  it("still strips emphasis a human actually wrote", () => {
    expect(toPlainText("**bold** and *italic* and _under_"))
      .toBe("bold and italic and under");
  });

  it("leaves a >= comparison alone instead of eating the caret", () => {
    expect(toPlainText(">= 5 items")).toBe(">= 5 items");
  });

  it("still strips a real blockquote caret", () => {
    expect(toPlainText("> quoted")).toBe("quoted");
  });

  describe("preserveLineBreaks", () => {
    it("collapses blank-line runs to spaces by default", () => {
      expect(toPlainText("a\n\n\nb")).toBe("a b");
    });

    it("preserves single newlines instead of joining with spaces when requested", () => {
      expect(toPlainText("a\n\n\nb", { preserveLineBreaks: true })).toBe("a\nb");
    });

    it("still strips markup when preserving line breaks", () => {
      expect(toPlainText("**bold**\n\n[label](orbit:task/1)", { preserveLineBreaks: true }))
        .toBe("bold\nlabel");
    });
  });
});
