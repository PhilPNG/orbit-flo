import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../lib/supabase/database.types";

type Client = SupabaseClient<Database>;
export type PrivateReflection = Database["public"]["Tables"]["private_reflections"]["Row"];

export type PrivateReflectionValues = {
  reflectionDate: string;
  title: string;
  body: string;
  mood: string;
  tags: string[];
};

export async function listPrivateReflections(client: Client, workspaceId: string, userId: string) {
  const { data, error } = await client
    .from("private_reflections")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("created_by", userId)
    .order("reflection_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(5);

  if (error) throw error;
  return data as PrivateReflection[];
}

export async function createPrivateReflection(
  client: Client,
  input: PrivateReflectionValues & { workspaceId: string; userId: string },
) {
  const { data, error } = await client
    .from("private_reflections")
    .insert({
      workspace_id: input.workspaceId,
      created_by: input.userId,
      reflection_date: input.reflectionDate,
      title: input.title,
      body: input.body,
      mood: input.mood,
      tags: input.tags,
    })
    .select("*")
    .single();

  if (error) throw error;
  return data as PrivateReflection;
}
