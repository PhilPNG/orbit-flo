import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, ProjectPriority, RecurrencePattern } from "../../lib/supabase/database.types";
import { countMissedOccurrences, matchesRecurrence, type RecurrenceRule } from "./recurrence.utils";

type Client = SupabaseClient<Database>;
type RecurrenceRuleUpdate = Database["public"]["Tables"]["recurrence_rules"]["Update"];

export interface RecurrenceRuleInput {
  workspaceId: string;
  projectId: string;
  userId: string;
  title: string;
  description?: string;
  priority: ProjectPriority;
  pattern: RecurrencePattern;
  weekdays: number[];
  dayOfMonth: number | null;
  plannedAt?: string | null;
  plannedMinutes?: number | null;
}

export const recurrenceKeys = {
  project: (workspaceId: string, projectId: string) =>
    ["recurrence-rules", workspaceId, projectId] as const,
};

export async function listRecurrenceRules(client: Client, workspaceId: string, projectId: string) {
  const { data, error } = await client
    .from("recurrence_rules")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data;
}

export async function createRecurrenceRule(client: Client, input: RecurrenceRuleInput) {
  const { data, error } = await client
    .from("recurrence_rules")
    .insert({
      workspace_id: input.workspaceId,
      project_id: input.projectId,
      created_by: input.userId,
      title: input.title,
      description: input.description || null,
      priority: input.priority,
      pattern: input.pattern,
      weekdays: input.weekdays,
      day_of_month: input.dayOfMonth,
      planned_at: input.plannedAt ?? null,
      planned_minutes: input.plannedMinutes ?? null,
    })
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

export async function updateRecurrenceRule(
  client: Client,
  input: { id: string; workspaceId: string } & Partial<
    Omit<RecurrenceRuleInput, "workspaceId" | "projectId" | "userId">
  > & { isActive?: boolean },
) {
  const payload: RecurrenceRuleUpdate = {};
  if (input.title !== undefined) payload.title = input.title;
  if (input.description !== undefined) payload.description = input.description || null;
  if (input.priority !== undefined) payload.priority = input.priority;
  if (input.pattern !== undefined) payload.pattern = input.pattern;
  if (input.weekdays !== undefined) payload.weekdays = input.weekdays;
  if (input.dayOfMonth !== undefined) payload.day_of_month = input.dayOfMonth;
  if (input.plannedAt !== undefined) payload.planned_at = input.plannedAt;
  if (input.plannedMinutes !== undefined) payload.planned_minutes = input.plannedMinutes;
  if (input.isActive !== undefined) payload.is_active = input.isActive;

  const { error } = await client
    .from("recurrence_rules")
    .update(payload)
    .eq("id", input.id)
    .eq("workspace_id", input.workspaceId);

  if (error) throw error;
}

export async function deleteRecurrenceRule(client: Client, input: { id: string; workspaceId: string }) {
  const { error } = await client
    .from("recurrence_rules")
    .delete()
    .eq("id", input.id)
    .eq("workspace_id", input.workspaceId);

  if (error) throw error;
}

export async function ensureRecurringOccurrences(
  client: Client,
  workspaceId: string,
  todayKey: string,
  userId: string,
): Promise<{ created: number; missed: number }> {
  const { data, error } = await client
    .from("recurrence_rules")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  if (error) throw error;

  const rows = data ?? [];
  let created = 0;
  let missed = 0;

  for (const row of rows) {
    if (row.generated_through && row.generated_through >= todayKey) continue;

    const rule: RecurrenceRule = {
      id: row.id,
      pattern: row.pattern,
      weekdays: row.weekdays ?? [],
      dayOfMonth: row.day_of_month,
    };

    missed += countMissedOccurrences(rule, row.generated_through, todayKey);

    if (matchesRecurrence(rule, todayKey)) {
      const insert = await client.from("work_items").insert({
        workspace_id: workspaceId,
        project_id: row.project_id,
        created_by: userId,
        title: row.title,
        description: row.description,
        priority: row.priority,
        status: "ready",
        due_date: todayKey,
        planned_at: row.planned_at,
        planned_minutes: row.planned_minutes,
        recurrence_rule_id: row.id,
        occurrence_date: todayKey,
      });

      // 23505 is a unique violation, which here means another device already
      // created this occurrence. That is success, not failure.
      if (insert.error && insert.error.code !== "23505") throw insert.error;
      if (!insert.error) created += 1;
    }

    const advance = await client
      .from("recurrence_rules")
      .update({ generated_through: todayKey })
      .eq("id", row.id)
      .eq("workspace_id", workspaceId);

    if (advance.error) throw advance.error;
  }

  return { created, missed };
}
