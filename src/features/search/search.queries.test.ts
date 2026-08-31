import { describe, expect, it, vi } from "vitest";
import {
  escapeSearchTerm,
  rankSearchResults,
  searchWorkspace,
  type SearchResult,
} from "./search.queries";

function result(overrides: Partial<SearchResult> = {}): SearchResult {
  return {
    id: "a",
    type: "task",
    title: "Task",
    subtitle: null,
    to: "/projects/p1?task=a",
    matchedTitle: false,
    updatedAt: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

function createSearchClient() {
  const calls: Array<{ table: string; or: string; limit: number }> = [];

  const client = {
    from: vi.fn((table: string) => {
      const builder = {
        select: vi.fn((..._args: unknown[]) => builder),
        eq: vi.fn((..._args: unknown[]) => builder),
        order: vi.fn((..._args: unknown[]) => builder),
        or: vi.fn((filter: string) => {
          calls.push({ table, or: filter, limit: 0 });
          return builder;
        }),
        limit: vi.fn((count: number) => {
          calls[calls.length - 1].limit = count;
          return Promise.resolve({ data: [], error: null });
        }),
      };

      return builder;
    }),
  };

  return { client, calls };
}

describe("escapeSearchTerm", () => {
  it("strips characters that break the PostgREST or() filter", () => {
    expect(escapeSearchTerm("a,b(c)d%e\\f")).toBe("abcdef");
  });

  it("leaves ordinary terms untouched", () => {
    expect(escapeSearchTerm("launch checklist")).toBe("launch checklist");
  });

  it("trims surrounding whitespace", () => {
    expect(escapeSearchTerm("  orbit  ")).toBe("orbit");
  });
});

describe("rankSearchResults", () => {
  it("puts title matches above body matches", () => {
    const ranked = rankSearchResults([
      result({ id: "body", matchedTitle: false }),
      result({ id: "title", matchedTitle: true }),
    ]);

    expect(ranked.map((entry) => entry.id)).toEqual(["title", "body"]);
  });

  it("breaks ties by most recently updated", () => {
    const ranked = rankSearchResults([
      result({ id: "older", matchedTitle: true, updatedAt: "2026-08-01T00:00:00.000Z" }),
      result({ id: "newer", matchedTitle: true, updatedAt: "2026-08-07T00:00:00.000Z" }),
    ]);

    expect(ranked.map((entry) => entry.id)).toEqual(["newer", "older"]);
  });

  it("does not mutate the input array", () => {
    const input = [result({ id: "one" }), result({ id: "two", matchedTitle: true })];
    rankSearchResults(input);

    expect(input.map((entry) => entry.id)).toEqual(["one", "two"]);
  });
});

describe("searchWorkspace", () => {
  it("queries all four types, scoped and limited", async () => {
    const { client, calls } = createSearchClient();

    await searchWorkspace(client as never, "workspace-1", "orbit");

    expect(calls.map((entry) => entry.table).sort()).toEqual([
      "milestones",
      "notes",
      "projects",
      "work_items",
    ]);
    expect(calls.every((entry) => entry.limit === 10)).toBe(true);
  });

  it("builds an or() filter over the title and body of each type", async () => {
    const { client, calls } = createSearchClient();

    await searchWorkspace(client as never, "workspace-1", "orbit");

    const byTable = Object.fromEntries(calls.map((entry) => [entry.table, entry.or]));
    expect(byTable.work_items).toBe("title.ilike.%orbit%,description.ilike.%orbit%");
    expect(byTable.notes).toBe("title.ilike.%orbit%,body.ilike.%orbit%");
    expect(byTable.projects).toBe("name.ilike.%orbit%,description.ilike.%orbit%");
    expect(byTable.milestones).toBe("title.ilike.%orbit%,description.ilike.%orbit%");
  });

  it("returns a milestone row mapped to a search result", async () => {
    const client = {
      from: vi.fn((table: string) => {
        const builder: Record<string, unknown> = {
          select: vi.fn(() => builder),
          eq: vi.fn(() => builder),
          or: vi.fn(() => builder),
          order: vi.fn(() => builder),
          limit: vi.fn(() =>
            table === "milestones"
              ? Promise.resolve({
                  data: [
                    {
                      id: "m1",
                      title: "Launch beta",
                      description: null,
                      project_id: "p1",
                      updated_at: "2026-08-01T00:00:00.000Z",
                    },
                  ],
                  error: null,
                })
              : Promise.resolve({ data: [], error: null }),
          ),
        };
        return builder;
      }),
    };

    const results = await searchWorkspace(client as never, "workspace-1", "launch");

    expect(results).toContainEqual(
      expect.objectContaining({ type: "milestone", title: "Launch beta", to: "/milestones/m1" }),
    );
  });

  it("escapes the term before building the filter", async () => {
    const { client, calls } = createSearchClient();

    await searchWorkspace(client as never, "workspace-1", "a,b(c)");

    expect(calls[0].or).toContain("%abc%");
    expect(calls[0].or).not.toContain(",b(");
  });

  it("returns nothing for a term shorter than the minimum", async () => {
    const { client, calls } = createSearchClient();

    const results = await searchWorkspace(client as never, "workspace-1", "a");

    expect(results).toEqual([]);
    expect(calls).toHaveLength(0);
  });
});

/** Records which tables were queried and with what filters. */
function createOperatorClient() {
  const tables: string[] = [];
  const filters: Array<{ table: string; method: string; args: unknown[] }> = [];

  const client = {
    from: vi.fn((table: string) => {
      tables.push(table);

      const builder: Record<string, unknown> = {};
      for (const method of ["select", "eq", "or", "contains", "in", "order"]) {
        builder[method] = vi.fn((...args: unknown[]) => {
          filters.push({ table, method, args });
          return builder;
        });
      }
      builder.limit = vi.fn(() => Promise.resolve({ data: [], error: null }));

      return builder;
    }),
  };

  return { client, tables, filters };
}

describe("searchWorkspace operators", () => {
  it("queries only the requested kind", async () => {
    const { client, tables } = createOperatorClient();

    await searchWorkspace(client as never, "workspace-1", "is:note payments");

    expect(tables).toEqual(["notes"]);
  });

  it("pushes tag: into the notes query rather than filtering afterwards", async () => {
    const { client, filters } = createOperatorClient();

    await searchWorkspace(client as never, "workspace-1", "tag:design");

    expect(filters).toContainEqual({ table: "notes", method: "contains", args: ["tags", ["design"]] });
  });

  it("pushes type: into the notes query", async () => {
    const { client, filters } = createOperatorClient();

    await searchWorkspace(client as never, "workspace-1", "type:decision");

    expect(filters).toContainEqual({ table: "notes", method: "in", args: ["note_type", ["decision"]] });
  });

  it("treats a tag search as notes only, since tasks carry no tags", async () => {
    const { client, tables } = createOperatorClient();

    await searchWorkspace(client as never, "workspace-1", "tag:design");

    expect(tables).toEqual(["notes"]);
  });

  it("runs an operator-only search without a text filter", async () => {
    const { client, filters } = createOperatorClient();

    await searchWorkspace(client as never, "workspace-1", "tag:design");

    expect(filters.some((entry) => entry.method === "or")).toBe(false);
  });

  it("still applies the text filter alongside an operator", async () => {
    const { client, filters } = createOperatorClient();

    await searchWorkspace(client as never, "workspace-1", "tag:design payments");

    expect(filters.some((entry) => entry.method === "or")).toBe(true);
  });

  it("does nothing at all when there is neither text nor an operator", async () => {
    const { client, tables } = createOperatorClient();

    await searchWorkspace(client as never, "workspace-1", "a");

    expect(tables).toEqual([]);
  });
});
