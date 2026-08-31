import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../lib/supabase/database.types";

type Client = SupabaseClient<Database>;

export type MilestoneDetail = {
  id: string;
  projectId: string;
  projectName: string | null;
  title: string;
  description: string;
  targetDate: string | null;
  completedAt: string | null;
  tasks: Array<{ id: string; title: string }>;
};

export const milestoneQueryKey = (workspaceId: string, milestoneId: string) =>
  ["milestone", workspaceId, milestoneId] as const;

/**
 * Returns null rather than throwing when the milestone is absent OR hidden by
 * RLS. A member of another workspace must not be able to tell those apart.
 */
export async function loadMilestone(
  client: Client,
  input: { workspaceId: string; milestoneId: string },
): Promise<MilestoneDetail | null> {
  const { data, error } = await client
    .from("milestones")
    .select("id, project_id, title, description, target_date, completed_at")
    .eq("workspace_id", input.workspaceId)
    .eq("id", input.milestoneId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const row = data as {
    id: string;
    project_id: string;
    title: string;
    description: string | null;
    target_date: string | null;
    completed_at: string | null;
  };

  // Two by-id reads rather than embeds: note_links already proved that naming
  // auto-generated composite constraints is fragile, and these are cheap.
  const [project, tasks] = await Promise.all([
    client.from("projects").select("name").eq("id", row.project_id).maybeSingle(),
    client
      .from("work_items")
      .select("id, title")
      .eq("workspace_id", input.workspaceId)
      .eq("milestone_id", row.id)
      .order("sort_order", { ascending: true }),
  ]);

  if (project.error) throw project.error;
  if (tasks.error) throw tasks.error;

  return {
    id: row.id,
    projectId: row.project_id,
    projectName: (project.data as { name: string } | null)?.name ?? null,
    title: row.title,
    description: row.description ?? "",
    targetDate: row.target_date,
    completedAt: row.completed_at,
    tasks: (tasks.data ?? []) as Array<{ id: string; title: string }>,
  };
}
