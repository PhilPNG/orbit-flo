import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MemberAvatar, avatarToneFor, initialsFor } from "./member-avatar";

describe("initialsFor", () => {
  it("takes the first letter of the first two words", () => {
    expect(initialsFor("Ada Lovelace")).toBe("AL");
  });

  it("takes two characters from a single word", () => {
    expect(initialsFor("orbit")).toBe("OR");
  });

  it("ignores surrounding and repeated whitespace", () => {
    expect(initialsFor("  Grace   Hopper  ")).toBe("GH");
  });

  it("copes with a single character", () => {
    expect(initialsFor("q")).toBe("Q");
  });

  it("falls back rather than rendering an empty circle", () => {
    expect(initialsFor("   ")).toBe("?");
  });
});

describe("avatarToneFor", () => {
  it("is stable for the same id", () => {
    expect(avatarToneFor("user-1")).toBe(avatarToneFor("user-1"));
  });

  it("distinguishes at least some ids", () => {
    const tones = new Set(["a", "b", "c", "d", "e", "f", "g"].map(avatarToneFor));

    expect(tones.size).toBeGreaterThan(1);
  });
});

describe("MemberAvatar", () => {
  it("names the person it represents", () => {
    render(<MemberAvatar displayName="Ada Lovelace" userId="user-1" />);

    expect(screen.getByRole("img", { name: "Ada Lovelace" })).toBeTruthy();
  });

  it("shows their initials", () => {
    render(<MemberAvatar displayName="Ada Lovelace" userId="user-1" />);

    expect(screen.getByText("AL")).toBeTruthy();
  });
});
