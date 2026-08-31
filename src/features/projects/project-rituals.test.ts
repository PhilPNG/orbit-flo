import { describe, expect, it, vi } from "vitest";
import {
  defaultProjectRituals,
  ensureDefaultProjectRituals,
  toggleProjectRitual,
  updateProjectRitualsTitle,
} from "./project-rituals.queries";

type Result = { data: unknown; error: unknown };

function builder(result: Result) {
  const chain: Record<string, unknown> = {};
  const handler = vi.fn((..._args: unknown[]) => chain);
  for (const method of ["select", "insert", "update", "delete", "eq", "order", "single"]) {
    chain[method] = handler;
  }
  (chain as { then: unknown }).then = (resolve: (value: Result) => void) => resolve(result);
  return { chain, handler };
}

function clientWith(results: Result[]) {
  let call = 0;
  const builders = results.map((result) => builder(result));
  const from = vi.fn(() => builders[Math.min(call++, builders.length - 1)].chain);
  return { client: { from } as never, from, builders };
}

describe("ensureDefaultProjectRituals", () => {
  it("returns existing rituals without inserting", async () => {
    const existing = [{ id: "r1" }];
    const { client, from } = clientWith([{ data: existing, error: null }]);

    const result = await ensureDefaultProjectRituals(client, {
      workspaceId: "ws",
      projectId: "p",
      userId: "u",
    });

    expect(result).toBe(existing);
    expect(from).toHaveBeenCalledTimes(1);
  });

  it("seeds the four defaults when empty", async () => {
    const { client, from, builders } = clientWith([
      { data: [], error: null },
      { data: defaultProjectRituals.map((title, index) => ({ id: `r${index}`, title })), error: null },
    ]);

    const result = await ensureDefaultProjectRituals(client, {
      workspaceId: "ws",
      projectId: "p",
      userId: "u",
    });

    expect(from).toHaveBeenCalledTimes(2);
    expect(result).toHaveLength(4);
    const insertArg = builders[1].handler.mock.calls[0]?.[0] as Array<Record<string, unknown>>;
    expect(insertArg.map((row) => row.title)).toEqual([
      "Weekly review ritual",
      "Backlog cleanup ritual",
      "Milestone check ritual",
      "Release prep ritual",
    ]);
    expect(insertArg.map((row) => row.sort_order)).toEqual([0, 1, 2, 3]);
  });
});

describe("toggleProjectRitual", () => {
  it("updates is_done", async () => {
    const { client, builders } = clientWith([{ data: { id: "r1" }, error: null }]);

    await toggleProjectRitual(client, { id: "r1", workspaceId: "ws", isDone: true });

    const updateArg = builders[0].handler.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(updateArg.is_done).toBe(true);
  });
});

describe("updateProjectRitualsTitle", () => {
  it("updates the projects row", async () => {
    const { client, from, builders } = clientWith([{ data: null, error: null }]);

    await updateProjectRitualsTitle(client, { workspaceId: "ws", projectId: "p", ritualsTitle: "Cadence" });

    expect(from).toHaveBeenCalledWith("projects");
    const updateArg = builders[0].handler.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(updateArg.rituals_title).toBe("Cadence");
  });
});
