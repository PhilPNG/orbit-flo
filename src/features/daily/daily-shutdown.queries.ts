import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../lib/supabase/database.types";

type Client = SupabaseClient<Database>;
export type DailyShutdown = Database["public"]["Tables"]["daily_shutdowns"]["Row"];

export type DailyShutdownValues = {
  shipped: string;
  movedForward: string;
  blocked: string;
  resumeTomorrow: string;
};

export async function getDailyShutdown(client: Client, workspaceId: string, userId: string, shutdownDate: string) {
  const { data, error } = await client
    .from("daily_shutdowns")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("created_by", userId)
    .eq("shutdown_date", shutdownDate)
    .maybeSingle();

  if (error) throw error;
  return data as DailyShutdown | null;
}

export async function upsertDailyShutdown(
  client: Client,
  input: DailyShutdownValues & { workspaceId: string; userId: string; shutdownDate: string; dailyPlanId?: string },
) {
  const existingShutdown = await getDailyShutdown(client, input.workspaceId, input.userId, input.shutdownDate);

  if (existingShutdown) {
    const { data, error } = await client
      .from("daily_shutdowns")
      .update({
        shipped: input.shipped,
        moved_forward: input.movedForward,
        blocked: input.blocked,
        resume_tomorrow: input.resumeTomorrow,
      })
      .eq("id", existingShutdown.id)
      .eq("workspace_id", input.workspaceId)
      .select("*")
      .single();

    if (error) throw error;
    return data as DailyShutdown;
  }

  const { data, error } = await client
    .from("daily_shutdowns")
    .insert({
      workspace_id: input.workspaceId,
      created_by: input.userId,
      shutdown_date: input.shutdownDate,
      daily_plan_id: input.dailyPlanId || null,
      shipped: input.shipped,
      moved_forward: input.movedForward,
      blocked: input.blocked,
      resume_tomorrow: input.resumeTomorrow,
    })
    .select("*")
    .single();

  if (error) throw error;
  return data as DailyShutdown;
}
