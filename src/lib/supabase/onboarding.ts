import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { Database } from "./database.types";

type TypedClient = SupabaseClient<Database>;

export async function ensurePersonalWorkspace(
  client: TypedClient,
  user: Pick<User, "id" | "email">,
): Promise<{ id: string }> {
  const workspaceName = user.email
    ? `${user.email}'s Workspace`
    : "Personal Workspace";
  const { data: workspaceId, error: workspaceError } = await client.rpc(
    "create_personal_workspace",
    {
      workspace_name: workspaceName,
    },
  );

  if (workspaceError) throw workspaceError;
  if (!workspaceId) throw new Error("Workspace RPC did not return an id.");
  return { id: workspaceId };
}
