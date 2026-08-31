import { beforeEach, describe, expect, it, vi } from "vitest";
import { ensurePersonalWorkspace } from "./onboarding";

const rpc = vi.fn();
const from = vi.fn(() => {
  throw new Error("Membership preflight should not run.");
});

describe("ensurePersonalWorkspace", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses the onboarding rpc with an email-derived workspace name", async () => {
    rpc.mockResolvedValueOnce({ data: "workspace-1", error: null });

    const result = await ensurePersonalWorkspace(
      { from, rpc } as never,
      { id: "user-1", email: "person@example.com" },
    );

    expect(from).not.toHaveBeenCalled();
    expect(rpc).toHaveBeenCalledWith("create_personal_workspace", {
      workspace_name: "person@example.com's Workspace",
    });
    expect(result).toEqual({ id: "workspace-1" });
  });

  it("uses a fallback workspace name when the user has no email", async () => {
    rpc.mockResolvedValueOnce({ data: "workspace-2", error: null });

    const result = await ensurePersonalWorkspace(
      { rpc } as never,
      { id: "user-1" },
    );

    expect(rpc).toHaveBeenCalledWith("create_personal_workspace", {
      workspace_name: "Personal Workspace",
    });
    expect(result).toEqual({ id: "workspace-2" });
  });

  it("throws when the onboarding rpc fails", async () => {
    const rpcError = new Error("rpc failed");
    rpc.mockResolvedValueOnce({ data: null, error: rpcError });

    await expect(
      ensurePersonalWorkspace(
        { rpc } as never,
        { id: "user-1", email: "person@example.com" },
      ),
    ).rejects.toThrow(rpcError);
  });

  it("throws when the onboarding rpc returns no workspace id", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: null });

    await expect(
      ensurePersonalWorkspace(
        { rpc } as never,
        { id: "user-1", email: "person@example.com" },
      ),
    ).rejects.toThrow("Workspace RPC did not return an id.");
  });
});
