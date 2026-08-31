import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { OrbitFloLogo } from "../../components/orbit-flo-logo";
import { SatelliteLoader, StarFieldBackground } from "../../components/space-visuals";
import { supabase } from "../../lib/supabase/client";
import { WorkspaceProvider } from "./workspace-context";
import { listWorkspaces, workspacesQueryKey } from "./workspaces.queries";
import type { PropsWithChildren } from "react";

function WorkspaceNotice({ children }: PropsWithChildren) {
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

export function WorkspaceGate({ children }: PropsWithChildren) {
  const { workspaceId } = useParams();
  const workspacesQuery = useQuery({
    queryKey: workspacesQueryKey,
    queryFn: () => listWorkspaces(supabase),
  });

  if (workspacesQuery.isPending) {
    return (
      <WorkspaceNotice>
        <SatelliteLoader label="Opening workspace" />
      </WorkspaceNotice>
    );
  }

  if (workspacesQuery.isError) {
    return (
      <WorkspaceNotice>
        <h1 className="text-lg font-semibold text-white">Could not load your workspaces</h1>
        <p className="mt-2 text-sm leading-6 text-slate-400">{workspacesQuery.error.message}</p>
      </WorkspaceNotice>
    );
  }

  const isMember = (workspacesQuery.data ?? []).some((workspace) => workspace.id === workspaceId);

  // RLS returns nothing rather than erroring, so "not yours" and "does not
  // exist" are indistinguishable here — and to the reader they mean the same.
  if (!workspaceId || !isMember) {
    return (
      <WorkspaceNotice>
        <h1 className="text-lg font-semibold text-white">This workspace is not yours to open.</h1>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          It may have been deleted, or your access removed.
        </p>
        <Link className="orbit-button mt-4" to="/">
          Go to your workspace
        </Link>
      </WorkspaceNotice>
    );
  }

  return <WorkspaceProvider workspaceId={workspaceId}>{children}</WorkspaceProvider>;
}
