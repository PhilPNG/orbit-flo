import { describe, expect, it, vi } from "vitest";
import { listWorkspaceProfiles, updateDisplayName } from "./profiles.queries";

function createQueryClient(result: { data: unknown; error: unknown } = { data: [], error: null }) {
  const query = {
    ...result,
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    update: vi.fn(() => query),
    single: vi.fn(() => result),
  };

  return { client: { from: vi.fn(() => query) }, query };
}

describe("listWorkspaceProfiles", () => {
  it("reads members of one workspace and keys them by user id", async () => {
    const { client, query } = createQueryClient({
      data: [
        { user_id: "user-1", profiles: { id: "user-1", display_name: "Ada Lovelace" } },
        { user_id: "user-2", profiles: { id: "user-2", display_name: "Grace Hopper" } },
      ],
      error: null,
    });

    const result = await listWorkspaceProfiles(client as never, "workspace-1");

    expect(client.from).toHaveBeenCalledWith("workspace_members");
    expect(query.eq).toHaveBeenCalledWith("workspace_id", "workspace-1");
    expect(result.get("user-1")).toEqual({ id: "user-1", displayName: "Ada Lovelace" });
    expect(result.get("user-2")?.displayName).toBe("Grace Hopper");
  });

  it("returns an empty map rather than throwing when there are no rows", async () => {
    const { client } = createQueryClient({ data: null, error: null });

    expect((await listWorkspaceProfiles(client as never, "workspace-1")).size).toBe(0);
  });

  it("skips members whose profile did not come back", async () => {
    const { client } = createQueryClient({
      data: [{ user_id: "user-1", profiles: null }],
      error: null,
    });

    expect((await listWorkspaceProfiles(client as never, "workspace-1")).size).toBe(0);
  });
});

describe("updateDisplayName", () => {
  it("trims the name before writing", async () => {
    const { client, query } = createQueryClient({
      data: { id: "user-1", display_name: "Ada" },
      error: null,
    });

    const result = await updateDisplayName(client as never, {
      userId: "user-1",
      displayName: "  Ada  ",
    });

    expect(query.update).toHaveBeenCalledWith({ display_name: "Ada" });
    expect(query.eq).toHaveBeenCalledWith("id", "user-1");
    expect(result).toEqual({ id: "user-1", displayName: "Ada" });
  });

  it("refuses a blank name without writing", async () => {
    const { client, query } = createQueryClient({ data: null, error: null });

    await expect(
      updateDisplayName(client as never, { userId: "user-1", displayName: "   " }),
    ).rejects.toThrow("Names cannot be empty.");

    expect(query.update).not.toHaveBeenCalled();
  });
});
