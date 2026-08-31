import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail } from "lucide-react";
import type { FormEvent, PropsWithChildren } from "react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
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
    return (
      <ResetShell>
        <ExpiredLink />
      </ResetShell>
    );
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
