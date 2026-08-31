# Password Reset Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give password recovery a real destination — a `/auth/reset` screen that sets a new password and continues into the app, plus a recoverable failure state for expired links.

**Architecture:** A shared `useUpdatePassword` hook owns validation and the `supabase.auth.updateUser` call. A new unguarded `/auth/reset` route renders one of two states based solely on whether `useAuth()` reports a session — no URL parsing, because `detectSessionInUrl: true` consumes the recovery fragment asynchronously. `SettingsPage` is refactored onto the same hook so validation cannot drift.

**Tech Stack:** React 19, react-router-dom, Supabase JS v2, Tailwind v4, vitest + @testing-library/react.

**Spec:** `docs/superpowers/specs/2026-08-09-password-reset-design.md`

## Global Constraints

- Minimum password length is 8 characters. Error copy, verbatim: `Passwords need at least 8 characters.`
- Every recovery `redirectTo` is `` `${window.location.origin}/auth/reset` ``.
- `/auth/reset` is declared non-lazy in `routes.tsx`, like `/auth` and `/auth/callback`.
- Do not modify `src/features/auth/auth-callback-page.tsx`.
- Existing assertions in `src/features/settings/settings-page.test.tsx` must pass unchanged.
- Commit trailer on every commit: `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`
- Run tests with `npx vitest run --maxWorkers=2 <path>`.

---

### Task 1: `useUpdatePassword` hook

**Files:**
- Create: `src/features/auth/use-update-password.ts`
- Test: `src/features/auth/use-update-password.test.ts`

**Interfaces:**
- Consumes: `supabase` from `src/lib/supabase/client`
- Produces:
  ```ts
  function useUpdatePassword(): {
    updatePassword: (password: string) => Promise<boolean>;
    isUpdating: boolean;
    error: string | null;
    clearError: () => void;
  }
  ```
  `updatePassword` resolves `true` only when the password was written. Callers decide what happens next.

- [ ] **Step 1: Write the failing test**

Create `src/features/auth/use-update-password.test.ts`:

```ts
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { supabase } from "../../lib/supabase/client";
import { useUpdatePassword } from "./use-update-password";

vi.mock("../../lib/supabase/client", () => ({
  supabase: {
    auth: {
      updateUser: vi.fn(),
    },
  },
}));

const updateUserMock = vi.mocked(supabase.auth.updateUser);

describe("useUpdatePassword", () => {
  beforeEach(() => {
    updateUserMock.mockReset();
  });

  it("rejects passwords under eight characters without calling Supabase", async () => {
    const { result } = renderHook(() => useUpdatePassword());

    let outcome: boolean | undefined;
    await act(async () => {
      outcome = await result.current.updatePassword("orbit");
    });

    expect(outcome).toBe(false);
    expect(updateUserMock).not.toHaveBeenCalled();
    expect(result.current.error).toBe("Passwords need at least 8 characters.");
  });

  it("writes the password and reports success", async () => {
    updateUserMock.mockResolvedValue({ data: { user: null }, error: null } as never);
    const { result } = renderHook(() => useUpdatePassword());

    let outcome: boolean | undefined;
    await act(async () => {
      outcome = await result.current.updatePassword("orbit-secret-1");
    });

    expect(outcome).toBe(true);
    expect(updateUserMock).toHaveBeenCalledWith({ password: "orbit-secret-1" });
    expect(result.current.error).toBeNull();
  });

  it("surfaces the Supabase error message", async () => {
    updateUserMock.mockResolvedValue({
      data: { user: null },
      error: { message: "Auth session missing!" },
    } as never);
    const { result } = renderHook(() => useUpdatePassword());

    let outcome: boolean | undefined;
    await act(async () => {
      outcome = await result.current.updatePassword("orbit-secret-1");
    });

    expect(outcome).toBe(false);
    expect(result.current.error).toBe("Auth session missing!");
  });

  it("reports while the write is in flight", async () => {
    let release: (value: unknown) => void = () => {};
    updateUserMock.mockReturnValue(
      new Promise((resolve) => {
        release = resolve;
      }) as never,
    );
    const { result } = renderHook(() => useUpdatePassword());

    act(() => {
      void result.current.updatePassword("orbit-secret-1");
    });

    await waitFor(() => expect(result.current.isUpdating).toBe(true));

    await act(async () => {
      release({ data: { user: null }, error: null });
    });

    await waitFor(() => expect(result.current.isUpdating).toBe(false));
  });

  it("clears the error on request", async () => {
    const { result } = renderHook(() => useUpdatePassword());

    await act(async () => {
      await result.current.updatePassword("short");
    });
    expect(result.current.error).not.toBeNull();

    act(() => {
      result.current.clearError();
    });

    expect(result.current.error).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

```bash
npx vitest run --maxWorkers=2 src/features/auth/use-update-password.test.ts
```

Expected: FAIL — `Failed to resolve import "./use-update-password"`.

- [ ] **Step 3: Write the hook**

Create `src/features/auth/use-update-password.ts`:

```ts
import { useState } from "react";
import { supabase } from "../../lib/supabase/client";

