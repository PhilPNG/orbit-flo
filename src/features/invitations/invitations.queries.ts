import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, WorkspaceRole } from "../../lib/supabase/database.types";

type Client = SupabaseClient<Database>;

export type Invitation = Database["public"]["Tables"]["workspace_invitations"]["Row"];

export type InvitationPreview = {
  workspaceName: string;
  invitedByName: string;
  email: string;
  isExpired: boolean;
  isAccepted: boolean;
};

/** Every role a person can be invited as. viewer is not one: see 202608200002. */
export const invitableRoles = ["member", "admin", "owner"] as const satisfies readonly WorkspaceRole[];

export const invitationsQueryKey = (workspaceId: string) =>
  ["workspace-invitations", workspaceId] as const;

export function invitationLink(token: string) {
  return `${window.location.origin}/invite/${token}`;
}

export async function listInvitations(client: Client, workspaceId: string): Promise<Invitation[]> {
  const { data, error } = await client
    .from("workspace_invitations")
    .select("*")
    .eq("workspace_id", workspaceId)
    .is("accepted_at", null)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as Invitation[];
}

export async function createInvitation(
  client: Client,
  input: { workspaceId: string; email: string; role: WorkspaceRole },
): Promise<Invitation> {
  const email = input.email.trim().toLowerCase();

  // Catch an obvious typo without a round trip. The real check is the
  // recipient being able to sign in as this address.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("That does not look like an email address.");
  }

  const { data, error } = await client.rpc("create_workspace_invitation", {
    target_workspace_id: input.workspaceId,
    target_email: email,
    target_role: input.role,
  });

  if (error) throw error;
  return data as Invitation;
}

export async function revokeInvitation(client: Client, input: { id: string }) {
  const { error } = await client.from("workspace_invitations").delete().eq("id", input.id);

  if (error) throw error;
}

export async function previewInvitation(
  client: Client,
  token: string,
): Promise<InvitationPreview | null> {
  const { data, error } = await client.rpc("preview_workspace_invitation", {
    invitation_token: token,
  });

  if (error) throw error;

  const row = (data as Array<Record<string, unknown>> | null)?.[0];
  if (!row) return null;

  return {
    workspaceName: row.workspace_name as string,
    invitedByName: row.invited_by_name as string,
    email: row.email as string,
    isExpired: Boolean(row.is_expired),
    isAccepted: Boolean(row.is_accepted),
  };
}

export async function acceptInvitation(client: Client, token: string): Promise<string> {
  const { data, error } = await client.rpc("accept_workspace_invitation", {
    invitation_token: token,
  });

  if (error) throw error;
  return data as string;
}
