import { describe, expect, it } from "vitest";
import { buildSignalSentence } from "./signal-sentence";

describe("buildSignalSentence", () => {
  it("names the actor and the task for an assignment", () => {
    expect(
      buildSignalSentence({ kind: "assigned", actorName: "Ada", targetTitle: "Ship the graph" }),
    ).toBe("Ada assigned you Ship the graph");
  });

  it("falls back to someone when the actor is gone", () => {
    // actor_id is `on delete set null`, so a departed colleague leaves null.
    expect(
      buildSignalSentence({ kind: "assigned", actorName: null, targetTitle: "Ship the graph" }),
    ).toBe("Someone assigned you Ship the graph");
  });

  it("names a deleted target rather than rendering an empty gap", () => {
    expect(
      buildSignalSentence({ kind: "commented", actorName: "Ada", targetTitle: null }),
    ).toBe("Ada commented on a deleted task");
  });

  it("uses the neutral noun for a deleted mention target, since a mention can live in a note or a comment", () => {
    expect(
      buildSignalSentence({ kind: "mentioned", actorName: "Ada", targetTitle: null }),
    ).toBe("Ada mentioned you in a deleted item");
  });

  it("covers every kind", () => {
    // removed_from_workspace is dead as a producer of real rows (see
    // 202608180005_signal_guards.sql), but the enum value still exists, so the
    // switch in buildSignalSentence must stay exhaustive over it.
    const kinds = [
      "assigned", "unassigned", "commented", "mentioned",
      "invitation_accepted", "role_changed", "removed_from_workspace",
    ] as const;

    for (const kind of kinds) {
      const sentence = buildSignalSentence({ kind, actorName: "Ada", targetTitle: "Thing" });
      expect(sentence.length).toBeGreaterThan(0);
      expect(sentence).not.toContain("undefined");
    }
  });
});
