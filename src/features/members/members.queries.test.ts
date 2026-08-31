import { describe, expect, it, vi } from "vitest";
import {
  deleteWorkspace,
  leaveWorkspace,
  listMembers,
  removeMember,
  setMemberRole,
} from "./members.queries";

function createQueryClient(result: { data: unknown; error: unknown } = { data: [], error: null }) {
  const query = {
    ...result,
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    order: vi.fn(() => query),
    update: vi.fn(() => query),
    delete: vi.fn(() => query),
  };

  return { client: { from: vi.fn(() => query) }, query };
}

describe("listMembers", () => {
  it("returns each member with their display name", async () => {
    const { client, query } = createQueryClient({
      data: [
        { id: "m1", user_id: "user-1", role: "owner", profiles: { display_name: "Ada" } },
        { id: "m2", user_id: "user-2", role: "member", profiles: { display_name: "Grace" } },
      ],
      error: null,
    });

    const members = await listMembers(client as never, "workspace-1");

    expect(client.from).toHaveBeenCalledWith("workspace_members");
    expect(query.eq).toHaveBeenCalledWith("workspace_id", "workspace-1");
    expect(members).toEqual([
      { id: "m1", userId: "user-1", role: "owner", displayName: "Ada" },
      { id: "m2", userId: "user-2", role: "member", displayName: "Grace" },
    ]);
  });

  it("still lists a member whose profile is not readable", async () => {
    const { client } = createQueryClient({
      data: [{ id: "m1", user_id: "user-1", role: "member", profiles: null }],
      error: null,
    });

    expect((await listMembers(client as never, "workspace-1"))[0].displayName).toBe(
      "Unknown member",
    );
  });
});

describe("setMemberRole", () => {
  it("updates the membership row", async () => {
    const { client, query } = createQueryClient({ data: null, error: null });

    await setMemberRole(client as never, { id: "m2", role: "admin" });

    expect(query.update).toHaveBeenCalledWith({ role: "admin" });
    expect(query.eq).toHaveBeenCalledWith("id", "m2");
  });
});

describe("removeMember", () => {
  it("deletes by membership id", async () => {
    const { client, query } = createQueryClient({ data: null, error: null });

    await removeMember(client as never, { id: "m2" });

    expect(query.delete).toHaveBeenCalled();
    expect(query.eq).toHaveBeenCalledWith("id", "m2");
  });
});

describe("leaveWorkspace", () => {
  it("removes only your own row", async () => {
    const { client, query } = createQueryClient({ data: null, error: null });

    await leaveWorkspace(client as never, { workspaceId: "workspace-1", userId: "user-2" });

    expect(query.eq).toHaveBeenCalledWith("workspace_id", "workspace-1");
    expect(query.eq).toHaveBeenCalledWith("user_id", "user-2");
  });
});

describe("deleteWorkspace", () => {
  it("requires the name typed exactly", async () => {
    const { client, query } = createQueryClient({ data: null, error: null });

    await expect(
      deleteWorkspace(client as never, { id: "workspace-1", name: "Acme", confirmName: "acme" }),
    ).rejects.toThrow("Type the workspace name exactly to confirm.");

    expect(query.delete).not.toHaveBeenCalled();
  });

  it("deletes once the name matches", async () => {
    const { client, query } = createQueryClient({ data: null, error: null });

    await deleteWorkspace(client as never, {
      id: "workspace-1",
      name: "Acme",
      confirmName: " Acme ",
    });

    expect(query.delete).toHaveBeenCalled();
    expect(query.eq).toHaveBeenCalledWith("id", "workspace-1");
  });
});
