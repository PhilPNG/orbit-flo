import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, LabelColor } from "../../lib/supabase/database.types";

type Client = SupabaseClient<Database>;
type Tables = Database["public"]["Tables"];

export type WorkItemComment = Tables["work_item_comments"]["Row"];
export type Label = Tables["labels"]["Row"];
export type ChecklistItem = Tables["work_item_checklist_items"]["Row"];
export type Attachment = Tables["work_item_attachments"]["Row"];

export type WorkItemMeta = {
  labelsByItem: Map<string, Label[]>;
  checklistByItem: Map<string, { done: number; total: number }>;
  commentCountByItem: Map<string, number>;
  attachmentCountByItem: Map<string, number>;
};

export const labelColors = ["cyan", "blue", "violet", "emerald", "amber", "rose"] as const satisfies readonly LabelColor[];

export const labelColorClasses: Record<LabelColor, string> = {
  cyan: "border-cyan-300/30 bg-cyan-300/15 text-cyan-100",
  blue: "border-blue-300/30 bg-blue-300/15 text-blue-100",
  violet: "border-violet-300/30 bg-violet-300/15 text-violet-100",
  emerald: "border-emerald-300/30 bg-emerald-300/15 text-emerald-100",
  amber: "border-amber-300/30 bg-amber-300/15 text-amber-100",
  rose: "border-rose-300/30 bg-rose-300/15 text-rose-100",
};

export const labelBarClasses: Record<LabelColor, string> = {
  cyan: "bg-cyan-300",
  blue: "bg-blue-300",
  violet: "bg-violet-300",
  emerald: "bg-emerald-300",
  amber: "bg-amber-300",
  rose: "bg-rose-300",
};

export const workItemDetailsKeys = {
  meta: (workspaceId: string, projectId: string) => ["work-item-meta", workspaceId, projectId] as const,
  details: (workspaceId: string, workItemId: string) => ["work-item-details", workspaceId, workItemId] as const,
  labels: (workspaceId: string, projectId: string) => ["project-labels", workspaceId, projectId] as const,
};

const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

export function sanitizeFileName(name: string) {
  return name
    .toLowerCase()
    .replaceAll(/\s+/g, "-")
    .replaceAll(/[^a-z0-9._-]/g, "");
}

