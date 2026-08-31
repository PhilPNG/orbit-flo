import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, WorkItemStatus } from "../../lib/supabase/database.types";

type Client = SupabaseClient<Database>;
export type BoardColumn = Database["public"]["Tables"]["board_columns"]["Row"];
type WorkItem = Database["public"]["Tables"]["work_items"]["Row"];

export const defaultBoardColumns = [
  { title: "Docked", statusCategory: "backlog" },
  { title: "Ready to Launch", statusCategory: "ready" },
  { title: "Launching", statusCategory: "in_progress" },
  { title: "Signal Lost", statusCategory: "blocked" },
  { title: "In Orbit", statusCategory: "review" },
  { title: "Mission Success", statusCategory: "done" },
] as const satisfies ReadonlyArray<{ title: string; statusCategory: WorkItemStatus }>;

export const boardColumnsKeys = {
  list: (workspaceId: string, projectId: string) => ["board-columns", workspaceId, projectId] as const,
};

export async function listBoardColumns(client: Client, workspaceId: string, projectId: string) {
  const { data, error } = await client
    .from("board_columns")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("project_id", projectId)
    .order("sort_order", { ascending: true });

  if (error) throw error;
  return data;
}

export async function ensureDefaultBoardColumns(
  client: Client,
  input: { workspaceId: string; projectId: string; userId: string },
) {
  const existing = await listBoardColumns(client, input.workspaceId, input.projectId);
  if (existing.length > 0) return existing;

  const { data, error } = await client
    .from("board_columns")
    .insert(
      defaultBoardColumns.map((column, index) => ({
        workspace_id: input.workspaceId,
        project_id: input.projectId,
        created_by: input.userId,
        title: column.title,
        status_category: column.statusCategory,
        sort_order: index,
      })),
    )
    .select("*")
    .order("sort_order", { ascending: true });

  if (error) throw error;
  return data;
}

export async function createBoardColumn(
  client: Client,
  input: {
    workspaceId: string;
    projectId: string;
    userId: string;
    title: string;
    statusCategory: WorkItemStatus;
    sortOrder: number;
  },
) {
  const { data, error } = await client
    .from("board_columns")
    .insert({
      workspace_id: input.workspaceId,
      project_id: input.projectId,
      created_by: input.userId,
      title: input.title,
      status_category: input.statusCategory,
      sort_order: input.sortOrder,
    })
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

export async function renameBoardColumn(client: Client, input: { id: string; workspaceId: string; title: string }) {
  const { data, error } = await client
    .from("board_columns")
    .update({ title: input.title })
    .eq("id", input.id)
    .eq("workspace_id", input.workspaceId)
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

export async function reorderBoardColumns(
  client: Client,
  input: { workspaceId: string; projectId: string; orderedIds: string[] },
) {
  for (const [index, id] of input.orderedIds.entries()) {
    const { error } = await client
      .from("board_columns")
      .update({ sort_order: index })
      .eq("id", id)
      .eq("workspace_id", input.workspaceId)
      .eq("project_id", input.projectId);

    if (error) throw error;
  }
}

export async function deleteBoardColumn(
  client: Client,
  input: {
    id: string;
    workspaceId: string;
    moveItemsTo?: { columnId: string; statusCategory: WorkItemStatus };
  },
) {
  if (input.moveItemsTo) {
    const { error: moveError } = await client
      .from("work_items")
      .update({
        column_id: input.moveItemsTo.columnId,
        status: input.moveItemsTo.statusCategory,
        completed_at: input.moveItemsTo.statusCategory === "done" ? new Date().toISOString() : null,
      })
      .eq("column_id", input.id)
      .eq("workspace_id", input.workspaceId);

    if (moveError) throw moveError;
  }

  const { error } = await client
    .from("board_columns")
    .delete()
    .eq("id", input.id)
    .eq("workspace_id", input.workspaceId);

  if (error) throw error;
}

export async function moveWorkItemToColumn(
  client: Client,
  input: {
    id: string;
    workspaceId: string;
    projectId: string;
    columnId: string;
    statusCategory: WorkItemStatus;
  },
): Promise<WorkItem> {
  const { data, error } = await client
    .from("work_items")
    .update({
      column_id: input.columnId,
      status: input.statusCategory,
      completed_at: input.statusCategory === "done" ? new Date().toISOString() : null,
    })
    .eq("id", input.id)
    .eq("workspace_id", input.workspaceId)
    .eq("project_id", input.projectId)
    .select("*")
    .single();

  if (error) throw error;
  return data;
}
