import { describe, expect, it } from "vitest";
import { resolveWorkspaceId } from "./workspace-resolver";

const workspaces = [
  { id: "ws-old", name: "Personal" },
  { id: "ws-new", name: "Acme" },
];

describe("resolveWorkspaceId", () => {
  it("keeps the stored workspace when the caller is still a member", () => {
    expect(resolveWorkspaceId(workspaces, "ws-new")).toBe("ws-new");
  });

  it("falls back to the oldest when the stored id is stale", () => {
    expect(resolveWorkspaceId(workspaces, "ws-removed")).toBe("ws-old");
  });

  it("falls back to the oldest when nothing is stored", () => {
    expect(resolveWorkspaceId(workspaces, null)).toBe("ws-old");
  });

  it("signals that one must be created when there are none", () => {
    expect(resolveWorkspaceId([], "ws-old")).toBeNull();
  });
});
