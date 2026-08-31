import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, LinkType } from "../../lib/supabase/database.types";

type Client = SupabaseClient<Database>;

export type ProjectLink = Database["public"]["Tables"]["project_links"]["Row"];

export const linkTypes = [
  "repository",
  "documentation",
  "design",
  "deployment",
  "issue_tracker",
  "other",
] as const satisfies readonly LinkType[];

const linkTypeLabels: Record<LinkType, string> = {
  repository: "Repository",
  documentation: "Documentation",
  design: "Design",
  deployment: "Deployment",
  issue_tracker: "Issue tracker",
  other: "Other",
};

export function linkTypeLabel(type: LinkType) {
  return linkTypeLabels[type];
}

/**
 * The http/https check is what stops a `javascript:` URL becoming a clickable
 * anchor, so every write goes through here.
 */
export function normalizeLinkUrl(value?: string | null): string {
  const trimmed = value?.trim();
  if (!trimmed) throw new Error("Links need a URL.");

  let url: URL;

  try {
    url = new URL(trimmed);
  } catch {
    throw new Error("Links must start with http:// or https://.");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Links must start with http:// or https://.");
  }

  return url.href;
}

/** Render-time guard for rows that reached the table without passing through a writer. */
export function safeLinkUrl(value: string): string | null {
  try {
    return normalizeLinkUrl(value);
  } catch {
    return null;
  }
}

function resolveLabel(label: string, linkType: LinkType) {
  return label.trim() || linkTypeLabel(linkType);
}

export async function listProjectLinks(
  client: Client,
  input: { workspaceId: string; projectId: string },
) {
  const { data, error } = await client
    .from("project_links")
    .select("*")
    .eq("workspace_id", input.workspaceId)
    .eq("project_id", input.projectId)
    .order("link_type", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function createProjectLink(
  client: Client,
  input: {
    workspaceId: string;
    projectId: string;
    userId: string;
    linkType: LinkType;
    label: string;
    url: string;
  },
) {
  const url = normalizeLinkUrl(input.url);

  const { data, error } = await client
    .from("project_links")
    .insert({
      workspace_id: input.workspaceId,
      project_id: input.projectId,
      created_by: input.userId,
      link_type: input.linkType,
      label: resolveLabel(input.label, input.linkType),
      url,
    })
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

export async function updateProjectLink(
  client: Client,
  input: { id: string; workspaceId: string; linkType: LinkType; label: string; url: string },
) {
  const url = normalizeLinkUrl(input.url);

  const { data, error } = await client
    .from("project_links")
    .update({
      link_type: input.linkType,
      label: resolveLabel(input.label, input.linkType),
      url,
    })
    .eq("id", input.id)
    .eq("workspace_id", input.workspaceId)
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

export async function deleteProjectLink(client: Client, input: { id: string; workspaceId: string }) {
  const { error } = await client
    .from("project_links")
    .delete()
    .eq("id", input.id)
    .eq("workspace_id", input.workspaceId);

  if (error) throw error;
}

/** Project id to repository URL, for the projects list card. */
export async function listRepositoryLinks(
  client: Client,
  input: { workspaceId: string; projectIds: string[] },
): Promise<Map<string, string>> {
  const byProject = new Map<string, string>();
  if (input.projectIds.length === 0) return byProject;

  const { data, error } = await client
    .from("project_links")
    .select("project_id, url")
    .eq("workspace_id", input.workspaceId)
    .eq("link_type", "repository")
    .in("project_id", input.projectIds)
    .order("created_at", { ascending: true });

  if (error) throw error;

  for (const row of (data ?? []) as Array<{ project_id: string; url: string }>) {
    if (byProject.has(row.project_id)) continue;
    const url = safeLinkUrl(row.url);
    if (url) byProject.set(row.project_id, url);
  }

  return byProject;
}
