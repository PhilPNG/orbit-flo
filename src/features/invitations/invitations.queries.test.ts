import { describe, expect, it, vi } from "vitest";
import {
  acceptInvitation,
  createInvitation,
  invitationLink,
  listInvitations,
  previewInvitation,
  revokeInvitation,
} from "./invitations.queries";

function createQueryClient(result: { data: unknown; error: unknown } = { data: [], error: null }) {
  const query = {
    ...result,
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    is: vi.fn(() => query),
    order: vi.fn(() => query),
    delete: vi.fn(() => query),
    single: vi.fn(() => result),
    maybeSingle: vi.fn(() => result),
  };

  return { client: { from: vi.fn(() => query), rpc: vi.fn(() => result) }, query };
}

describe("listInvitations", () => {
  it("reads only pending invitations for the workspace", async () => {
    const { client, query } = createQueryClient({ data: [], error: null });

    await listInvitations(client as never, "workspace-1");

    expect(client.from).toHaveBeenCalledWith("workspace_invitations");
    expect(query.eq).toHaveBeenCalledWith("workspace_id", "workspace-1");
    expect(query.is).toHaveBeenCalledWith("accepted_at", null);
  });

  it("returns an empty list rather than null", async () => {
    const { client } = createQueryClient({ data: null, error: null });

    expect(await listInvitations(client as never, "workspace-1")).toEqual([]);
  });
});

describe("createInvitation", () => {
  it("normalizes the email and calls the RPC", async () => {
    const { client } = createQueryClient({ data: { id: "invite-1" }, error: null });

    await createInvitation(client as never, {
      workspaceId: "workspace-1",
      email: "  Ada@Example.COM ",
      role: "member",
    });

    expect(client.rpc).toHaveBeenCalledWith("create_workspace_invitation", {
      target_workspace_id: "workspace-1",
      target_email: "ada@example.com",
      target_role: "member",
    });
  });

  it("rejects an obvious non-email without a round trip", async () => {
    const { client } = createQueryClient({ data: null, error: null });

    await expect(
      createInvitation(client as never, {
        workspaceId: "workspace-1",
        email: "not-an-email",
        role: "member",
      }),
    ).rejects.toThrow("That does not look like an email address.");

    expect(client.rpc).not.toHaveBeenCalled();
  });
});

describe("revokeInvitation", () => {
  it("deletes by id", async () => {
    const { client, query } = createQueryClient({ data: null, error: null });

    await revokeInvitation(client as never, { id: "invite-1" });

    expect(query.delete).toHaveBeenCalled();
    expect(query.eq).toHaveBeenCalledWith("id", "invite-1");
  });
});

describe("previewInvitation", () => {
  it("returns the first row the function yields", async () => {
    const { client } = createQueryClient({
      data: [
        {
          workspace_name: "Acme",
          invited_by_name: "Ada",
          email: "grace@example.com",
          is_expired: false,
          is_accepted: false,
        },
      ],
      error: null,
    });

    const preview = await previewInvitation(client as never, "token-1");

    expect(client.rpc).toHaveBeenCalledWith("preview_workspace_invitation", {
      invitation_token: "token-1",
    });
    expect(preview).toEqual({
      workspaceName: "Acme",
      invitedByName: "Ada",
      email: "grace@example.com",
      isExpired: false,
      isAccepted: false,
    });
  });

  it("returns null when the token matches nothing", async () => {
    const { client } = createQueryClient({ data: [], error: null });

    expect(await previewInvitation(client as never, "token-1")).toBeNull();
  });
});

describe("acceptInvitation", () => {
  it("returns the workspace it joined", async () => {
    const { client } = createQueryClient({ data: "workspace-9", error: null });

    expect(await acceptInvitation(client as never, "token-1")).toBe("workspace-9");
    expect(client.rpc).toHaveBeenCalledWith("accept_workspace_invitation", {
      invitation_token: "token-1",
    });
  });
});

describe("invitationLink", () => {
  it("builds an absolute link on the current origin", () => {
    expect(invitationLink("token-1")).toBe("http://localhost:3000/invite/token-1");
  });
});
