import { describe, expect, it, vi } from "vitest";
import { linkMentionInBody, listUnlinkedMentions } from "./unlinked-mentions.queries";

const taskId = "8f3c1d2e-1111-4222-8333-444455556666";

function createClient(result: { data: unknown; error: unknown } = { data: [], error: null }) {
  const query = {
    ...result,
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    update: vi.fn(() => query),
    single: vi.fn(() => result),
    maybeSingle: vi.fn(() => result),
  };

  return { client: { from: vi.fn(() => query), rpc: vi.fn(() => result) }, query };
}

describe("listUnlinkedMentions", () => {
  it("asks the function for the target", async () => {
    const { client } = createClient({ data: [], error: null });

    await listUnlinkedMentions(client as never, { kind: "task", id: taskId });

    expect(client.rpc).toHaveBeenCalledWith("find_unlinked_mentions", {
      target_kind: "task",
      target_id: taskId,
    });
  });

  it("maps rows to the shape the panel renders", async () => {
    const { client } = createClient({
      data: [{ note_id: "note-1", title: "Why we shipped small", note_type: "decision" }],
      error: null,
    });

    expect(await listUnlinkedMentions(client as never, { kind: "task", id: taskId })).toEqual([
      { id: "note-1", title: "Why we shipped small", noteType: "decision" },
    ]);
  });

  it("returns an empty list rather than null", async () => {
    const { client } = createClient({ data: null, error: null });

    expect(await listUnlinkedMentions(client as never, { kind: "task", id: taskId })).toEqual([]);
  });
});

describe("linkMentionInBody", () => {
  it("turns the first bare occurrence into a link", () => {
    const body = "We should finish Polish the release path before shipping.";

    expect(linkMentionInBody(body, "Polish the release path", "task", taskId)).toBe(
      `We should finish [Polish the release path](orbit:task/${taskId}) before shipping.`,
    );
  });

  it("matches case-insensitively but keeps what the author wrote", () => {
    const body = "polish the release path is next";

    expect(linkMentionInBody(body, "Polish the release path", "task", taskId)).toBe(
      `[polish the release path](orbit:task/${taskId}) is next`,
    );
  });

  it("only links the first occurrence, leaving later prose alone", () => {
    const body = "Ship it. Ship it twice.";
    const linked = linkMentionInBody(body, "Ship it", "task", taskId);

    expect(linked).toBe(`[Ship it](orbit:task/${taskId}). Ship it twice.`);
  });

  it("leaves an occurrence that is already inside a link alone", () => {
    const body = `already [Ship it](orbit:task/${taskId}) here`;

    expect(linkMentionInBody(body, "Ship it", "task", taskId)).toBe(body);
  });

  it("returns the body unchanged when the title is not present", () => {
    const body = "nothing relevant here";

    expect(linkMentionInBody(body, "Ship it", "task", taskId)).toBe(body);
  });

  it("treats a title with regex characters literally", () => {
    const body = "the 50% faster work";

    expect(linkMentionInBody(body, "50% faster", "task", taskId)).toBe(
      `the [50% faster](orbit:task/${taskId}) work`,
    );
  });
});
