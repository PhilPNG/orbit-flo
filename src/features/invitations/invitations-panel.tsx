import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Field } from "../../components/field";
import { QuietPanel, SectionHeader } from "../../components/minimal-layout";
import { supabase } from "../../lib/supabase/client";
import type { WorkspaceRole } from "../../lib/supabase/database.types";
import { useWorkspaceId } from "../workspaces/workspace-context";
import {
  createInvitation,
  invitableRoles,
  invitationLink,
  invitationsQueryKey,
  listInvitations,
  revokeInvitation,
} from "./invitations.queries";

function formatExpiry(value: string) {
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function InvitationsPanel() {
  const queryClient = useQueryClient();
  const workspaceId = useWorkspaceId();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<WorkspaceRole>("member");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const invitationsQuery = useQuery({
    queryKey: invitationsQueryKey(workspaceId),
    queryFn: () => listInvitations(supabase, workspaceId),
  });

  const createMutation = useMutation({
    mutationFn: () => createInvitation(supabase, { workspaceId, email, role }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: invitationsQueryKey(workspaceId) });
      setEmail("");
    },
  });

  const revokeMutation = useMutation({
    mutationFn: (id: string) => revokeInvitation(supabase, { id }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: invitationsQueryKey(workspaceId) }),
  });

  async function copyLink(token: string, id: string) {
    await navigator.clipboard.writeText(invitationLink(token));
    setCopiedId(id);
    window.setTimeout(() => setCopiedId(null), 2000);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    createMutation.mutate();
  }

  // A failed list degrades to the create form rather than breaking Settings.
  const invitations = invitationsQuery.data ?? [];

  return (
    <QuietPanel aria-label="Invitations">
      <SectionHeader title="Invite people">
        Create a link and share it however you like. It expires after seven days.
      </SectionHeader>

      <form className="mt-5 grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,8rem)_auto]" onSubmit={submit}>
        <Field label="Email">
          <input
            className="orbit-input"
            onChange={(event) => setEmail(event.target.value)}
            placeholder="teammate@example.com"
            value={email}
          />
        </Field>

        <Field label="Role">
          <select
            className="orbit-input"
            onChange={(event) => setRole(event.target.value as WorkspaceRole)}
            value={role}
          >
            {invitableRoles.map((invitableRole) => (
              <option key={invitableRole} value={invitableRole}>
                {invitableRole}
              </option>
            ))}
          </select>
        </Field>

        <div className="flex items-end">
          <button
            className="orbit-button-secondary w-full disabled:cursor-not-allowed disabled:opacity-60"
            disabled={createMutation.isPending || !email.trim()}
            type="submit"
          >
            {createMutation.isPending ? "Creating..." : "Create invite"}
          </button>
        </div>
      </form>

      {createMutation.isError ? (
        <p className="mt-3 text-sm text-rose-200" role="alert">
          {createMutation.error.message}
        </p>
      ) : null}

      {revokeMutation.isError ? (
        <p className="mt-3 text-sm text-rose-200" role="alert">
          {revokeMutation.error.message}
        </p>
      ) : null}

      {invitations.length > 0 ? (
        <ul className="mt-5 grid gap-1.5">
          {invitations.map((invitation) => (
            <li
              className="flex items-center gap-2.5 rounded-lg border border-slate-400/10 bg-white/[0.02] px-3 py-2"
              key={invitation.id}
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-white">
                  {invitation.email}
                </span>
                <span className="block truncate text-xs text-slate-500">
                  {invitation.role} · expires {formatExpiry(invitation.expires_at)}
                </span>
              </span>
              <button
                aria-label={`Copy invite link for ${invitation.email}`}
                className="orbit-field-icon-button shrink-0"
                onClick={() => void copyLink(invitation.token, invitation.id)}
                type="button"
              >
                {copiedId === invitation.id ? (
                  <Check aria-hidden="true" className="h-4 w-4 text-emerald-300" />
                ) : (
                  <Copy aria-hidden="true" className="h-4 w-4" />
                )}
              </button>
              <button
                aria-label={`Revoke invite for ${invitation.email}`}
                className="orbit-field-icon-button shrink-0"
                disabled={revokeMutation.isPending}
                onClick={() => revokeMutation.mutate(invitation.id)}
                type="button"
              >
                <Trash2 aria-hidden="true" className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-5 text-sm text-slate-400">No invitations waiting.</p>
      )}
    </QuietPanel>
  );
}
