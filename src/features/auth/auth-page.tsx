import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail } from "lucide-react";
import { AppleMark, GitHubMark, GoogleMark } from "../../components/brand-icons";
import type { FormEvent } from "react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AuthOrbitScene } from "../../components/auth-orbit-scene";
import { OrbitFloLogo } from "../../components/orbit-flo-logo";
import { StarFieldBackground } from "../../components/space-visuals";
import { supabase } from "../../lib/supabase/client";

type OAuthProvider = "google" | "github" | "apple";
type AuthMode = "sign-in" | "sign-up";

const oauthProviders: Array<{
  label: string;
  provider: OAuthProvider;
  icon: (props: { className?: string }) => React.JSX.Element;
}> = [
  { label: "Google", provider: "google", icon: GoogleMark },
  { label: "GitHub", provider: "github", icon: GitHubMark },
  { label: "Apple", provider: "apple", icon: AppleMark },
];

const onboardingSteps = [
  "Create your account",
  "Confirm your email",
  "Enter your personal orbit",
];

export function AuthPage() {
  const navigate = useNavigate();
  const [authMode, setAuthMode] = useState<AuthMode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function switchMode(mode: AuthMode) {
    setAuthMode(mode);
    setErrorMessage(null);
    setSuccessMessage(null);
    setConfirmPassword("");
  }

  async function handlePasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (authMode === "sign-up" && password !== confirmPassword) {
      setErrorMessage("Passwords must match before launch.");
      return;
    }

    setIsSubmitting(true);

    try {
      if (authMode === "sign-up") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });

        if (error) {
          setErrorMessage(error.message);
          return;
        }

        if (data.session) {
          navigate("/auth/callback", { replace: true });
          return;
        }

        setSuccessMessage("Check your email to complete account creation.");
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      navigate("/auth/callback", { replace: true });
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : authMode === "sign-up"
            ? "Unable to create account."
            : "Unable to sign in.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleForgotPassword() {
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!email.trim()) {
      setErrorMessage("Enter your email above first, then request a reset link.");
      return;
    }

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/auth/reset`,
      });

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      setSuccessMessage("Check your email for a password reset link.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to send the reset link.");
    }
  }

  async function handleOAuthSignIn(provider: OAuthProvider) {
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) setErrorMessage(error.message);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to start sign in.",
      );
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#020817] px-4 py-6 text-slate-100 sm:px-6 sm:py-10">
      <StarFieldBackground />
      <div className="relative z-10 mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-6xl items-center justify-center">
        <section className="orbit-panel grid w-full overflow-hidden rounded-2xl md:min-h-[45rem] md:grid-cols-[minmax(0,3fr)_minmax(420px,2fr)]">
          <div className="hidden p-12 text-white md:flex md:flex-col md:justify-between">
            <div>
              <OrbitFloLogo className="max-w-60" showTagline />
              <h1 className="mt-10 max-w-xl text-4xl font-black leading-tight">
                Your Mission Control for Productivity
              </h1>
              <p className="mt-4 text-lg font-semibold text-slate-300">
                Launch your projects to Orbit.
              </p>
              <AuthOrbitScene />
            </div>
            <p className="mx-auto max-w-sm text-center text-sm leading-6 text-slate-400">
              Focus. Flow. Finish. Orbit Flo keeps your software projects moving with less noise.
            </p>
          </div>

          <div className="flex flex-col justify-center border-slate-400/15 bg-slate-950/80 p-6 sm:p-8 md:border-l">
            <div className="mb-8">
              <div className="mb-6 md:hidden">
                <OrbitFloLogo showTagline />
              </div>
              <p className="mission-label">
                {authMode === "sign-up" ? "Begin mission" : "Welcome back"}
              </p>
              <h1 className="mt-2 text-3xl font-black text-white">
                {authMode === "sign-up" ? "Create your command seat." : "Enter your flow state."}
              </h1>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                {authMode === "sign-up"
                  ? "Start with a personal workspace. Team orbit comes later."
                  : "Sign in to continue to Orbit Flo."}
              </p>
            </div>

            <div className="mb-6 grid grid-cols-2 rounded-lg border border-slate-400/20 bg-slate-950/70 p-1">
              <button
                aria-pressed={authMode === "sign-in"}
                className={
                  authMode === "sign-in"
                    ? "rounded-md bg-cyan-300/15 px-3 py-2 text-sm font-bold text-white shadow-[inset_0_0_0_1px_rgba(34,211,238,0.28)]"
                    : "rounded-md px-3 py-2 text-sm font-bold text-slate-400 hover:text-slate-100"
                }
                onClick={() => switchMode("sign-in")}
                type="button"
              >
                Sign in
              </button>
              <button
                aria-pressed={authMode === "sign-up"}
                className={
                  authMode === "sign-up"
                    ? "rounded-md bg-cyan-300/15 px-3 py-2 text-sm font-bold text-white shadow-[inset_0_0_0_1px_rgba(34,211,238,0.28)]"
                    : "rounded-md px-3 py-2 text-sm font-bold text-slate-400 hover:text-slate-100"
                }
                onClick={() => switchMode("sign-up")}
                type="button"
              >
                Create account
              </button>
            </div>

            <form className="space-y-4" onSubmit={handlePasswordSubmit}>
              <label className="block text-sm font-medium text-slate-200">
                Email
                <span className="mt-2 flex items-center gap-2 rounded-md border border-slate-400/20 bg-slate-950/70 px-3 py-2 focus-within:border-cyan-300/70 focus-within:ring-2 focus-within:ring-cyan-300/15">
                  <Mail className="h-4 w-4 text-cyan-200" aria-hidden="true" />
                  <input
                    className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    autoComplete="email"
                    required
                  />
                </span>
              </label>

              <label className="block text-sm font-medium text-slate-200">
                Password
                <span className="mt-2 flex items-center gap-2 rounded-md border border-slate-400/20 bg-slate-950/70 px-3 py-2 focus-within:border-cyan-300/70 focus-within:ring-2 focus-within:ring-cyan-300/15">
                  <LockKeyhole
                    className="h-4 w-4 text-cyan-200"
                    aria-hidden="true"
                  />
                  <input
                    className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none"
                    type={isPasswordVisible ? "text" : "password"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete={authMode === "sign-up" ? "new-password" : "current-password"}
                    required
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

              {authMode === "sign-in" ? (
                <div className="flex justify-end">
                  <button
                    className="text-xs font-semibold text-cyan-200 underline-offset-2 transition hover:text-cyan-100 hover:underline"
                    onClick={() => void handleForgotPassword()}
                    type="button"
                  >
                    Forgot password?
                  </button>
                </div>
              ) : null}

              {authMode === "sign-up" ? (
                <label className="block text-sm font-medium text-slate-200">
                  Confirm password
                  <span className="mt-2 flex items-center gap-2 rounded-md border border-slate-400/20 bg-slate-950/70 px-3 py-2 focus-within:border-cyan-300/70 focus-within:ring-2 focus-within:ring-cyan-300/15">
                    <LockKeyhole
                      className="h-4 w-4 text-cyan-200"
                      aria-hidden="true"
                    />
                    <input
                      className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none"
                      type="password"
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      autoComplete="new-password"
                      required
                    />
                  </span>
                </label>
              ) : null}

              {authMode === "sign-up" ? (
                <div className="grid gap-2 rounded-lg border border-cyan-300/15 bg-cyan-300/5 p-3">
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-cyan-100">
                    Launch sequence
                  </p>
                  <div className="grid gap-2">
                    {onboardingSteps.map((step, index) => (
                      <div className="flex items-center gap-2 text-sm text-slate-300" key={step}>
                        <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full border border-cyan-300/30 bg-slate-950 text-[0.65rem] font-black text-cyan-100">
                          {index + 1}
                        </span>
                        <span>{step}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {errorMessage ? (
                <p className="rounded-md border border-violet-300/35 bg-violet-400/10 px-3 py-2 text-sm text-violet-100">
                  {errorMessage}
                </p>
              ) : null}

              {successMessage ? (
                <p className="rounded-md border border-cyan-300/35 bg-cyan-300/10 px-3 py-2 text-sm text-cyan-100">
                  {successMessage}
                </p>
              ) : null}

              <button
                className="orbit-button w-full"
                type="submit"
                disabled={isSubmitting}
              >
                {isSubmitting
                  ? authMode === "sign-up"
                    ? "Creating orbit..."
                    : "Entering orbit..."
                  : authMode === "sign-up"
                    ? "Create Orbit Flo account"
                    : "Enter orbit"}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </form>

            <div className="my-6 flex items-center gap-3 text-xs uppercase tracking-[0.14em] text-slate-500">
              <span className="h-px flex-1 bg-slate-400/20" />
              or
              <span className="h-px flex-1 bg-slate-400/20" />
            </div>

            <div className="grid gap-3">
              {oauthProviders.map(({ label, provider, icon: Icon }) => (
                <button
                  className="orbit-button-secondary w-full"
                  key={provider}
                  type="button"
                  onClick={() => void handleOAuthSignIn(provider)}
                >
                  <Icon className="h-4 w-4" />
                  Sign in with {label}
                </button>
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
