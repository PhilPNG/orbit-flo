import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../lib/supabase/database.types";

type Client = SupabaseClient<Database>;
export type ProjectRitual = Database["public"]["Tables"]["project_rituals"]["Row"];

export const defaultProjectRituals = [
  "Weekly review ritual",
  "Backlog cleanup ritual",
  "Milestone check ritual",
  "Release prep ritual",
] as const;

export const projectRitualsKeys = {
  list: (workspaceId: string, projectId: string) => ["project-rituals", workspaceId, projectId] as const,
};

export async function listProjectRituals(client: Client, input: { workspaceId: string; projectId: string }) {
  const { data, error } = await client
    .from("project_rituals")
    .select("*")
    .eq("workspace_id", input.workspaceId)
    .eq("project_id", input.projectId)
    .order("sort_order", { ascending: true });

  if (error) throw error;
  return data;
}

export async function ensureDefaultProjectRituals(
  client: Client,
  input: { workspaceId: string; projectId: string; userId: string },
) {
  const existing = await listProjectRituals(client, input);
  if (existing.length > 0) return existing;

  const { data, error } = await client
    .from("project_rituals")
    .insert(
      defaultProjectRituals.map((title, index) => ({
        workspace_id: input.workspaceId,
        project_id: input.projectId,
        created_by: input.userId,
        title,
        sort_order: index,
      })),
    )
    .select("*")
    .order("sort_order", { ascending: true });

  if (error) throw error;
  return data;
}

export async function createProjectRitual(
  client: Client,
  input: { workspaceId: string; projectId: string; userId: string; title: string; sortOrder: number },
) {
  const { data, error } = await client
    .from("project_rituals")
    .insert({
      workspace_id: input.workspaceId,
      project_id: input.projectId,
      created_by: input.userId,
      title: input.title.trim(),
      sort_order: input.sortOrder,
    })
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

export async function renameProjectRitual(client: Client, input: { id: string; workspaceId: string; title: string }) {
  const { data, error } = await client
    .from("project_rituals")
    .update({ title: input.title.trim() })
    .eq("id", input.id)
    .eq("workspace_id", input.workspaceId)
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

export async function toggleProjectRitual(client: Client, input: { id: string; workspaceId: string; isDone: boolean }) {
  const { data, error } = await client
    .from("project_rituals")
    .update({ is_done: input.isDone })
    .eq("id", input.id)
    .eq("workspace_id", input.workspaceId)
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

export async function deleteProjectRitual(client: Client, input: { id: string; workspaceId: string }) {
  const { error } = await client
    .from("project_rituals")
    .delete()
    .eq("id", input.id)
    .eq("workspace_id", input.workspaceId);

  if (error) throw error;
}

export async function updateProjectRitualsTitle(
  client: Client,
  input: { workspaceId: string; projectId: string; ritualsTitle: string },
) {
  const { error } = await client
    .from("projects")
    .update({ rituals_title: input.ritualsTitle.trim() })
    .eq("workspace_id", input.workspaceId)
    .eq("id", input.projectId);

  if (error) throw error;
}
