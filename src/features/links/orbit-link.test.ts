import { describe, expect, it } from "vitest";
import { extractOrbitLinks, formatOrbitLink } from "./orbit-link";

const taskId = "8f3c1d2e-1111-4222-8333-444455556666";
const noteId = "aaaaaaaa-1111-4222-8333-444455556666";

describe("formatOrbitLink", () => {
  it("writes ordinary markdown with an app URI", () => {
    expect(formatOrbitLink("task", taskId, "Polish the release path")).toBe(
      `[Polish the release path](orbit:task/${taskId})`,
    );
  });

  it("keeps a label with brackets from breaking the link", () => {
    expect(formatOrbitLink("note", noteId, "Decision [final]")).toBe(
      `[Decision (final)](orbit:note/${noteId})`,
    );
  });
});

describe("extractOrbitLinks", () => {
  it("finds nothing in a body without links", () => {
    expect(extractOrbitLinks("Just some prose about shipping.")).toEqual([]);
  });

  it("reads kind, id and label", () => {
    const body = `Blocked by [Polish the release path](orbit:task/${taskId}).`;

    expect(extractOrbitLinks(body)).toEqual([
      { kind: "task", id: taskId, label: "Polish the release path" },
    ]);
  });

  it("keeps document order across several links", () => {
    const body = `[A](orbit:note/${noteId}) then [B](orbit:task/${taskId})`;

    expect(extractOrbitLinks(body).map((link) => link.kind)).toEqual(["note", "task"]);
  });

  it("reports one link per target however often it appears", () => {
    const body = `[A](orbit:task/${taskId}) and again [A again](orbit:task/${taskId})`;

    expect(extractOrbitLinks(body)).toHaveLength(1);
  });

  it("ignores ordinary markdown links", () => {
    expect(extractOrbitLinks("[docs](https://example.com/orbit:task/x)")).toEqual([]);
  });

  it("ignores an unknown kind", () => {
    expect(extractOrbitLinks(`[X](orbit:goal/${taskId})`)).toEqual([]);
  });

  it("extracts a milestone link", () => {
    const links = extractOrbitLinks(
      "ships at [Beta](orbit:milestone/11111111-1111-1111-1111-111111111111)",
    );
    expect(links).toEqual([
      { kind: "milestone", id: "11111111-1111-1111-1111-111111111111", label: "Beta" },
    ]);
  });

  it("ignores a malformed id", () => {
    expect(extractOrbitLinks("[X](orbit:task/not-a-uuid)")).toEqual([]);
  });
});
