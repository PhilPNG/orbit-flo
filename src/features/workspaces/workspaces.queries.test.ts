import { describe, expect, it, vi } from "vitest";
import { createWorkspace, listWorkspaces, renameWorkspace } from "./workspaces.queries";

function createQueryClient(result: { data: unknown; error: unknown } = { data: [], error: null }) {
  const query = {
    ...result,
    select: vi.fn(() => query),
    order: vi.fn(() => query),
    eq: vi.fn(() => query),
    update: vi.fn(() => query),
    single: vi.fn(() => result),
  };

  return { client: { from: vi.fn(() => query), rpc: vi.fn(() => result) }, query };
}

describe("listWorkspaces", () => {
  it("selects id and name oldest first", async () => {
    const { client, query } = createQueryClient({
      data: [{ id: "ws-1", name: "Personal" }],
      error: null,
    });

    const result = await listWorkspaces(client as never);

    expect(client.from).toHaveBeenCalledWith("workspaces");
    expect(query.select).toHaveBeenCalledWith("id, name");
    expect(query.order).toHaveBeenNthCalledWith(1, "created_at", { ascending: true });
    expect(query.order).toHaveBeenNthCalledWith(2, "id", { ascending: true });
    expect(result).toEqual([{ id: "ws-1", name: "Personal" }]);
  });

  it("returns an empty list rather than null", async () => {
    const { client } = createQueryClient({ data: null, error: null });

    expect(await listWorkspaces(client as never)).toEqual([]);
  });
});

describe("createWorkspace", () => {
  it("calls the RPC with a trimmed name", async () => {
    const { client } = createQueryClient({ data: "ws-new", error: null });

    const id = await createWorkspace(client as never, "  Acme Engineering  ");

    expect(client.rpc).toHaveBeenCalledWith("create_workspace", {
      workspace_name: "Acme Engineering",
    });
    expect(id).toBe("ws-new");
  });

  it("refuses a blank name without calling the RPC", async () => {
    const { client } = createQueryClient({ data: null, error: null });

    await expect(createWorkspace(client as never, "   ")).rejects.toThrow(
      "Workspaces need a name.",
    );
    expect(client.rpc).not.toHaveBeenCalled();
  });
});

describe("renameWorkspace", () => {
  it("updates the name scoped by id", async () => {
    const { client, query } = createQueryClient({ data: { id: "ws-1" }, error: null });

    await renameWorkspace(client as never, { id: "ws-1", name: "  Renamed  " });

    expect(query.update).toHaveBeenCalledWith({ name: "Renamed" });
    expect(query.eq).toHaveBeenCalledWith("id", "ws-1");
  });

  it("refuses a blank name", async () => {
    const { client, query } = createQueryClient({ data: null, error: null });

    await expect(renameWorkspace(client as never, { id: "ws-1", name: " " })).rejects.toThrow(
      "Workspaces need a name.",
    );
    expect(query.update).not.toHaveBeenCalled();
  });
});
