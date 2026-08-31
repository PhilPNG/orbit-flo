import type { Session, User } from "@supabase/supabase-js";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { supabase } from "../../lib/supabase/client";
import { AuthResetPage } from "./auth-reset-page";
import { AuthStateProvider, type AuthState } from "./use-auth";

const navigateMock = vi.fn();

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => navigateMock };
});

vi.mock("../../lib/supabase/client", () => ({
  supabase: {
    auth: {
      updateUser: vi.fn(),
      signOut: vi.fn(),
      resetPasswordForEmail: vi.fn(),
    },
  },
}));

const updateUserMock = vi.mocked(supabase.auth.updateUser);
const signOutMock = vi.mocked(supabase.auth.signOut);

const signedIn: AuthState = {
  isLoading: false,
  session: {} as Session,
  user: { email: "pilot@example.com" } as User,
};

function renderPage(value: AuthState) {
  render(
    <MemoryRouter>
      <AuthStateProvider value={value}>
        <AuthResetPage />
      </AuthStateProvider>
    </MemoryRouter>,
  );
}

describe("AuthResetPage", () => {
  beforeEach(() => {
    navigateMock.mockReset();
    updateUserMock.mockReset();
    signOutMock.mockReset();
    signOutMock.mockResolvedValue({ error: null } as never);
    vi.mocked(supabase.auth.resetPasswordForEmail).mockReset();
  });

  it("waits while the recovery session resolves", () => {
    renderPage({ isLoading: true, session: null, user: null });

    expect(screen.getByRole("status", { name: "Restoring access" })).toBeTruthy();
    expect(screen.queryByLabelText("New password")).toBeNull();
  });

  it("sets the password, drops other sessions, and continues into the app", async () => {
    updateUserMock.mockResolvedValue({ data: { user: null }, error: null } as never);
    const user = userEvent.setup();
    renderPage(signedIn);

    await user.type(screen.getByLabelText("New password"), "orbit-secret-1");
    await user.click(screen.getByRole("button", { name: "Set password and continue" }));

    await waitFor(() => expect(updateUserMock).toHaveBeenCalledWith({ password: "orbit-secret-1" }));
    expect(signOutMock).toHaveBeenCalledWith({ scope: "others" });
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith("/auth/callback", { replace: true }));
  });

  it("still continues when dropping other sessions fails", async () => {
    updateUserMock.mockResolvedValue({ data: { user: null }, error: null } as never);
    signOutMock.mockRejectedValue(new Error("network"));
    const user = userEvent.setup();
    renderPage(signedIn);

    await user.type(screen.getByLabelText("New password"), "orbit-secret-1");
    await user.click(screen.getByRole("button", { name: "Set password and continue" }));

    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith("/auth/callback", { replace: true }));
  });

  it("keeps the user here when the password is refused", async () => {
    updateUserMock.mockResolvedValue({
      data: { user: null },
      error: { message: "Auth session missing!" },
    } as never);
    const user = userEvent.setup();
    renderPage(signedIn);

    await user.type(screen.getByLabelText("New password"), "orbit-secret-1");
    await user.click(screen.getByRole("button", { name: "Set password and continue" }));

    expect(await screen.findByText("Auth session missing!")).toBeTruthy();
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it("reveals the password on request", async () => {
    const user = userEvent.setup();
    renderPage(signedIn);

    const field = screen.getByLabelText("New password");
    expect(field).toHaveAttribute("type", "password");

    await user.click(screen.getByRole("button", { name: "Show password" }));

    expect(field).toHaveAttribute("type", "text");
  });

  it("offers a fresh link when there is no recovery session", async () => {
    const resetPasswordForEmailMock = vi.mocked(supabase.auth.resetPasswordForEmail);
    resetPasswordForEmailMock.mockResolvedValue({ data: {}, error: null } as never);
    const user = userEvent.setup();
    renderPage({ isLoading: false, session: null, user: null });

    expect(screen.getByText("This link has drifted out of range.")).toBeTruthy();
    expect(screen.queryByLabelText("New password")).toBeNull();

    await user.type(screen.getByLabelText("Email"), "pilot@example.com");
    await user.click(screen.getByRole("button", { name: "Send a new link" }));

    expect(resetPasswordForEmailMock).toHaveBeenCalledWith("pilot@example.com", {
      redirectTo: "http://localhost:3000/auth/reset",
    });
    expect(await screen.findByText("Check your email for a new reset link.")).toBeTruthy();
  });

  it("surfaces a failure to send a fresh link", async () => {
    const resetPasswordForEmailMock = vi.mocked(supabase.auth.resetPasswordForEmail);
    resetPasswordForEmailMock.mockResolvedValue({
      data: {},
      error: { message: "Email rate limit exceeded" },
    } as never);
    const user = userEvent.setup();
    renderPage({ isLoading: false, session: null, user: null });

    await user.type(screen.getByLabelText("Email"), "pilot@example.com");
    await user.click(screen.getByRole("button", { name: "Send a new link" }));

    expect(await screen.findByText("Email rate limit exceeded")).toBeTruthy();
  });
});