/**
 * Shared by the settings panel and the password reset screen so the length
 * rule and error copy cannot drift apart. Resolves true only when the password
 * was actually written — the caller decides what happens next.
 */
export function useUpdatePassword() {
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function updatePassword(password: string): Promise<boolean> {
    setError(null);

    if (password.length < 8) {
      setError("Passwords need at least 8 characters.");
      return false;
    }

    setIsUpdating(true);

    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });

      if (updateError) {
        setError(updateError.message);
        return false;
      }

      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to update the password.");
      return false;
    } finally {
      setIsUpdating(false);
    }
  }

  function clearError() {
    setError(null);
  }

  return { updatePassword, isUpdating, error, clearError };
}
```

- [ ] **Step 4: Run the test and confirm it passes**

```bash
npx vitest run --maxWorkers=2 src/features/auth/use-update-password.test.ts
```

Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/features/auth/use-update-password.ts src/features/auth/use-update-password.test.ts && git commit -m "feat: add shared useUpdatePassword hook"
```

---

### Task 2: Move `SettingsPage` onto the hook

**Files:**
- Modify: `src/features/settings/settings-page.tsx:44-76` (state and `changePassword`), `:143-159` (button and error markup)
- Test: `src/features/settings/settings-page.test.tsx` — **unchanged**, it is the regression check

**Interfaces:**
- Consumes: `useUpdatePassword` from Task 1
- Produces: nothing new

The page keeps its own success message (`Password updated.`) because that is
settings-specific — the reset page navigates away instead of showing it.

- [ ] **Step 1: Run the settings tests first to record the baseline**

```bash
npx vitest run --maxWorkers=2 src/features/settings/settings-page.test.tsx
```

Expected: PASS. Note the count; it must be identical at the end of this task.

- [ ] **Step 2: Add the import**

In `src/features/settings/settings-page.tsx`, alongside the other feature imports:

```ts
import { useUpdatePassword } from "../auth/use-update-password";
```

- [ ] **Step 3: Replace the password state and handler**

Delete these three state declarations (currently lines 46-48):

```ts
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
```

Replace with:

```ts
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const {
    updatePassword,
    isUpdating: isUpdatingPassword,
    error: passwordError,
    clearError: clearPasswordError,
  } = useUpdatePassword();
```

Then replace the whole `changePassword` function (currently lines 50-76) with:

```ts
  async function changePassword() {
    setPasswordMessage(null);
    clearPasswordError();

    if (!(await updatePassword(newPassword))) return;

    setNewPassword("");
    setPasswordMessage("Password updated.");
  }
```

Leave the JSX untouched — `isUpdatingPassword`, `passwordError`, and
`passwordMessage` are all still in scope under the same names.

- [ ] **Step 4: Run the settings tests and confirm they still pass**

```bash
npx vitest run --maxWorkers=2 src/features/settings/settings-page.test.tsx
```

Expected: PASS with the same test count as Step 1. If a test fails, the
extraction changed behaviour — fix the hook or the wiring, not the test.

- [ ] **Step 5: Typecheck**

```bash
npx tsc -b
```

Expected: no output. `useState` is still imported and used — `newPassword`,
`dailyLayout`, `isSigningOut`, and `passwordMessage` all remain local state.

- [ ] **Step 6: Commit**

