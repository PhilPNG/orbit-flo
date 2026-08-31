import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { WorkspaceRole } from "../../lib/supabase/database.types";
import { MembersPanel } from "./members-panel";
import { assignableRoles } from "./members.queries";

vi.mock("../../lib/supabase/client", () => ({ supabase: {} }));

vi.mock("../workspaces/workspace-context", () => ({
  useWorkspaceId: () => "workspace-1",
}));

vi.mock("../auth/use-auth", () => ({
  useAuth: () => ({ user: { id: "user-me" } }),
}));

vi.mock("./members.queries", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./members.queries")>()),
  listMembers: vi.fn().mockResolvedValue([
    { id: "m1", userId: "user-me", role: "owner", displayName: "Me" },
    { id: "m2", userId: "user-other", role: "owner", displayName: "Co Owner" },
  ]),
}));

function renderPanel() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MembersPanel />
    </QueryClientProvider>,
  );
}

describe("MembersPanel", () => {
  it("lets an owner change a co-owner's role", async () => {
    renderPanel();
    expect(await screen.findByLabelText("Role for Co Owner")).toBeInTheDocument();
  });

  it("lets an owner remove a co-owner", async () => {
    renderPanel();
    expect(await screen.findByRole("button", { name: "Remove Co Owner" })).toBeInTheDocument();
  });

  it("never offers those controls for your own row", async () => {
    // Self-demotion is blocked by the UPDATE policy's WITH CHECK, so offering
    // the control would show a button that always fails.
    renderPanel();
    await screen.findByLabelText("Role for Co Owner");
    expect(screen.queryByLabelText("Role for Me")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Remove Me" })).not.toBeInTheDocument();
  });

  it("offers owner as an assignable role", () => {
    expect(assignableRoles).toContain("owner");
  });

  it("no longer admits viewer as a role", () => {
    // @ts-expect-error viewer was removed from WorkspaceRole
    const gone: WorkspaceRole = "viewer";
    expect(gone).toBe("viewer");
  });
});
