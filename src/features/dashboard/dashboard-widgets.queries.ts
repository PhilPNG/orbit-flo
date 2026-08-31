import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "../../lib/supabase/database.types";

type Client = SupabaseClient<Database>;
type WidgetPreference = Database["public"]["Tables"]["dashboard_widget_preferences"]["Row"];
type WidgetPreferenceInsert = Database["public"]["Tables"]["dashboard_widget_preferences"]["Insert"];
type WidgetPreferenceUpdate = Database["public"]["Tables"]["dashboard_widget_preferences"]["Update"];

export type DashboardWidgetPreferenceInput = {
  widgetKey: string;
  isVisible: boolean;
  sortOrder: number;
  settings: Json;
};

export async function listDashboardWidgetPreferences(client: Client, workspaceId: string, userId: string) {
  const { data, error } = await client
    .from("dashboard_widget_preferences")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .order("sort_order", { ascending: true });

  if (error) throw error;
  return data as WidgetPreference[];
}

export async function upsertDashboardWidgetPreferences(
  client: Client,
  input: { workspaceId: string; userId: string; widgets: DashboardWidgetPreferenceInput[] },
) {
  const rows = await Promise.all(
    input.widgets.map((widget) => saveDashboardWidgetPreference(client, input.workspaceId, input.userId, widget)),
  );

  return rows;
}

async function saveDashboardWidgetPreference(
  client: Client,
  workspaceId: string,
  userId: string,
  widget: DashboardWidgetPreferenceInput,
) {
  const { data: existing, error: existingError } = await client
    .from("dashboard_widget_preferences")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .eq("widget_key", widget.widgetKey)
    .maybeSingle();

  if (existingError) throw existingError;

  if (existing) {
    return updateDashboardWidgetPreference(client, workspaceId, userId, widget);
  }

  const insertPayload: WidgetPreferenceInsert = {
    workspace_id: workspaceId,
    user_id: userId,
    widget_key: widget.widgetKey,
    is_visible: widget.isVisible,
    sort_order: widget.sortOrder,
    settings: widget.settings,
  };
  const { data, error } = await client.from("dashboard_widget_preferences").insert(insertPayload).select("*").single();

  if (error?.code === "23505") {
    return updateDashboardWidgetPreference(client, workspaceId, userId, widget);
  }

  if (error) throw error;
  return data as WidgetPreference;
}

async function updateDashboardWidgetPreference(
  client: Client,
  workspaceId: string,
  userId: string,
  widget: DashboardWidgetPreferenceInput,
) {
  const updatePayload: WidgetPreferenceUpdate = {
    is_visible: widget.isVisible,
    sort_order: widget.sortOrder,
    settings: widget.settings,
  };
  const { data, error } = await client
    .from("dashboard_widget_preferences")
    .update(updatePayload)
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .eq("widget_key", widget.widgetKey)
    .select("*")
    .single();

  if (error) throw error;
  return data as WidgetPreference;
}