```bash
git add src/features/settings/settings-page.tsx && git commit -m "refactor: move settings password change onto the shared hook"
```

---

### Task 3: The `/auth/reset` set-password state

**Files:**
- Create: `src/features/auth/auth-reset-page.tsx`
- Test: `src/features/auth/auth-reset-page.test.tsx`

**Interfaces:**
- Consumes: `useUpdatePassword` (Task 1); `useAuth` and `AuthStateProvider` from `./use-auth`; `supabase` from `../../lib/supabase/client`
- Produces: `export function AuthResetPage(): JSX.Element` — used by Task 4's route

Session state is injected through `AuthStateProvider`, the codebase's own
mechanism for it (`use-auth.ts:20` returns the provided value ahead of its
internal state). No mocking of `useAuth` is needed.

The expired state is built in Task 4; this task renders a placeholder for it so
the component compiles.

- [ ] **Step 1: Write the failing test**

Create `src/features/auth/auth-reset-page.test.tsx`:

```tsx
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
});
```

- [ ] **Step 2: Run the test and confirm it fails**

```bash
npx vitest run --maxWorkers=2 src/features/auth/auth-reset-page.test.tsx
```

Expected: FAIL — `Failed to resolve import "./auth-reset-page"`.

- [ ] **Step 3: Write the page**

Create `src/features/auth/auth-reset-page.tsx`:

```tsx
import { ArrowRight, Eye, EyeOff, LockKeyhole } from "lucide-react";
import type { FormEvent, PropsWithChildren } from "react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { OrbitFloLogo } from "../../components/orbit-flo-logo";
import { SatelliteLoader, StarFieldBackground } from "../../components/space-visuals";
import { supabase } from "../../lib/supabase/client";
import { useAuth } from "./use-auth";
import { useUpdatePassword } from "./use-update-password";

function ResetShell({ children }: PropsWithChildren) {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#020817] px-6 text-slate-100">
      <StarFieldBackground />
      <section className="orbit-panel relative z-10 w-full max-w-sm rounded-lg p-6">
        <OrbitFloLogo className="mb-6 max-w-56" showTagline />
        {children}
      </section>
    </main>
  );
}

export function AuthResetPage() {
  const navigate = useNavigate();
  const { isLoading, session } = useAuth();
  const { updatePassword, isUpdating, error } = useUpdatePassword();
  const [password, setPassword] = useState("");
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!(await updatePassword(password))) return;

    // Someone resetting a password may have lost control of it, so other
    // sessions go with it. The current session is exempt, which is what lets
    // the redirect below work. A failure here must not strand the user: the
    // password is already changed.
    try {
      await supabase.auth.signOut({ scope: "others" });
    } catch (cause) {
      console.error("Could not sign out other sessions", cause);
    }

    navigate("/auth/callback", { replace: true });
  }

  if (isLoading) {
    return (
      <ResetShell>
        <SatelliteLoader label="Restoring access" />
      </ResetShell>
    );
  }

  if (!session) {
    // Built in Task 4.
    return <ResetShell>{null}</ResetShell>;
  }

  return (
    <ResetShell>
      <p className="mission-label">Restore access</p>
      <h1 className="mt-2 text-2xl font-black text-white">Choose a new password.</h1>
      <p className="mt-2 text-sm leading-6 text-slate-400">
        We will put you back in orbit as soon as it is set.
      </p>

      <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
        <label className="block text-sm font-medium text-slate-200">
          New password
          <span className="mt-2 flex items-center gap-2 rounded-md border border-slate-400/20 bg-slate-950/70 px-3 py-2 focus-within:border-cyan-300/70 focus-within:ring-2 focus-within:ring-cyan-300/15">
            <LockKeyhole aria-hidden="true" className="h-4 w-4 text-cyan-200" />
            <input
              aria-label="New password"
              autoComplete="new-password"
              className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none"
              onChange={(event) => setPassword(event.target.value)}
              required
              type={isPasswordVisible ? "text" : "password"}
              value={password}
            />
            <button
              aria-label={isPasswordVisible ? "Hide password" : "Show password"}
              className="orbit-field-icon-button"
              onClick={() => setIsPasswordVisible((value) => !value)}
              type="button"
            >
              {isPasswordVisible ? (
                <EyeOff aria-hidden="true" className="h-4 w-4" />
              ) : (
                <Eye aria-hidden="true" className="h-4 w-4" />
              )}
            </button>
          </span>
        </label>

        {error ? (
          <p
            className="rounded-md border border-violet-300/35 bg-violet-400/10 px-3 py-2 text-sm text-violet-100"
            role="alert"
          >
            {error}
          </p>
        ) : null}

        <button className="orbit-button w-full" disabled={isUpdating} type="submit">
          {isUpdating ? "Setting password..." : "Set password and continue"}
          <ArrowRight aria-hidden="true" className="h-4 w-4" />
        </button>
      </form>
    </ResetShell>
  );
}
```

