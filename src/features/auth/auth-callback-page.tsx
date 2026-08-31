import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { OrbitFloLogo } from "../../components/orbit-flo-logo";
import { SatelliteLoader, StarFieldBackground } from "../../components/space-visuals";
import { supabase } from "../../lib/supabase/client";
import { ensurePersonalWorkspace } from "../../lib/supabase/onboarding";

export function AuthCallbackPage() {
  const navigate = useNavigate();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function bootstrapWorkspace() {
      const { data, error } = await supabase.auth.getUser();

      if (!isMounted) return;
      if (error) throw error;
      if (!data.user) throw new Error("No authenticated user was found.");

      // Bootstraps a first-run user. Where they land is the resolver's job —
      // "/" redirects to /w/:workspaceId, which records the last-used hint.
      await ensurePersonalWorkspace(supabase, data.user);
      if (!isMounted) return;

      navigate("/", { replace: true });
    }

    bootstrapWorkspace().catch((error: unknown) => {
      if (!isMounted) return;
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to finish signing you in.",
      );
    });

    return () => {
      isMounted = false;
    };
  }, [navigate]);

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#020817] px-6 text-slate-100">
      <StarFieldBackground />
      <section className="orbit-panel relative z-10 w-full max-w-sm rounded-lg p-6">
        <OrbitFloLogo className="mb-6 max-w-56" showTagline />
        <h1 className="text-lg font-semibold text-white">Preparing your orbit</h1>
        <div className="mt-4">
          {errorMessage ? null : <SatelliteLoader label="Loading mission control" />}
        </div>
        <p className="mt-3 text-sm leading-6 text-slate-400">
          {errorMessage ?? "Finishing sign-in and loading Orbit Flo..."}
        </p>
        {errorMessage ? (
          <Link
            className="orbit-button mt-4"
            to="/auth"
          >
            Back to sign in
          </Link>
        ) : null}
      </section>
    </main>
  );
}