export async function listComments(client: Client, input: { workspaceId: string; workItemId: string }) {
  const { data, error } = await client
    .from("work_item_comments")
    .select("*")
    .eq("workspace_id", input.workspaceId)
    .eq("work_item_id", input.workItemId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data;
}

export async function createComment(
  client: Client,
  input: { workspaceId: string; workItemId: string; userId: string; body: string },
) {
  const { data, error } = await client
    .from("work_item_comments")
    .insert({
      workspace_id: input.workspaceId,
      work_item_id: input.workItemId,
      created_by: input.userId,
      body: input.body.trim(),
    })
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

export async function deleteComment(client: Client, input: { id: string; workspaceId: string }) {
  const { error } = await client
    .from("work_item_comments")
    .delete()
    .eq("id", input.id)
    .eq("workspace_id", input.workspaceId);

  if (error) throw error;
}

export async function listProjectLabels(client: Client, input: { workspaceId: string; projectId: string }) {
  const { data, error } = await client
    .from("labels")
    .select("*")
    .eq("workspace_id", input.workspaceId)
    .eq("project_id", input.projectId)
    .order("name", { ascending: true });

  if (error) throw error;
  return data;
}

export async function createLabel(
  client: Client,
  input: { workspaceId: string; projectId: string; userId: string; name: string; color: LabelColor },
) {
  const { data, error } = await client
    .from("labels")
    .insert({
      workspace_id: input.workspaceId,
      project_id: input.projectId,
      created_by: input.userId,
      name: input.name.trim(),
      color: input.color,
    })
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

export async function deleteLabel(client: Client, input: { id: string; workspaceId: string }) {
  const { error } = await client.from("labels").delete().eq("id", input.id).eq("workspace_id", input.workspaceId);

  if (error) throw error;
}

export async function assignLabel(
  client: Client,
  input: { workspaceId: string; workItemId: string; labelId: string },
) {
  const { error } = await client.from("work_item_labels").insert({
    workspace_id: input.workspaceId,
    work_item_id: input.workItemId,
    label_id: input.labelId,
  });

  if (error) throw error;
}

export async function unassignLabel(
  client: Client,
  input: { workspaceId: string; workItemId: string; labelId: string },
) {
  const { error } = await client
    .from("work_item_labels")
    .delete()
    .eq("workspace_id", input.workspaceId)
    .eq("work_item_id", input.workItemId)
    .eq("label_id", input.labelId);

  if (error) throw error;
}

export async function listWorkItemLabels(client: Client, input: { workspaceId: string; workItemId: string }) {
  const { data, error } = await client
    .from("work_item_labels")
    .select("label_id, labels(*)")
    .eq("workspace_id", input.workspaceId)
    .eq("work_item_id", input.workItemId);

  if (error) throw error;
  return (data ?? [])
    .map((row) => (row as unknown as { labels: Label | null }).labels)
    .filter((label): label is Label => Boolean(label));
}

export async function listChecklistItems(client: Client, input: { workspaceId: string; workItemId: string }) {
  const { data, error } = await client
    .from("work_item_checklist_items")
    .select("*")
    .eq("workspace_id", input.workspaceId)
    .eq("work_item_id", input.workItemId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data;
}

export async function createChecklistItem(
  client: Client,
  input: { workspaceId: string; workItemId: string; userId: string; title: string; sortOrder: number },
) {
  const { data, error } = await client
    .from("work_item_checklist_items")
    .insert({
      workspace_id: input.workspaceId,
      work_item_id: input.workItemId,
      created_by: input.userId,
      title: input.title.trim(),
      sort_order: input.sortOrder,
    })
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

export async function toggleChecklistItem(
  client: Client,
  input: { id: string; workspaceId: string; isDone: boolean },
) {
  const { data, error } = await client
    .from("work_item_checklist_items")
    .update({ is_done: input.isDone })
    .eq("id", input.id)
    .eq("workspace_id", input.workspaceId)
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

export async function deleteChecklistItem(client: Client, input: { id: string; workspaceId: string }) {
  const { error } = await client
    .from("work_item_checklist_items")
    .delete()
    .eq("id", input.id)
    .eq("workspace_id", input.workspaceId);

  if (error) throw error;
}

export async function listAttachments(client: Client, input: { workspaceId: string; workItemId: string }) {
  const { data, error } = await client
    .from("work_item_attachments")
    .select("*")
    .eq("workspace_id", input.workspaceId)
    .eq("work_item_id", input.workItemId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data;
}

export async function uploadAttachment(
  client: Client,
  input: { workspaceId: string; workItemId: string; userId: string; file: File },
) {
  if (input.file.size > MAX_ATTACHMENT_BYTES) {
    throw new Error("Attachments are limited to 10 MB.");
  }

  const storagePath = `${input.workspaceId}/${input.workItemId}/${crypto.randomUUID()}-${sanitizeFileName(input.file.name)}`;
  const { error: uploadError } = await client.storage.from("attachments").upload(storagePath, input.file);

  if (uploadError) throw uploadError;

  const { data, error } = await client
    .from("work_item_attachments")
    .insert({
      workspace_id: input.workspaceId,
      work_item_id: input.workItemId,
      created_by: input.userId,
      file_name: input.file.name,
      storage_path: storagePath,
      mime_type: input.file.type || "application/octet-stream",
      size_bytes: input.file.size,
    })
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

export async function deleteAttachment(
  client: Client,
  input: { id: string; workspaceId: string; storagePath: string },
) {
  const { error: removeError } = await client.storage.from("attachments").remove([input.storagePath]);

  if (removeError) throw removeError;

  const { error } = await client
    .from("work_item_attachments")
    .delete()
    .eq("id", input.id)
    .eq("workspace_id", input.workspaceId);

  if (error) throw error;
}

export async function getAttachmentUrl(client: Client, storagePath: string) {
  const { data, error } = await client.storage.from("attachments").createSignedUrl(storagePath, 60);

  if (error) throw error;
  return data.signedUrl;
}

export async function getWorkItemMeta(
  client: Client,
  input: { workspaceId: string; workItemIds: string[] },
): Promise<WorkItemMeta> {
  const meta: WorkItemMeta = {
    labelsByItem: new Map(),
    checklistByItem: new Map(),
    commentCountByItem: new Map(),
    attachmentCountByItem: new Map(),
  };

  if (input.workItemIds.length === 0) return meta;

  const [labelRows, checklistRows, commentRows, attachmentRows] = await Promise.all([
    client
      .from("work_item_labels")
      .select("work_item_id, labels(*)")
      .eq("workspace_id", input.workspaceId)
      .in("work_item_id", input.workItemIds),
    client
      .from("work_item_checklist_items")
      .select("work_item_id, is_done")
      .eq("workspace_id", input.workspaceId)
      .in("work_item_id", input.workItemIds),
    client
      .from("work_item_comments")
      .select("work_item_id")
      .eq("workspace_id", input.workspaceId)
      .in("work_item_id", input.workItemIds),
    client
      .from("work_item_attachments")
      .select("work_item_id")
      .eq("workspace_id", input.workspaceId)
      .in("work_item_id", input.workItemIds),
  ]);

  for (const result of [labelRows, checklistRows, commentRows, attachmentRows]) {
    if (result.error) throw result.error;
  }

  for (const row of (labelRows.data ?? []) as unknown as Array<{ work_item_id: string; labels: Label | null }>) {
    if (!row.labels) continue;
    const existing = meta.labelsByItem.get(row.work_item_id) ?? [];
    existing.push(row.labels);
    meta.labelsByItem.set(row.work_item_id, existing);
  }

  for (const row of (checklistRows.data ?? []) as Array<{ work_item_id: string; is_done: boolean }>) {
    const entry = meta.checklistByItem.get(row.work_item_id) ?? { done: 0, total: 0 };
    entry.total += 1;
    if (row.is_done) entry.done += 1;
    meta.checklistByItem.set(row.work_item_id, entry);
  }

  for (const row of (commentRows.data ?? []) as Array<{ work_item_id: string }>) {
    meta.commentCountByItem.set(row.work_item_id, (meta.commentCountByItem.get(row.work_item_id) ?? 0) + 1);
  }

  for (const row of (attachmentRows.data ?? []) as Array<{ work_item_id: string }>) {
    meta.attachmentCountByItem.set(row.work_item_id, (meta.attachmentCountByItem.get(row.work_item_id) ?? 0) + 1);
  }

  return meta;
}
