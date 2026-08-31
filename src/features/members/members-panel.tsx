import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LogOut, UserMinus } from "lucide-react";
import { QuietPanel, SectionHeader } from "../../components/minimal-layout";
import { supabase } from "../../lib/supabase/client";
import type { WorkspaceRole } from "../../lib/supabase/database.types";
import { useAuth } from "../auth/use-auth";
import { MemberAvatar } from "../profiles/member-avatar";
import { useWorkspaceId } from "../workspaces/workspace-context";
import { workspacesQueryKey } from "../workspaces/workspaces.queries";
import {
  assignableRoles,
  leaveWorkspace,
  listMembers,
  membersQueryKey,
  removeMember,
  setMemberRole,
} from "./members.queries";

export function MembersPanel() {
  const queryClient = useQueryClient();
  const workspaceId = useWorkspaceId();
  const { user } = useAuth();

  const membersQuery = useQuery({
    queryKey: membersQueryKey(workspaceId),
    queryFn: () => listMembers(supabase, workspaceId),
  });

  const members = membersQuery.data ?? [];
  const me = members.find((member) => member.userId === user?.id);
  const isOwner = me?.role === "owner";

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: membersQueryKey(workspaceId) });
  }

  const roleMutation = useMutation({
    mutationFn: (input: { id: string; role: WorkspaceRole }) => setMemberRole(supabase, input),
    onSuccess: refresh,
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => removeMember(supabase, { id }),
    onSuccess: refresh,
  });

  const leaveMutation = useMutation({
    mutationFn: () => leaveWorkspace(supabase, { workspaceId, userId: user?.id ?? "" }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: workspacesQueryKey });
      // The resolver picks another workspace, or offers to make one.
      window.location.assign("/");
    },
  });

  const error =
    roleMutation.error?.message ?? removeMutation.error?.message ?? leaveMutation.error?.message;

  return (
    <QuietPanel aria-label="Members">
      <SectionHeader title="Members">Who can see and change this workspace.</SectionHeader>

      {membersQuery.isError ? (
        <p className="mt-5 text-sm text-rose-200" role="alert">
          {membersQuery.error.message}
        </p>
      ) : null}

      <ul className="mt-5 grid gap-1.5">
        {members.map((member) => {
          const isMe = member.userId === user?.id;

          return (
            <li
              className="flex items-center gap-2.5 rounded-lg border border-slate-400/10 bg-white/[0.02] px-3 py-2"
              key={member.id}
            >
              <MemberAvatar displayName={member.displayName} size="sm" userId={member.userId} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-white">
                  {member.displayName}
                  {isMe ? <span className="ml-1 text-xs text-slate-500">(you)</span> : null}
                </span>
              </span>

              {/* A co-owner can be demoted or removed like anyone else. The
                  last owner cannot: enforce_owner_survives refuses, on every
                  path rather than only through this control. */}
              {isOwner && !isMe ? (
                <select
                  aria-label={`Role for ${member.displayName}`}
                  className="orbit-input w-28 shrink-0"
                  disabled={roleMutation.isPending}
                  onChange={(event) =>
                    roleMutation.mutate({
                      id: member.id,
                      role: event.target.value as WorkspaceRole,
                    })
                  }
                  value={member.role}
                >
                  {assignableRoles.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="shrink-0 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {member.role}
                </span>
              )}

              {isOwner && !isMe ? (
                <button
                  aria-label={`Remove ${member.displayName}`}
                  className="orbit-field-icon-button shrink-0"
                  disabled={removeMutation.isPending}
                  onClick={() => removeMutation.mutate(member.id)}
                  type="button"
                >
                  <UserMinus aria-hidden="true" className="h-4 w-4" />
                </button>
              ) : null}
            </li>
          );
        })}
      </ul>

      {error ? (
        <p className="mt-3 text-sm text-rose-200" role="alert">
          {error}
        </p>
      ) : null}

      {me ? (
        <div className="mt-5 border-t border-slate-400/10 pt-4">
          <button
            className="orbit-button-danger-quiet"
            disabled={leaveMutation.isPending}
            onClick={() => leaveMutation.mutate()}
            type="button"
          >
            <LogOut aria-hidden="true" size={16} />
            {leaveMutation.isPending ? "Leaving..." : "Leave workspace"}
          </button>
          <p className="mt-2 text-xs text-slate-500">
            A workspace always keeps at least one owner, so the last one cannot leave.
          </p>
        </div>
      ) : null}
    </QuietPanel>
  );
}
