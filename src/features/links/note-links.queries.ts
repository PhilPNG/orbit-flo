import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, NoteType } from "../../lib/supabase/database.types";
import { extractOrbitLinks, type LinkKind } from "./orbit-link";

type Client = SupabaseClient<Database>;

export type Backlink = { id: string; title: string; noteType: NoteType };

export const backlinksQueryKey = (workspaceId: string, kind: LinkKind, id: string) =>
  ["note-links", "backlinks", workspaceId, kind, id] as const;

const targetColumns = {
  note: "target_note_id",
  task: "target_work_item_id",
  project: "target_project_id",
  milestone: "target_milestone_id",
} as const;

export function targetColumnFor(kind: LinkKind) {
  return targetColumns[kind];
}

type ExistingRow = {
  id: string;
  target_note_id: string | null;
  target_work_item_id: string | null;
  target_project_id: string | null;
  target_milestone_id: string | null;
};

function targetKeyOf(row: ExistingRow) {
  if (row.target_note_id) return `note:${row.target_note_id}`;
  if (row.target_work_item_id) return `task:${row.target_work_item_id}`;
  if (row.target_project_id) return `project:${row.target_project_id}`;
  if (row.target_milestone_id) return `milestone:${row.target_milestone_id}`;
  return "";
}

/**
 * Links are derived from the body, so every write reconciles them. A failure
 * here must not fail the note itself: the note is the user's content and the
 * links are only an index of it.
 */
export async function saveNoteLinks(
  client: Client,
  input: { workspaceId: string; noteId: string; userId: string; body: string },
) {
  const wanted = extractOrbitLinks(input.body);

  const { data, error } = await client
    .from("note_links")
    .select("id, target_note_id, target_work_item_id, target_project_id, target_milestone_id")
    .eq("note_id", input.noteId);

  if (error) throw error;

  const existing = (data ?? []) as ExistingRow[];
  const existingKeys = new Set(existing.map(targetKeyOf));
  const wantedKeys = new Set(wanted.map((link) => `${link.kind}:${link.id}`));

  const toInsert = wanted.filter((link) => !existingKeys.has(`${link.kind}:${link.id}`));
  const toDelete = existing.filter((row) => !wantedKeys.has(targetKeyOf(row)));

  if (toInsert.length > 0) {
    const { error: insertError } = await client.from("note_links").insert(
      toInsert.map((link) => ({
        workspace_id: input.workspaceId,
        note_id: input.noteId,
        created_by: input.userId,
        target_note_id: link.kind === "note" ? link.id : null,
        target_work_item_id: link.kind === "task" ? link.id : null,
        target_project_id: link.kind === "project" ? link.id : null,
        target_milestone_id: link.kind === "milestone" ? link.id : null,
      })),
    );

    if (insertError) throw insertError;
  }

  if (toDelete.length > 0) {
    const { error: deleteError } = await client
      .from("note_links")
      .delete()
      .in("id", toDelete.map((row) => row.id));

    if (deleteError) throw deleteError;
  }
}

/** The notes that point at a thing. */
export async function listBacklinks(
  client: Client,
  input: { workspaceId: string; kind: LinkKind; id: string },
): Promise<Backlink[]> {
  const { data, error } = await client
    .from("note_links")
    .select("note_id, notes(id, title, note_type)")
    .eq("workspace_id", input.workspaceId)
    .eq(targetColumnFor(input.kind), input.id);

  if (error) throw error;

  return ((data ?? []) as unknown as Array<{
    note_id: string;
    notes: { id: string; title: string; note_type: NoteType } | null;
  }>)
    // A row whose note is not readable — someone else's private note — simply
    // does not appear, rather than surfacing an unnamed entry.
    .filter((row) => row.notes !== null)
    .map((row) => ({
      id: row.notes!.id,
      title: row.notes!.title,
      noteType: row.notes!.note_type,
    }));
}
