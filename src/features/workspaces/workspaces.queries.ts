import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../lib/supabase/database.types";

type Client = SupabaseClient<Database>;

export type WorkspaceSummary = { id: string; name: string };

/** Shared by the gate, the redirect, the switcher, and the rename control. */
export const workspacesQueryKey = ["workspaces"] as const;

/** RLS narrows this to workspaces the caller belongs to or created. */
export async function listWorkspaces(client: Client): Promise<WorkspaceSummary[]> {
  const { data, error } = await client
    .from("workspaces")
    .select("id, name")
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });

  if (error) throw error;
  return (data ?? []) as WorkspaceSummary[];
}

/**
 * An RPC rather than an insert, because workspaces has no insert grant and the
 * owner membership must be written atomically with the workspace.
 */
export async function createWorkspace(client: Client, name: string): Promise<string> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Workspaces need a name.");

  const { data, error } = await client.rpc("create_workspace", { workspace_name: trimmed });

  if (error) throw error;
  if (!data) throw new Error("The workspace was not created.");
  return data;
}

export async function renameWorkspace(client: Client, input: { id: string; name: string }) {
  const trimmed = input.name.trim();
  if (!trimmed) throw new Error("Workspaces need a name.");

  const { data, error } = await client
    .from("workspaces")
    .update({ name: trimmed })
    .eq("id", input.id)
    .select("id, name")
    .single();

  if (error) throw error;
  return data;
}
