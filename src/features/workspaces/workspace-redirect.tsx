import { useQuery } from "@tanstack/react-query";
import { Navigate, useLocation } from "react-router-dom";
import { OrbitFloLogo } from "../../components/orbit-flo-logo";
import { SatelliteLoader, StarFieldBackground } from "../../components/space-visuals";
import { supabase } from "../../lib/supabase/client";
import { ensurePersonalWorkspace } from "../../lib/supabase/onboarding";
import { getStoredWorkspaceId } from "../../lib/supabase/workspace";
import { useAuth } from "../auth/use-auth";
import { getPendingInvitation } from "../invitations/pending-invitation";
import { workspacePath } from "./workspace-path";
import { resolveWorkspaceId } from "./workspace-resolver";
import { listWorkspaces, workspacesQueryKey } from "./workspaces.queries";

/**
 * "/" and every legacy path land here. The path is carried across so an old
 * bookmark such as /projects reopens the same screen in the resolved
 * workspace.
 */
export function WorkspaceRedirect() {
  const location = useLocation();
  const { user } = useAuth();

  // Signing in navigates away from /invite/:token, so finish that journey
  // before choosing a workspace.
  const pendingInvitation = getPendingInvitation();
  if (pendingInvitation && location.pathname === "/") {
    return <Navigate to={`/invite/${pendingInvitation}`} replace />;
  }

  const workspacesQuery = useQuery({
    queryKey: workspacesQueryKey,
    queryFn: () => listWorkspaces(supabase),
  });

  const resolvedId = workspacesQuery.data
    ? resolveWorkspaceId(workspacesQuery.data, getStoredWorkspaceId())
    : null;

  // Only runs for a caller with no workspace at all — the first-run path.
  const createdQuery = useQuery({
    queryKey: ["workspaces", "bootstrap"],
    queryFn: () => {
      if (!user) throw new Error("Sign in to open a workspace.");
      return ensurePersonalWorkspace(supabase, user);
    },
    enabled: Boolean(user) && workspacesQuery.isSuccess && resolvedId === null,
  });

  const targetId = resolvedId ?? createdQuery.data?.id ?? null;

  if (targetId) {
    return <Navigate to={workspacePath(targetId, location.pathname)} replace />;
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#020817] px-6 text-slate-100">
      <StarFieldBackground />
      <section className="orbit-panel relative z-10 w-full max-w-sm rounded-lg p-6">
        <OrbitFloLogo className="mb-6 max-w-56" showTagline />
        {workspacesQuery.isError || createdQuery.isError ? (
          <>
            <h1 className="text-lg font-semibold text-white">Could not open a workspace</h1>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              {(workspacesQuery.error ?? createdQuery.error)?.message}
            </p>
          </>
        ) : (
          <SatelliteLoader label="Finding your workspace" />
        )}
      </section>
    </main>
  );
}
