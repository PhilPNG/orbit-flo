import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, WorkspaceRole } from "../../lib/supabase/database.types";

type Client = SupabaseClient<Database>;

export type Member = {
  id: string;
  userId: string;
  role: WorkspaceRole;
  displayName: string;
};

export const membersQueryKey = (workspaceId: string) => ["workspace-members", workspaceId] as const;

/**
 * owner is assignable: several owners may coexist, and any of them may demote
 * another. enforce_owner_survives refuses the last one, so the invariant is
 * held by the database rather than by hiding the control.
 */
export const assignableRoles = ["owner", "admin", "member"] as const satisfies readonly WorkspaceRole[];

export async function listMembers(client: Client, workspaceId: string): Promise<Member[]> {
  const { data, error } = await client
    .from("workspace_members")
    .select("id, user_id, role, profiles(display_name)")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: true });

  if (error) throw error;

  return ((data ?? []) as unknown as Array<{
    id: string;
    user_id: string;
    role: WorkspaceRole;
    profiles: { display_name: string } | null;
  }>).map((row) => ({
    id: row.id,
    userId: row.user_id,
    role: row.role,
    // A member whose profile is not readable still appears — they are in the
    // workspace, and hiding them would misrepresent who has access.
    displayName: row.profiles?.display_name ?? "Unknown member",
  }));
}

export async function setMemberRole(
  client: Client,
  input: { id: string; role: WorkspaceRole },
) {
  const { error } = await client
    .from("workspace_members")
    .update({ role: input.role })
    .eq("id", input.id);

  if (error) throw error;
}

export async function removeMember(client: Client, input: { id: string }) {
  const { error } = await client.from("workspace_members").delete().eq("id", input.id);

  if (error) throw error;
}

/** Leaving is removing your own row; the database stops the last owner. */
export async function leaveWorkspace(
  client: Client,
  input: { workspaceId: string; userId: string },
) {
  const { error } = await client
    .from("workspace_members")
    .delete()
    .eq("workspace_id", input.workspaceId)
    .eq("user_id", input.userId);

  if (error) throw error;
}

export async function deleteWorkspace(client: Client, input: { id: string; confirmName: string; name: string }) {
  // Typing the name is the guard: this cascades through every table in the
  // schema and cannot be undone.
  if (input.confirmName.trim() !== input.name) {
    throw new Error("Type the workspace name exactly to confirm.");
  }

  const { error } = await client.from("workspaces").delete().eq("id", input.id);

  if (error) throw error;
}
