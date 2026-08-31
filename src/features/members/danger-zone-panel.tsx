import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { QuietPanel, SectionHeader } from "../../components/minimal-layout";
import { supabase } from "../../lib/supabase/client";
import { useAuth } from "../auth/use-auth";
import { useWorkspaceId } from "../workspaces/workspace-context";
import { listWorkspaces, workspacesQueryKey } from "../workspaces/workspaces.queries";
import { deleteWorkspace, listMembers, membersQueryKey } from "./members.queries";

export function DangerZonePanel() {
  const queryClient = useQueryClient();
  const workspaceId = useWorkspaceId();
  const { user } = useAuth();
  const [confirmName, setConfirmName] = useState("");

  const workspacesQuery = useQuery({
    queryKey: workspacesQueryKey,
    queryFn: () => listWorkspaces(supabase),
  });
  const membersQuery = useQuery({
    queryKey: membersQueryKey(workspaceId),
    queryFn: () => listMembers(supabase, workspaceId),
  });

  const workspace = (workspacesQuery.data ?? []).find((entry) => entry.id === workspaceId);
  const isOwner = (membersQuery.data ?? []).some(
    (member) => member.userId === user?.id && member.role === "owner",
  );

  const deleteMutation = useMutation({
    mutationFn: () =>
      deleteWorkspace(supabase, {
        id: workspaceId,
        name: workspace?.name ?? "",
        confirmName,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: workspacesQueryKey });
      window.location.assign("/");
    },
  });

  // Only an owner can delete, and the policy enforces it regardless — but
  // showing the control to someone who cannot use it is just a trap.
  if (!isOwner || !workspace) return null;

  return (
    <QuietPanel aria-label="Delete workspace">
      <SectionHeader title="Delete this workspace">
        Everything in it goes: projects, tasks, notes, maps, and every member's access. This cannot
        be undone.
      </SectionHeader>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <input
          aria-label="Type the workspace name to confirm"
          className="orbit-input min-w-0 flex-1 sm:max-w-72"
          onChange={(event) => setConfirmName(event.target.value)}
          placeholder={workspace.name}
          value={confirmName}
        />
        <button
          className="orbit-button-danger-quiet shrink-0 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={deleteMutation.isPending || confirmName.trim() !== workspace.name}
          onClick={() => deleteMutation.mutate()}
          type="button"
        >
          {deleteMutation.isPending ? "Deleting..." : "Delete workspace"}
        </button>
      </div>

      {deleteMutation.isError ? (
        <p className="mt-3 text-sm text-rose-200" role="alert">
          {deleteMutation.error.message}
        </p>
      ) : null}
    </QuietPanel>
  );
}
