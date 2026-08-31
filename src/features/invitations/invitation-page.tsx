import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { OrbitFloLogo } from "../../components/orbit-flo-logo";
import { SatelliteLoader, StarFieldBackground } from "../../components/space-visuals";
import { supabase } from "../../lib/supabase/client";
import { useAuth } from "../auth/use-auth";
import { workspacePath } from "../workspaces/workspace-path";
import { workspacesQueryKey } from "../workspaces/workspaces.queries";
import { acceptInvitation, previewInvitation } from "./invitations.queries";
import { clearPendingInvitation, storePendingInvitation } from "./pending-invitation";
import type { PropsWithChildren } from "react";

function InvitationShell({ children }: PropsWithChildren) {
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

export function InvitationPage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isLoading: isAuthLoading, user } = useAuth();

  const previewQuery = useQuery({
    queryKey: ["invitation", token],
    queryFn: () => previewInvitation(supabase, token ?? ""),
    enabled: Boolean(token),
  });

  const acceptMutation = useMutation({
    mutationFn: () => acceptInvitation(supabase, token ?? ""),
    onSuccess: async (workspaceId) => {
      clearPendingInvitation();
      await queryClient.invalidateQueries({ queryKey: workspacesQueryKey });
      navigate(workspacePath(workspaceId, "/"), { replace: true });
    },
  });

  if (isAuthLoading || previewQuery.isPending) {
    return (
      <InvitationShell>
        <SatelliteLoader label="Opening invitation" />
      </InvitationShell>
    );
  }

  const preview = previewQuery.data ?? null;

  // Each failure has a different remedy, so each says something different.
  if (previewQuery.isError || !preview) {
    return (
      <InvitationShell>
        <h1 className="text-lg font-semibold text-white">This invitation could not be found.</h1>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          The link may be incomplete, or the invitation may have been revoked.
        </p>
      </InvitationShell>
    );
  }

  if (preview.isAccepted) {
    return (
      <InvitationShell>
        <h1 className="text-lg font-semibold text-white">This invitation has already been used.</h1>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          If it was you, {preview.workspaceName} is already in your workspace list.
        </p>
        <Link className="orbit-button mt-4" to="/">
          Go to your workspace
        </Link>
      </InvitationShell>
    );
  }

  if (preview.isExpired) {
    return (
      <InvitationShell>
        <h1 className="text-lg font-semibold text-white">This invitation has expired.</h1>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          Invitations last seven days. Ask {preview.invitedByName} for a fresh link.
        </p>
      </InvitationShell>
    );
  }

  if (!user) {
    return (
      <InvitationShell>
        <p className="mission-label">You are invited</p>
        <h1 className="mt-2 text-2xl font-black text-white">
          {preview.invitedByName} invited you to {preview.workspaceName}.
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          Sign in as {preview.email} to accept.
        </p>
        <Link
          className="orbit-button mt-4"
          onClick={() => storePendingInvitation(token ?? "")}
          to="/auth"
        >
          Sign in to accept
        </Link>
      </InvitationShell>
    );
  }

  const isWrongAccount = user.email?.toLowerCase() !== preview.email.toLowerCase();

  return (
    <InvitationShell>
      <p className="mission-label">You are invited</p>
      <h1 className="mt-2 text-2xl font-black text-white">
        {preview.invitedByName} invited you to {preview.workspaceName}.
      </h1>

      {isWrongAccount ? (
        <>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            This invitation was sent to {preview.email}, but you are signed in as {user.email}.
          </p>
          <Link className="orbit-button-secondary mt-4" to="/settings">
            Switch account in Settings
          </Link>
        </>
      ) : (
        <>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            Accepting adds {preview.workspaceName} to your workspaces.
          </p>

          {acceptMutation.isError ? (
            <p
              className="mt-4 rounded-md border border-violet-300/35 bg-violet-400/10 px-3 py-2 text-sm text-violet-100"
              role="alert"
            >
              {acceptMutation.error.message}
            </p>
          ) : null}

          <button
            className="orbit-button mt-4 w-full"
            disabled={acceptMutation.isPending}
            onClick={() => acceptMutation.mutate()}
            type="button"
          >
            {acceptMutation.isPending ? "Joining..." : "Accept invitation"}
          </button>
        </>
      )}
    </InvitationShell>
  );
}
