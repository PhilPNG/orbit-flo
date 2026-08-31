import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../lib/supabase/database.types";

type Client = SupabaseClient<Database>;

export const templateUsageKeys = {
  workspace: (workspaceId: string) => ["template-usage", workspaceId] as const,
};

export function templateSlug(name: string) {
  return name.trim().toLowerCase().replaceAll(/\s+/g, "-");
}

export async function listTemplateUsage(client: Client, workspaceId: string) {
  const { data, error } = await client
    .from("template_usage")
    .select("*")
    .eq("workspace_id", workspaceId);

  if (error) throw error;
  return data;
}

export async function incrementTemplateUsage(
  client: Client,
  input: { workspaceId: string; templateId: string },
) {
  const { data: existing, error: readError } = await client
    .from("template_usage")
    .select("*")
    .eq("workspace_id", input.workspaceId)
    .eq("template_id", input.templateId)
    .maybeSingle();

  if (readError) throw readError;

  if (existing) {
    const { error } = await client
      .from("template_usage")
      .update({ use_count: existing.use_count + 1 })
      .eq("id", existing.id)
      .eq("workspace_id", input.workspaceId);

    if (error) throw error;
    return;
  }

  const { error } = await client.from("template_usage").insert({
    workspace_id: input.workspaceId,
    template_id: input.templateId,
    use_count: 1,
  });

  if (error) throw error;
}
