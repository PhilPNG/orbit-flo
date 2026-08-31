import type { SupabaseClient } from "@supabase/supabase-js";
import type { CaptureType, Database } from "../../lib/supabase/database.types";
import { sortDailyPlanItems } from "./daily-plan.utils";

type Client = SupabaseClient<Database>;
type DailyPlan = Database["public"]["Tables"]["daily_plans"]["Row"];
type DailyPlanItem = Database["public"]["Tables"]["daily_plan_items"]["Row"];
type WorkItem = Database["public"]["Tables"]["work_items"]["Row"];

export type DailyPlanItemWithWorkItem = DailyPlanItem & {
  workItem: WorkItem | null;
};

export async function getOrCreateDailyPlan(
  client: Client,
  input: {
    workspaceId: string;
    userId: string;
    planDate: string;
  },
) {
  const existingPlan = await client
    .from("daily_plans")
    .select("*")
    .eq("workspace_id", input.workspaceId)
    .eq("plan_date", input.planDate)
    .maybeSingle();

  if (existingPlan.error) throw existingPlan.error;
  if (existingPlan.data) return existingPlan.data;

  const { data, error } = await client
    .from("daily_plans")
    .insert({
      workspace_id: input.workspaceId,
      plan_date: input.planDate,
      created_by: input.userId,
    })
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

export async function getDailyMissionControlData(client: Client, workspaceId: string, planDate: string) {
  const [plan, workItems, captures, milestones, projects] = await Promise.all([
    client
      .from("daily_plans")
      .select("*")
      .eq("workspace_id", workspaceId)
      .eq("plan_date", planDate)
      .maybeSingle(),
    client
      .from("work_items")
      .select("*")
      .eq("workspace_id", workspaceId)
      .neq("status", "done")
      .order("updated_at", { ascending: false }),
    client
      .from("captures")
      .select("*")
      .eq("workspace_id", workspaceId)
      .is("processed_at", null)
      .order("created_at", { ascending: false })
      .limit(8),
    client
      .from("milestones")
      .select("*")
      .eq("workspace_id", workspaceId)
      .is("completed_at", null)
      .order("target_date", { ascending: true })
      .limit(5),
    client.from("projects").select("*").eq("workspace_id", workspaceId).order("updated_at", { ascending: false }),
  ]);

  if (plan.error) throw plan.error;
  if (workItems.error) throw workItems.error;
  if (captures.error) throw captures.error;
  if (milestones.error) throw milestones.error;
  if (projects.error) throw projects.error;

  const activePlan = plan.data as DailyPlan | null;
  const dailyPlanItems = activePlan
    ? await client
        .from("daily_plan_items")
        .select("*")
        .eq("workspace_id", workspaceId)
        .eq("daily_plan_id", activePlan.id)
        .order("sort_order", { ascending: true })
    : { data: [], error: null };

  if (dailyPlanItems.error) throw dailyPlanItems.error;

  const dailyPlanRows = ((dailyPlanItems.data as DailyPlanItem[]) ?? []).filter(
    (item) => item.daily_plan_id === activePlan?.id,
  );
  const planWorkItemIds = Array.from(
    new Set(
      dailyPlanRows
        .map((item) => item.work_item_id)
        .filter((workItemId): workItemId is string => Boolean(workItemId)),
    ),
  );
  const planWorkItems =
    activePlan && planWorkItemIds.length > 0
      ? await client.from("work_items").select("*").eq("workspace_id", workspaceId).in("id", planWorkItemIds)
      : { data: [], error: null };

  if (planWorkItems.error) throw planWorkItems.error;

  const availableWorkItems = workItems.data as WorkItem[];
  const workItemsById = new Map(((planWorkItems.data as WorkItem[]) ?? []).map((item) => [item.id, item]));
  const activeDailyPlanItems = dailyPlanRows.map<DailyPlanItemWithWorkItem>((item) => ({
    ...item,
    workItem: workItemsById.get(item.work_item_id) ?? null,
  }));

  return {
    plan: activePlan,
    dailyPlanItems: sortDailyPlanItems(activeDailyPlanItems),
    availableWorkItems,
    captures: captures.data,
    milestones: milestones.data,
    projects: projects.data,
  };
}

export async function addDailyPlanItem(
  client: Client,
  input: {
    workspaceId: string;
    dailyPlanId: string;
    workItemId: string;
    sortOrder: number;
    isPrimary: boolean;
  },
) {
  const { data, error } = await client
    .from("daily_plan_items")
    .insert({
      workspace_id: input.workspaceId,
      daily_plan_id: input.dailyPlanId,
      work_item_id: input.workItemId,
      sort_order: input.sortOrder,
      is_primary: input.isPrimary,
    })
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

export async function completeDailyPlanItem(
  client: Client,
  input: {
    id: string;
    workspaceId: string;
  },
) {
  const { data, error } = await client
    .from("daily_plan_items")
    .update({
      state: "completed",
      completed_at: new Date().toISOString(),
      skipped_at: null,
    })
    .eq("id", input.id)
    .eq("workspace_id", input.workspaceId)
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

export async function skipDailyPlanItem(
  client: Client,
  input: {
    id: string;
    workspaceId: string;
  },
) {
  const { data, error } = await client
    .from("daily_plan_items")
    .update({
      state: "skipped",
      skipped_at: new Date().toISOString(),
      completed_at: null,
    })
    .eq("id", input.id)
    .eq("workspace_id", input.workspaceId)
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

export async function resetDailyPlanItem(
  client: Client,
  input: {
    id: string;
    workspaceId: string;
  },
) {
  const { data, error } = await client
    .from("daily_plan_items")
    .update({
      state: "planned",
      completed_at: null,
      skipped_at: null,
    })
    .eq("id", input.id)
    .eq("workspace_id", input.workspaceId)
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

export async function createCapture(
  client: Client,
  input: {
    workspaceId: string;
    userId: string;
    type: CaptureType;
    title: string;
    body?: string;
    projectId?: string;
    workItemId?: string;
  },
) {
  if (input.workItemId && !input.projectId) {
    throw new Error("Captures linked to work items must include a project.");
  }

  const { data, error } = await client
    .from("captures")
    .insert({
      workspace_id: input.workspaceId,
      created_by: input.userId,
      type: input.type,
      title: input.title,
      body: input.body || null,
      project_id: input.projectId || null,
      work_item_id: input.workItemId || null,
    })
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

export async function saveDailyReview(
  client: Client,
  input: {
    id: string;
    workspaceId: string;
    reflection: string;
    completedCount: number;
    skippedCount: number;
  },
) {
  const { data, error } = await client
    .from("daily_plans")
    .update({
      status: "completed",
      reflection: input.reflection,
      completed_count: input.completedCount,
      skipped_count: input.skippedCount,
    })
    .eq("id", input.id)
    .eq("workspace_id", input.workspaceId)
    .select("*")
    .single();

  if (error) throw error;
  return data;
}
