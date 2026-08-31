import type { SupabaseClient } from "@supabase/supabase-js";
import type { CaptureType, Database } from "../../lib/supabase/database.types";

type Client = SupabaseClient<Database>;

export async function listInboxCaptures(client: Client, workspaceId: string) {
  const { data, error } = await client
    .from("captures")
    .select("*")
    .eq("workspace_id", workspaceId)
    .is("processed_at", null)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data;
}

export async function updateCapture(
  client: Client,
  input: {
    id: string;
    workspaceId: string;
    projectId?: string | null;
    workItemId?: string | null;
    type?: CaptureType;
    title?: string;
    body?: string;
    processedAt?: string | null;
  },
) {
  const { data, error } = await client
    .from("captures")
    .update({
      project_id: input.projectId,
      work_item_id: input.workItemId,
      type: input.type,
      title: input.title,
      body: input.body,
      processed_at: input.processedAt,
    })
    .eq("id", input.id)
    .eq("workspace_id", input.workspaceId)
    .select("*")
    .single();

  if (error) throw error;
  return data;
}
