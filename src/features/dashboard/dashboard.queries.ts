import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, ProjectPriority } from "../../lib/supabase/database.types";

type Client = SupabaseClient<Database>;
type WorkItem = Database["public"]["Tables"]["work_items"]["Row"];

const priorityRank: Record<ProjectPriority, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export function sortPriorityWork<T extends { priority: ProjectPriority; updated_at: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const priorityDelta = priorityRank[a.priority] - priorityRank[b.priority];
    if (priorityDelta !== 0) return priorityDelta;
    return b.updated_at.localeCompare(a.updated_at);
  });
}

export async function getDashboardData(client: Client, workspaceId: string) {
  const [projects, workItems, milestones, decisions] = await Promise.all([
    client.from("projects").select("*").eq("workspace_id", workspaceId).order("updated_at", { ascending: false }),
    client.from("work_items").select("*").eq("workspace_id", workspaceId).neq("status", "done"),
    client
      .from("milestones")
      .select("*")
      .eq("workspace_id", workspaceId)
      .is("completed_at", null)
      .order("target_date", { ascending: true }),
    client
      .from("notes")
      .select("*")
      .eq("workspace_id", workspaceId)
      .eq("note_type", "decision")
      .order("updated_at", { ascending: false })
      .limit(5),
  ]);

  if (projects.error) throw projects.error;
  if (workItems.error) throw workItems.error;
  if (milestones.error) throw milestones.error;
  if (decisions.error) throw decisions.error;

  const activeWork = workItems.data as WorkItem[];

  return {
    projects: projects.data,
    priorityWork: sortPriorityWork(activeWork),
    blockedWork: activeWork.filter((item) => item.status === "blocked"),
    upcomingMilestones: milestones.data.slice(0, 8),
    recentDecisions: decisions.data,
  };
}