- [ ] **Step 4: Run the test and confirm it passes**

```bash
npx vitest run --maxWorkers=2 src/features/auth/auth-reset-page.test.tsx
```

Expected: PASS, 5 tests.

If `SatelliteLoader` does not expose the accessible name `Restoring access`,
read `src/components/space-visuals.tsx` and match how `label` is applied —
`RouteFallback` uses `getByRole("status", { name: "Systems online" })`, so the
pattern holds.

- [ ] **Step 5: Commit**

```bash
git add src/features/auth/auth-reset-page.tsx src/features/auth/auth-reset-page.test.tsx && git commit -m "feat: add the password reset screen"
```

---

### Task 4: Expired-link state, route, and redirect target

**Files:**
- Modify: `src/features/auth/auth-reset-page.tsx` — replace the Task 3 placeholder
- Modify: `src/features/auth/auth-reset-page.test.tsx` — add the expired-state tests
- Modify: `src/app/routes.tsx` — import and add the `/auth/reset` route
- Modify: `src/features/auth/auth-page.tsx:116` — `redirectTo`
- Modify: `src/features/auth/auth-page.test.tsx:48` — matching assertion

**Interfaces:**
- Consumes: `AuthResetPage` from Task 3
- Produces: the reachable `/auth/reset` route

- [ ] **Step 1: Write the failing tests**

Append to the `describe("AuthResetPage")` block in
`src/features/auth/auth-reset-page.test.tsx`:

```tsx
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
```

Add the reset mock to `beforeEach`:

```tsx
    vi.mocked(supabase.auth.resetPasswordForEmail).mockReset();
```

The `http://localhost:3000` origin is what jsdom reports in this project —
`auth-page.test.tsx:48` already asserts against it.

- [ ] **Step 2: Run and confirm the new tests fail**

```bash
npx vitest run --maxWorkers=2 src/features/auth/auth-reset-page.test.tsx
```

Expected: the two new tests FAIL on `Unable to find an element with the text: This link has drifted out of range.`; the five from Task 3 still pass.

- [ ] **Step 3: Build the expired state**

In `src/features/auth/auth-reset-page.tsx`, add `Mail` to the lucide import and
`Link` to the router import:

```tsx
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
```

Add this component above `AuthResetPage`:

