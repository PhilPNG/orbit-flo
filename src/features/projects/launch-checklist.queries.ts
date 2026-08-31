import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "../../lib/supabase/database.types";

type Client = SupabaseClient<Database>;
type LaunchChecklist = Database["public"]["Tables"]["launch_checklists"]["Row"];

export type LaunchChecklistItem = {
  id: string;
  label: string;
  isDone: boolean;
};

export type LaunchChecklistValues = {
  title: string;
  checklistItems: LaunchChecklistItem[];
  milestoneId?: string | null;
  completedAt?: string | null;
};

export async function listLaunchChecklists(client: Client, workspaceId: string, projectId: string) {
  const { data, error } = await client
    .from("launch_checklists")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("project_id", projectId)
    .order("updated_at", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data as LaunchChecklist[];
}

export async function createLaunchChecklist(
  client: Client,
  input: LaunchChecklistValues & { workspaceId: string; projectId: string; userId: string },
) {
  const { data, error } = await client
    .from("launch_checklists")
    .insert({
      workspace_id: input.workspaceId,
      project_id: input.projectId,
      created_by: input.userId,
      title: input.title,
      milestone_id: input.milestoneId ?? null,
      checklist_items: input.checklistItems as unknown as Json,
      completed_at: input.completedAt ?? null,
    })
    .select("*")
    .single();

  if (error) throw error;
  return data as LaunchChecklist;
}

export async function updateLaunchChecklist(
  client: Client,
  input: LaunchChecklistValues & { id: string; workspaceId: string; projectId: string },
) {
  const { data, error } = await client
    .from("launch_checklists")
    .update({
      title: input.title,
      milestone_id: input.milestoneId ?? null,
      checklist_items: input.checklistItems as unknown as Json,
      completed_at: input.completedAt ?? null,
    })
    .eq("id", input.id)
    .eq("workspace_id", input.workspaceId)
    .eq("project_id", input.projectId)
    .select("*")
    .single();

  if (error) throw error;
  return data as LaunchChecklist;
}
