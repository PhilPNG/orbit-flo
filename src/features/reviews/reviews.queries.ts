import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, ProjectHealth } from "../../lib/supabase/database.types";

type Client = SupabaseClient<Database>;

export const weeklyReviewKeys = {
  workspace: (workspaceId: string) => ["weekly-reviews", workspaceId] as const,
  project: (workspaceId: string, projectId: string) =>
    [...weeklyReviewKeys.workspace(workspaceId), "project", projectId] as const,
};

export function reviewHealthLabel(health: ProjectHealth): string {
  return health.replaceAll("_", " ");
}

export async function listWeeklyReviews(client: Client, workspaceId: string, projectId?: string) {
  let query = client
    .from("weekly_reviews")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("week_start", { ascending: false });

  if (projectId) query = query.eq("project_id", projectId);

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function createWeeklyReview(
  client: Client,
  input: {
    workspaceId: string;
    projectId?: string;
    userId: string;
    weekStart: string;
    wins?: string;
    blockers?: string;
    nextFocus?: string;
    health?: ProjectHealth;
  },
) {
  const { data, error } = await client
    .from("weekly_reviews")
    .insert({
      workspace_id: input.workspaceId,
      project_id: input.projectId || null,
      created_by: input.userId,
      week_start: input.weekStart,
      wins: input.wins || null,
      blockers: input.blockers || null,
      next_focus: input.nextFocus || null,
      health: input.health || null,
    })
    .select("*")
    .single();

  if (error) throw error;
  return data;
}
