import { describe, expect, it, vi } from "vitest";
import {
  defaultBoardColumns,
  deleteBoardColumn,
  ensureDefaultBoardColumns,
  moveWorkItemToColumn,
  reorderBoardColumns,
} from "./board-columns.queries";

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

describe("ensureDefaultBoardColumns", () => {
  it("returns existing columns without inserting", async () => {
    const existing = [{ id: "col-1" }];
    const { client, from } = clientWith([{ data: existing, error: null }]);

    const result = await ensureDefaultBoardColumns(client, {
      workspaceId: "ws",
      projectId: "p",
      userId: "u",
    });

    expect(result).toBe(existing);
    expect(from).toHaveBeenCalledTimes(1);
  });

  it("seeds the six defaults when the project has none", async () => {
    const seeded = defaultBoardColumns.map((column, index) => ({ id: `col-${index}`, title: column.title }));
    const { client, from } = clientWith([
      { data: [], error: null },
      { data: seeded, error: null },
    ]);

    const result = await ensureDefaultBoardColumns(client, {
      workspaceId: "ws",
      projectId: "p",
      userId: "u",
    });

    expect(from).toHaveBeenCalledTimes(2);
    expect(result).toHaveLength(6);
    expect(defaultBoardColumns.map((column) => column.statusCategory)).toEqual([
      "backlog",
      "ready",
      "in_progress",
      "blocked",
      "review",
      "done",
    ]);
  });
});

describe("deleteBoardColumn", () => {
  it("moves items before deleting when a target is given", async () => {
    const { client, from } = clientWith([
      { data: null, error: null },
      { data: null, error: null },
    ]);

    await deleteBoardColumn(client, {
      id: "col-1",
      workspaceId: "ws",
      moveItemsTo: { columnId: "col-2", statusCategory: "done" },
    });

    expect(from).toHaveBeenNthCalledWith(1, "work_items");
    expect(from).toHaveBeenNthCalledWith(2, "board_columns");
  });

  it("deletes directly without a move target", async () => {
    const { client, from } = clientWith([{ data: null, error: null }]);

    await deleteBoardColumn(client, { id: "col-1", workspaceId: "ws" });

    expect(from).toHaveBeenCalledTimes(1);
    expect(from).toHaveBeenCalledWith("board_columns");
  });
});

describe("reorderBoardColumns", () => {
  it("writes sequential sort orders", async () => {
    const { client, from } = clientWith([
      { data: null, error: null },
      { data: null, error: null },
      { data: null, error: null },
    ]);

    await reorderBoardColumns(client, { workspaceId: "ws", projectId: "p", orderedIds: ["b", "a", "c"] });

    expect(from).toHaveBeenCalledTimes(3);
  });
});

describe("moveWorkItemToColumn", () => {
  it("sets column, status, and completion stamp for done", async () => {
    const { client, builders } = clientWith([{ data: { id: "wi" }, error: null }]);

    await moveWorkItemToColumn(client, {
      id: "wi",
      workspaceId: "ws",
      projectId: "p",
      columnId: "col-2",
      statusCategory: "done",
    });

    const updateArg = builders[0].handler.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(updateArg.column_id).toBe("col-2");
    expect(updateArg.status).toBe("done");
    expect(updateArg.completed_at).toBeTruthy();
  });
});
