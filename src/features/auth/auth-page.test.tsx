import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthPage } from "./auth-page";

const authMocks = vi.hoisted(() => ({
  signInWithOAuth: vi.fn(),
  signInWithPassword: vi.fn(),
  signUp: vi.fn(),
  resetPasswordForEmail: vi.fn(),
}));

vi.mock("../../lib/supabase/client", () => ({
  supabase: {
    auth: {
      signInWithOAuth: authMocks.signInWithOAuth,
      signInWithPassword: authMocks.signInWithPassword,
      signUp: authMocks.signUp,
      resetPasswordForEmail: authMocks.resetPasswordForEmail,
    },
  },
}));

function renderAuthPage() {
  return render(<AuthPage />, { wrapper: MemoryRouter });
}

describe("AuthPage", () => {
  beforeEach(() => {
    authMocks.signInWithPassword.mockReset();
    authMocks.signInWithOAuth.mockReset();
    authMocks.signUp.mockReset();
    authMocks.resetPasswordForEmail.mockReset();
  });

  it("sends a password reset link for the entered email", async () => {
    const user = userEvent.setup();
    authMocks.resetPasswordForEmail.mockResolvedValue({ data: {}, error: null });

    renderAuthPage();

    await user.type(screen.getByLabelText("Email"), "pilot@example.com");
    await user.click(screen.getByRole("button", { name: "Forgot password?" }));

    expect(authMocks.resetPasswordForEmail).toHaveBeenCalledWith("pilot@example.com", {
      redirectTo: "http://localhost:3000/auth/reset",
    });
    expect(await screen.findByText("Check your email for a password reset link.")).toBeVisible();
  });

  it("asks for an email before sending a reset link", async () => {
    const user = userEvent.setup();

    renderAuthPage();

    await user.click(screen.getByRole("button", { name: "Forgot password?" }));

    expect(authMocks.resetPasswordForEmail).not.toHaveBeenCalled();
    expect(
      await screen.findByText("Enter your email above first, then request a reset link."),
    ).toBeVisible();
  });

  it("renders the exact cinematic hero and provider actions", () => {
    renderAuthPage();

    expect(
      screen.getByRole("heading", { name: "Your Mission Control for Productivity" }),
    ).toBeVisible();
    expect(screen.getByText("Launch your projects to Orbit.")).toBeVisible();
    expect(screen.getByRole("button", { name: "Sign in with Google" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Sign in with GitHub" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Sign in with Apple" })).toBeVisible();
    // The orbit core image is gone, replaced by a WebGL orb. What matters on
    // this page is not the artwork but the four feature labels around it - they
    // are the only thing telling a visitor what this product does, and this
    // assertion is what stops a future change quietly deleting them.
    expect(screen.getByText("Plan")).toBeVisible();
    expect(screen.getByText("Brainstorm")).toBeVisible();
    expect(screen.getByText("Mind map")).toBeVisible();
    expect(screen.getByText("Review")).toBeVisible();
  });

  it("reveals and hides the password", async () => {
    const user = userEvent.setup();
    renderAuthPage();

    const password = screen.getByLabelText("Password");
    await user.type(password, "orbit-password");
    expect(password).toHaveAttribute("type", "password");

    await user.click(screen.getByRole("button", { name: "Show password" }));
    expect(password).toHaveAttribute("type", "text");
    expect(password).toHaveValue("orbit-password");

    await user.click(screen.getByRole("button", { name: "Hide password" }));
    expect(password).toHaveAttribute("type", "password");
    expect(password).toHaveValue("orbit-password");
    expect(authMocks.signInWithPassword).not.toHaveBeenCalled();
  });

  it("creates an account with email and password", async () => {
    const user = userEvent.setup();
    authMocks.signUp.mockResolvedValue({
      data: { session: null, user: { id: "user-1" } },
      error: null,
    });

    renderAuthPage();

    for (const logo of screen.getAllByRole("img", { name: "Orbit Flo" })) {
      expect(logo.querySelector("img")).toHaveAttribute(
        "src",
        "/assets/brand/orbit-flo-lockup-dark.png",
      );
    }
    expect(screen.getByTestId("auth-orbit-scene")).toBeInTheDocument();
    expect(screen.queryByAltText("Orbit Flo onboarding command module")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Create account" }));
    await user.type(screen.getByLabelText("Email"), "pilot@example.com");
    await user.type(screen.getByLabelText("Password"), "orbit-password");
    await user.type(screen.getByLabelText("Confirm password"), "orbit-password");
    await user.click(screen.getByRole("button", { name: "Create Orbit Flo account" }));

    expect(authMocks.signUp).toHaveBeenCalledWith({
      email: "pilot@example.com",
      password: "orbit-password",
      options: {
        emailRedirectTo: "http://localhost:3000/auth/callback",
      },
    });
    expect(await screen.findByText("Check your email to complete account creation.")).toBeVisible();
  });
});
