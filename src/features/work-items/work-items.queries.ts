import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, ProjectPriority, WorkItemStatus } from "../../lib/supabase/database.types";

type Client = SupabaseClient<Database>;
type WorkItemUpdate = Database["public"]["Tables"]["work_items"]["Update"];
type WorkItem = Database["public"]["Tables"]["work_items"]["Row"];

export const workItemStatuses = ["backlog", "ready", "in_progress", "blocked", "review", "done"] as const;

export function groupWorkItemsByStatus(items: WorkItem[]) {
  return workItemStatuses.reduce<Record<WorkItemStatus, WorkItem[]>>((grouped, status) => {
    grouped[status] = items.filter((item) => item.status === status);
    return grouped;
  }, {} as Record<WorkItemStatus, WorkItem[]>);
}

export async function listWorkItems(client: Client, workspaceId: string, projectId: string) {
  const { data, error } = await client
    .from("work_items")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("project_id", projectId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data;
}

export async function listWorkspaceWorkItems(client: Client, workspaceId: string) {
  const { data, error } = await client
    .from("work_items")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("updated_at", { ascending: false });

  if (error) throw error;
  return data;
}

export async function createWorkItem(
  client: Client,
  input: {
    workspaceId: string;
    projectId: string;
    userId: string;
    title: string;
    description?: string;
    dueDate?: string;
    priority: ProjectPriority;
    status: WorkItemStatus;
  },
) {
  const { data, error } = await client
    .from("work_items")
    .insert({
      workspace_id: input.workspaceId,
      project_id: input.projectId,
      created_by: input.userId,
      title: input.title,
      description: input.description || null,
      due_date: input.dueDate || null,
      priority: input.priority,
      status: input.status,
    })
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

export async function listDueWorkItems(
  client: Client,
  input: {
    workspaceId: string;
    startDate: string;
    endDate: string;
  },
) {
  const { data, error } = await client
    .from("work_items")
    .select("*")
    .eq("workspace_id", input.workspaceId)
    .neq("status", "done")
    .gte("due_date", input.startDate)
    .lte("due_date", input.endDate)
    .order("due_date", { ascending: true })
    .order("priority", { ascending: true });

  if (error) throw error;
  return data;
}

export async function updateWorkItemStatus(
  client: Client,
  input: {
    id: string;
    workspaceId: string;
    projectId: string;
    status: WorkItemStatus;
  },
) {
  const { data, error } = await client
    .from("work_items")
    .update({
      status: input.status,
      completed_at: input.status === "done" ? new Date().toISOString() : null,
    })
    .eq("id", input.id)
    .eq("workspace_id", input.workspaceId)
    .eq("project_id", input.projectId)
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

export async function updateWorkItemDetails(
  client: Client,
  input: {
    id: string;
    workspaceId: string;
    projectId: string;
    title: string;
    description?: string;
    priority: ProjectPriority;
    status: WorkItemStatus;
    dueDate?: string;
    blockedReason?: string;
    milestoneId?: string;
    assignedTo?: string;
    plannedAt?: string | null;
    plannedMinutes?: number | null;
  },
) {
  // Only the fields the caller actually passed are written. Writing every
  // column unconditionally meant any caller that omitted an optional field
  // silently cleared it — that is how the calendar used to wipe milestones.
  // An empty string still clears, so "not provided" and "cleared" stay distinct.
  const payload: WorkItemUpdate = {
    title: input.title,
    priority: input.priority,
    status: input.status,
    completed_at: input.status === "done" ? new Date().toISOString() : null,
  };

  if (input.milestoneId !== undefined) payload.milestone_id = input.milestoneId || null;
  if (input.assignedTo !== undefined) payload.assigned_to = input.assignedTo || null;
  if (input.description !== undefined) payload.description = input.description || null;
  if (input.dueDate !== undefined) payload.due_date = input.dueDate || null;
  if (input.blockedReason !== undefined) payload.blocked_reason = input.blockedReason || null;
  if (input.plannedAt !== undefined) payload.planned_at = input.plannedAt || null;
  if (input.plannedMinutes !== undefined) payload.planned_minutes = input.plannedMinutes ?? null;

  const { data, error } = await client
    .from("work_items")
    .update(payload)
    .eq("id", input.id)
    .eq("workspace_id", input.workspaceId)
    .eq("project_id", input.projectId)
    .select("*")
    .single();

  if (error) throw error;
  return data;
}
