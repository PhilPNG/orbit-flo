import type { SupabaseClient } from "@supabase/supabase-js";
import type { StatusTone } from "../../components/status-pill";
import type { Database, ProjectHealth, ProjectPriority, ProjectStatus } from "../../lib/supabase/database.types";
import { createProjectLink, normalizeLinkUrl } from "./project-links.queries";

type Client = SupabaseClient<Database>;

export interface CreateProjectInput {
  workspaceId: string;
  userId: string;
  name: string;
  description?: string;
  status: ProjectStatus;
  priority: ProjectPriority;
  health: ProjectHealth;
  repositoryUrl?: string;
}

export function projectHealthTone(health: ProjectHealth): StatusTone {
  if (health === "good") return "good";
  if (health === "watch") return "warning";
  return "danger";
}

/**
 * Supabase rejects with a PostgrestError, a plain object rather than an Error,
 * so an `instanceof Error` check alone would swallow the real reason.
 */
function linkFailureMessage(cause: unknown): string {
  if (cause instanceof Error) return cause.message;

  if (cause && typeof cause === "object" && "message" in cause) {
    const { message } = cause as { message: unknown };
    if (typeof message === "string" && message) return message;
  }

  return "The repository link could not be saved.";
}

export async function listProjects(client: Client, workspaceId: string) {
  const { data, error } = await client
    .from("projects")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("is_favorite", { ascending: false })
    .order("updated_at", { ascending: false });

  if (error) throw error;
  return data;
}

export async function updateProjectFavorite(
  client: Client,
  input: { id: string; workspaceId: string; isFavorite: boolean },
) {
  const { data, error } = await client
    .from("projects")
    .update({ is_favorite: input.isFavorite })
    .eq("id", input.id)
    .eq("workspace_id", input.workspaceId)
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

export async function getProject(client: Client, workspaceId: string, projectId: string) {
  const { data, error } = await client
    .from("projects")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("id", projectId)
    .single();

  if (error) throw error;
  return data;
}

export async function createProject(client: Client, input: CreateProjectInput) {
  // Validated before any write so a malformed URL cannot leave a project behind.
  const repositoryUrl = input.repositoryUrl?.trim() ? normalizeLinkUrl(input.repositoryUrl) : null;

  const { data, error } = await client
    .from("projects")
    .insert({
      workspace_id: input.workspaceId,
      created_by: input.userId,
      name: input.name,
      description: input.description || null,
      status: input.status,
      priority: input.priority,
      health: input.health,
    })
    .select("*")
    .single();

  if (error) throw error;

  if (!repositoryUrl) return { project: data, linkError: null };

  // The project exists by now. Throwing here would invite a retry that creates
  // a second project, so the failure is reported alongside the project instead.
  try {
    await createProjectLink(client, {
      workspaceId: input.workspaceId,
      projectId: data.id,
      userId: input.userId,
      linkType: "repository",
      label: "Repository",
      url: repositoryUrl,
    });
  } catch (cause) {
    return { project: data, linkError: linkFailureMessage(cause) };
  }

  return { project: data, linkError: null };
}