```tsx
function ExpiredLink() {
  const [email, setEmail] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [sentMessage, setSentMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function sendFreshLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSentMessage(null);
    setErrorMessage(null);
    setIsSending(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/auth/reset`,
      });

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      setSentMessage("Check your email for a new reset link.");
    } catch (cause) {
      setErrorMessage(cause instanceof Error ? cause.message : "Unable to send the reset link.");
    } finally {
      setIsSending(false);
    }
  }

  return (
    <>
      <p className="mission-label">Restore access</p>
      <h1 className="mt-2 text-2xl font-black text-white">This link has drifted out of range.</h1>
      <p className="mt-2 text-sm leading-6 text-slate-400">
        Reset links work once and expire after an hour. Send yourself a fresh one.
      </p>

      <form className="mt-5 space-y-4" onSubmit={sendFreshLink}>
        <label className="block text-sm font-medium text-slate-200">
          Email
          <span className="mt-2 flex items-center gap-2 rounded-md border border-slate-400/20 bg-slate-950/70 px-3 py-2 focus-within:border-cyan-300/70 focus-within:ring-2 focus-within:ring-cyan-300/15">
            <Mail aria-hidden="true" className="h-4 w-4 text-cyan-200" />
            <input
              aria-label="Email"
              autoComplete="email"
              className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Email"
              required
              type="email"
              value={email}
            />
          </span>
        </label>

        {errorMessage ? (
          <p
            className="rounded-md border border-violet-300/35 bg-violet-400/10 px-3 py-2 text-sm text-violet-100"
            role="alert"
          >
            {errorMessage}
          </p>
        ) : null}

        {sentMessage ? (
          <p className="rounded-md border border-cyan-300/35 bg-cyan-300/10 px-3 py-2 text-sm text-cyan-100">
            {sentMessage}
          </p>
        ) : null}

        <button className="orbit-button w-full" disabled={isSending} type="submit">
          {isSending ? "Sending..." : "Send a new link"}
          <ArrowRight aria-hidden="true" className="h-4 w-4" />
        </button>
      </form>

      <Link className="mt-4 inline-block text-xs font-semibold text-cyan-200 hover:text-cyan-100" to="/auth">
        Back to sign in
      </Link>
    </>
  );
}
```

Replace the Task 3 placeholder:

```tsx
  if (!session) {
    return <ResetShell>{null}</ResetShell>;
  }
```

with:

```tsx
  if (!session) {
    return (
      <ResetShell>
        <ExpiredLink />
      </ResetShell>
    );
  }
```

- [ ] **Step 4: Add the route**

In `src/app/routes.tsx`, add the import next to the other auth imports:

```tsx
import { AuthResetPage } from "../features/auth/auth-reset-page";
```

and the route immediately after the `/auth/callback` route:

```tsx
        <Route path="/auth/reset" element={<AuthResetPage />} />
```

- [ ] **Step 5: Point recovery emails at it**

In `src/features/auth/auth-page.tsx`, in `handleForgotPassword`, change:

```ts
        redirectTo: `${window.location.origin}/auth/callback`,
```

to:

```ts
        redirectTo: `${window.location.origin}/auth/reset`,
```

Change only the one inside `handleForgotPassword`. The identical strings in
`signUp` (line 66) and `signInWithOAuth` (line 138) must keep pointing at
`/auth/callback`.

Then in `src/features/auth/auth-page.test.tsx`, update the assertion:

```ts
    expect(authMocks.resetPasswordForEmail).toHaveBeenCalledWith("pilot@example.com", {
      redirectTo: "http://localhost:3000/auth/reset",
    });
```

- [ ] **Step 6: Run the affected tests**

```bash
npx vitest run --maxWorkers=2 src/features/auth src/app
```

Expected: PASS, including the seven `AuthResetPage` tests.

- [ ] **Step 7: Commit**

```bash
git add src/features/auth src/app/routes.tsx && git commit -m "feat: route recovery links to the reset screen"
```

---

### Task 5: Verification

**Files:** none modified unless a defect surfaces

- [ ] **Step 1: Typecheck and build**

```bash
npm run build
```

Expected: `tsc -b` silent, vite build succeeds.

- [ ] **Step 2: Full suite**

```bash
npx vitest run --maxWorkers=2
```

Expected: every file passes. Baseline before this plan was 85 files / 458 tests; this plan adds 2 files and 12 tests.

- [ ] **Step 3: Verify the expired state in a browser**

Start the preview (`preview_start` with `orbit-flo-worktree`), then visit
`http://localhost:5173/auth/reset` with no session. Expect the expired-link
panel, not a blank page or a redirect to `/auth`. Confirm the starfield and
lockup render and the panel is centred at phone width (390px) as well as
desktop.

The signed-in state cannot be exercised this way — it needs a real recovery
session. Verify it by reading the passing tests, and note in the PR that the
set-password path was not exercised against live Supabase.

- [ ] **Step 4: Open the PR**

```bash
git push -u origin codex/password-reset
```

Then open a PR against `main` describing: the broken flow, the dedicated route
and why not a branch in the callback, the shared hook, the expired-link
recovery, session revocation, and what was and was not verified in a browser.

- [ ] **Step 5: Merge once CI is green**

```bash
gh pr checks <number> --watch --interval 15
```

Then squash-merge.
