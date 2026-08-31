import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { InvitationPage } from "./invitation-page";
import { getPendingInvitation } from "./pending-invitation";

const invitationMocks = vi.hoisted(() => ({
  previewInvitation: vi.fn(),
  acceptInvitation: vi.fn(),
  useAuth: vi.fn(),
}));

const navigateMock = vi.fn();

vi.mock("../../lib/supabase/client", () => ({ supabase: {} }));

vi.mock("./invitations.queries", () => ({
  previewInvitation: invitationMocks.previewInvitation,
  acceptInvitation: invitationMocks.acceptInvitation,
}));

vi.mock("../auth/use-auth", () => ({ useAuth: () => invitationMocks.useAuth() }));

vi.mock("../workspaces/workspaces.queries", () => ({ workspacesQueryKey: ["workspaces"] }));

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => navigateMock };
});

const pending = {
  workspaceName: "Acme",
  invitedByName: "Ada",
  email: "grace@example.com",
  isExpired: false,
  isAccepted: false,
};

function renderInvitation() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/invite/token-1"]}>
        <Routes>
          <Route element={<InvitationPage />} path="/invite/:token" />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("InvitationPage", () => {
  beforeEach(() => {
    window.localStorage.clear();
    navigateMock.mockReset();
    invitationMocks.acceptInvitation.mockReset();
    invitationMocks.previewInvitation.mockReset();
    invitationMocks.previewInvitation.mockResolvedValue(pending);
    invitationMocks.useAuth.mockReturnValue({
      isLoading: false,
      user: { id: "user-2", email: "grace@example.com" },
    });
  });

  it("names the inviter and the workspace", async () => {
    renderInvitation();

    expect(await screen.findByText("Ada invited you to Acme.")).toBeTruthy();
  });

  it("joins the workspace and goes there", async () => {
    invitationMocks.acceptInvitation.mockResolvedValue("workspace-9");
    const user = userEvent.setup();
    renderInvitation();

    await user.click(await screen.findByRole("button", { name: "Accept invitation" }));

    expect(navigateMock).toHaveBeenCalledWith("/w/workspace-9", { replace: true });
  });

  it("surfaces a refusal from the server", async () => {
    invitationMocks.acceptInvitation.mockRejectedValue(new Error("This invitation has expired"));
    const user = userEvent.setup();
    renderInvitation();

    await user.click(await screen.findByRole("button", { name: "Accept invitation" }));

    expect(await screen.findByText("This invitation has expired")).toBeTruthy();
  });

  it("says so when the invitation is already used", async () => {
    invitationMocks.previewInvitation.mockResolvedValue({ ...pending, isAccepted: true });
    renderInvitation();

    expect(await screen.findByText("This invitation has already been used.")).toBeTruthy();
  });

  it("says so when the invitation has expired", async () => {
    invitationMocks.previewInvitation.mockResolvedValue({ ...pending, isExpired: true });
    renderInvitation();

    expect(await screen.findByText("This invitation has expired.")).toBeTruthy();
  });

  it("says so when the token matches nothing", async () => {
    invitationMocks.previewInvitation.mockResolvedValue(null);
    renderInvitation();

    expect(await screen.findByText("This invitation could not be found.")).toBeTruthy();
  });

  it("names the mismatch rather than offering a button that would fail", async () => {
    invitationMocks.useAuth.mockReturnValue({
      isLoading: false,
      user: { id: "user-3", email: "someone@else.com" },
    });
    renderInvitation();

    expect(
      await screen.findByText(
        "This invitation was sent to grace@example.com, but you are signed in as someone@else.com.",
      ),
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Accept invitation" })).toBeNull();
  });

  it("parks the token so signing in can resume the journey", async () => {
    invitationMocks.useAuth.mockReturnValue({ isLoading: false, user: null });
    const user = userEvent.setup();
    renderInvitation();

    await user.click(await screen.findByRole("link", { name: "Sign in to accept" }));

    expect(getPendingInvitation()).toBe("token-1");
  });
});
