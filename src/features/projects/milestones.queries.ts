import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../lib/supabase/database.types";

type Client = SupabaseClient<Database>;

export async function listProjectMilestones(client: Client, workspaceId: string, projectId: string) {
  const { data, error } = await client
    .from("milestones")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("project_id", projectId)
    .order("target_date", { ascending: true, nullsFirst: false })
    .order("sort_order", { ascending: true });

  if (error) throw error;
  return data;
}

export async function createMilestone(
  client: Client,
  input: {
    workspaceId: string;
    projectId: string;
    userId: string;
    title: string;
    description?: string;
    targetDate?: string;
    sortOrder?: number;
  },
) {
  const { data, error } = await client
    .from("milestones")
    .insert({
      workspace_id: input.workspaceId,
      project_id: input.projectId,
      created_by: input.userId,
      title: input.title,
      description: input.description || null,
      target_date: input.targetDate || null,
      sort_order: input.sortOrder ?? 0,
    })
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

export async function updateMilestone(
  client: Client,
  input: {
    id: string;
    workspaceId: string;
    projectId: string;
    title: string;
    description?: string;
    targetDate?: string;
    completedAt?: string | null;
    sortOrder?: number;
  },
) {
  const { data, error } = await client
    .from("milestones")
    .update({
      title: input.title,
      description: input.description || null,
      target_date: input.targetDate || null,
      completed_at: input.completedAt ?? null,
      sort_order: input.sortOrder ?? 0,
    })
    .eq("id", input.id)
    .eq("workspace_id", input.workspaceId)
    .eq("project_id", input.projectId)
    .select("*")
    .single();

  if (error) throw error;
  return data;
}
