import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../lib/supabase/database.types";

type Client = SupabaseClient<Database>;
type ProjectBrief = Database["public"]["Tables"]["project_briefs"]["Row"];

export type ProjectBriefValues = {
  goal: string;
  audience: string;
  successCriteria: string;
  constraints: string;
  statusSummary: string;
  nextMilestone: string;
};

export async function getProjectBrief(client: Client, workspaceId: string, projectId: string) {
  const { data, error } = await client
    .from("project_briefs")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("project_id", projectId)
    .maybeSingle();

  if (error) throw error;
  return data as ProjectBrief | null;
}

export async function upsertProjectBrief(
  client: Client,
  input: ProjectBriefValues & { workspaceId: string; projectId: string; userId: string },
) {
  const editableValues = {
    goal: input.goal,
    audience: input.audience,
    success_criteria: input.successCriteria,
    constraints: input.constraints,
    status_summary: input.statusSummary,
    next_milestone: input.nextMilestone,
  };
  const existingBrief = await getProjectBrief(client, input.workspaceId, input.projectId);

  async function updateExistingBrief() {
    const { data, error } = await client
      .from("project_briefs")
      .update(editableValues)
      .eq("workspace_id", input.workspaceId)
      .eq("project_id", input.projectId)
      .select("*")
      .single();

    if (error) throw error;
    return data as ProjectBrief;
  }

  if (existingBrief) {
    return updateExistingBrief();
  }

  const { data, error } = await client
    .from("project_briefs")
    .insert({
      workspace_id: input.workspaceId,
      project_id: input.projectId,
      created_by: input.userId,
      goal: input.goal,
      audience: input.audience,
      success_criteria: input.successCriteria,
      constraints: input.constraints,
      status_summary: input.statusSummary,
      next_milestone: input.nextMilestone,
    })
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505") {
      return updateExistingBrief();
    }

    throw error;
  }
  return data as ProjectBrief;
}
