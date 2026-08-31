import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { supabase } from "../../lib/supabase/client";
import {
  getStoredWorkspaceId,
  setStoredWorkspaceId,
} from "../../lib/supabase/workspace";
import { SettingsPage } from "./settings-page";

vi.mock("../../lib/supabase/client", () => ({
  supabase: {
    auth: {
      signOut: vi.fn(),
      updateUser: vi.fn(),
    },
  },
}));

const profileMocks = vi.hoisted(() => ({
  getProfile: vi.fn(),
  updateDisplayName: vi.fn(),
}));

vi.mock("../members/members.queries", () => ({
  listMembers: () =>
    Promise.resolve([
      { id: "m1", userId: "user-1", role: "owner", displayName: "Ada Lovelace" },
    ]),
  setMemberRole: vi.fn(),
  removeMember: vi.fn(),
  leaveWorkspace: vi.fn(),
  deleteWorkspace: vi.fn(),
  membersQueryKey: (workspaceId: string) => ["workspace-members", workspaceId],
  assignableRoles: ["owner", "admin", "member"],
}));

vi.mock("../invitations/invitations.queries", () => ({
  listInvitations: () => Promise.resolve([]),
  createInvitation: vi.fn(),
  revokeInvitation: vi.fn(),
  invitationLink: (token: string) => `http://localhost:3000/invite/${token}`,
  invitationsQueryKey: (workspaceId: string) => ["workspace-invitations", workspaceId],
  invitableRoles: ["member", "admin", "owner"],
}));

vi.mock("../workspaces/workspace-context", () => ({
  useWorkspaceId: () => "workspace-1",
}));

vi.mock("../workspaces/workspaces.queries", () => ({
  listWorkspaces: () => Promise.resolve([{ id: "workspace-1", name: "Personal" }]),
  renameWorkspace: vi.fn(),
  workspacesQueryKey: ["workspaces"],
}));

vi.mock("../auth/use-auth", () => ({
  useAuth: () => ({
    user: {
      id: "user-1",
      email: "ada@example.com",
    },
  }),
}));

vi.mock("../profiles/profiles.queries", () => ({
  getProfile: () => profileMocks.getProfile(),
  updateDisplayName: (...args: unknown[]) => profileMocks.updateDisplayName(...args),
}));

const signOutMock = vi.mocked(supabase.auth.signOut);
const updateUserMock = vi.mocked(supabase.auth.updateUser);

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });

  return { promise, resolve, reject };
}

function renderSettings() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return render(
    <QueryClientProvider client={client}>
      <SettingsPage />
    </QueryClientProvider>,
  );
}

describe("SettingsPage", () => {
  beforeEach(() => {
    window.localStorage.clear();
    profileMocks.getProfile.mockReset();
    profileMocks.updateDisplayName.mockReset();
    profileMocks.getProfile.mockResolvedValue({ id: "user-1", displayName: "Ada Lovelace" });
    signOutMock.mockReset();
    updateUserMock.mockReset();
  });

  it("shows the signed-in identity and clears stored workspace state after signing out", async () => {
    const user = userEvent.setup();
    signOutMock.mockResolvedValue({ error: null });
    setStoredWorkspaceId("workspace-1");

    renderSettings();

    expect(screen.getByText("Signed in as")).toBeTruthy();
    expect(screen.getByText("ada@example.com")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Sign out" }));

    await waitFor(() => {
      expect(signOutMock).toHaveBeenCalledOnce();
      expect(getStoredWorkspaceId()).toBeNull();
    });
  });

  it("disables sign out while a sign-out request is pending", async () => {
    const user = userEvent.setup();
    const signOut = createDeferred<Awaited<ReturnType<typeof supabase.auth.signOut>>>();
    signOutMock.mockReturnValue(signOut.promise);

    renderSettings();

    const button = screen.getByRole("button", { name: "Sign out" });

    await user.click(button);
    await user.click(button);

    expect(button).toBeDisabled();
    expect(signOutMock).toHaveBeenCalledOnce();

    signOut.resolve({ error: null });
  });

  it("keeps stored workspace state and shows an error when sign out fails", async () => {
    const user = userEvent.setup();
    signOutMock.mockResolvedValue({
      error: new Error("Unable to sign out") as Awaited<
        ReturnType<typeof supabase.auth.signOut>
      >["error"],
    });
    setStoredWorkspaceId("workspace-1");

    renderSettings();

    await user.click(screen.getByRole("button", { name: "Sign out" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Unable to sign out");
    expect(getStoredWorkspaceId()).toBe("workspace-1");
  });

  it("updates the account password", async () => {
    const user = userEvent.setup();
    updateUserMock.mockResolvedValue({ data: { user: null }, error: null } as never);

    renderSettings();

    await user.type(screen.getByLabelText("New password"), "orbit-secret-1");
    await user.click(screen.getByRole("button", { name: "Update password" }));

    expect(updateUserMock).toHaveBeenCalledWith({ password: "orbit-secret-1" });
    expect(await screen.findByText("Password updated.")).toBeTruthy();
  });

  it("rejects short passwords without calling Supabase", async () => {
    const user = userEvent.setup();

    renderSettings();

    await user.type(screen.getByLabelText("New password"), "short");
    await user.click(screen.getByRole("button", { name: "Update password" }));

    expect(updateUserMock).not.toHaveBeenCalled();
    expect(await screen.findByText("Passwords need at least 8 characters.")).toBeTruthy();
  });

  it("saves daily home module preferences", async () => {
    const user = userEvent.setup();

    renderSettings();

    await user.click(screen.getByLabelText("Quick Capture"));

    expect(window.localStorage.getItem("orbitflo:daily-home-layout")).toContain("\"quickCapture\":false");
  });

  it("exposes daily modules as enabled switches with autosave feedback", () => {
    renderSettings();

    for (const name of ["Quick Capture", "Mission Momentum", "Smart Suggestions", "Mission Debrief"]) {
      expect(screen.getByRole("switch", { name })).toBeChecked();
    }

    expect(screen.getByText("Saved automatically")).toBeVisible();
  });

  it("shows the signed-in person by name and initials", async () => {
    renderSettings();

    // The members list shows the same person, so scope to the account panel.
    const account = within(await screen.findByLabelText("Account"));

    expect(await account.findByText("Ada Lovelace")).toBeVisible();
    expect(account.getByRole("img", { name: "Ada Lovelace" })).toBeTruthy();
    expect(account.getByText("ada@example.com")).toBeVisible();
  });

  it("renames the signed-in person with a trimmed name", async () => {
    profileMocks.updateDisplayName.mockResolvedValue({ id: "user-1", displayName: "Ada L" });
    const user = userEvent.setup();
    renderSettings();

    // The field exists before the profile resolves, so wait for the seeded
    // value — clearing an already-empty field would let the seed land after.
    const field = await screen.findByDisplayValue("Ada Lovelace");
    await user.clear(field);
    await user.type(field, "  Ada L  ");
    await user.click(
      within(screen.getByLabelText("Your name")).getByRole("button", { name: "Update name" }),
    );

    await waitFor(() =>
      expect(profileMocks.updateDisplayName).toHaveBeenCalledWith(expect.anything(), {
        userId: "user-1",
        displayName: "  Ada L  ",
      }),
    );
  });

  it("still shows the email when the profile cannot be loaded", async () => {
    profileMocks.getProfile.mockRejectedValue(new Error("offline"));
    renderSettings();

    const account = within(await screen.findByLabelText("Account"));

    expect(account.getByText("ada@example.com")).toBeVisible();
    expect(account.queryByRole("img", { name: "Ada Lovelace" })).toBeNull();
  });
});
