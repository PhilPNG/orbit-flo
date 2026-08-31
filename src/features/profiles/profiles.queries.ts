import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../lib/supabase/database.types";

type Client = SupabaseClient<Database>;

export type Profile = { id: string; displayName: string };

export const profilesQueryKey = (workspaceId: string) => ["profiles", workspaceId] as const;

type ProfileRow = { id: string; display_name: string };

/**
 * Keyed by user id rather than returned as a list: every consumer — member
 * list, assignee chip, comment author — looks people up by id.
 */
export async function listWorkspaceProfiles(
  client: Client,
  workspaceId: string,
): Promise<Map<string, Profile>> {
  const { data, error } = await client
    .from("workspace_members")
    .select("user_id, profiles(id, display_name)")
    .eq("workspace_id", workspaceId);

  if (error) throw error;

  const byUserId = new Map<string, Profile>();

  for (const row of (data ?? []) as unknown as Array<{
    user_id: string;
    profiles: ProfileRow | null;
  }>) {
    // A member whose profile is not visible simply does not appear, rather
    // than surfacing a half-populated entry.
    if (!row.profiles) continue;
    byUserId.set(row.user_id, {
      id: row.profiles.id,
      displayName: row.profiles.display_name,
    });
  }

  return byUserId;
}

export async function getProfile(client: Client, userId: string): Promise<Profile | null> {
  const { data, error } = await client
    .from("profiles")
    .select("id, display_name")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return { id: data.id, displayName: data.display_name };
}

export async function updateDisplayName(
  client: Client,
  input: { userId: string; displayName: string },
): Promise<Profile> {
  const trimmed = input.displayName.trim();
  if (!trimmed) throw new Error("Names cannot be empty.");

  const { data, error } = await client
    .from("profiles")
    .update({ display_name: trimmed })
    .eq("id", input.userId)
    .select("id, display_name")
    .single();

  if (error) throw error;
  return { id: data.id, displayName: data.display_name };
}
