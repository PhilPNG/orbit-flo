import type { SupabaseClient } from "@supabase/supabase-js";
import { saveNoteLinks } from "../links/note-links.queries";
import type { Database, NoteType } from "../../lib/supabase/database.types";

type Client = SupabaseClient<Database>;

export const noteTypes = ["idea", "question", "decision", "risk", "reference"] as const;

export const notesKeys = {
  workspace: (workspaceId: string) => ["notes", workspaceId] as const,
  project: (workspaceId: string, projectId: string) =>
    [...notesKeys.workspace(workspaceId), "project", projectId] as const,
};

export interface CreateNoteInput {
  workspaceId: string;
  projectId?: string;
  workItemId?: string;
  userId: string;
  noteType: NoteType;
  title: string;
  body?: string;
  tags: string[];
}

export function noteTypeLabel(noteType: NoteType): string {
  const labels: Record<NoteType, string> = {
    idea: "Idea",
    question: "Question",
    decision: "Decision",
    risk: "Risk",
    reference: "Reference",
  };
  return labels[noteType] ?? noteType;
}

export async function listNotes(client: Client, workspaceId: string, projectId?: string) {
  let query = client
    .from("notes")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("updated_at", { ascending: false });

  if (projectId) query = query.eq("project_id", projectId);

  const { data, error } = await query;
  if (error) throw error;

  return data;
}

export async function createNote(client: Client, input: CreateNoteInput) {
  const { data, error } = await client
    .from("notes")
    .insert({
      workspace_id: input.workspaceId,
      project_id: input.projectId || null,
      work_item_id: input.workItemId || null,
      created_by: input.userId,
      note_type: input.noteType,
      title: input.title,
      body: input.body || null,
      tags: input.tags,
    })
    .select("*")
    .single();

  if (error) throw error;

  // Links are derived from the body, so every write reconciles them. A failure
  // here must not lose the note: the note is the content, the links index it.
  try {
    await saveNoteLinks(client, {
      workspaceId: input.workspaceId,
      noteId: data.id,
      userId: input.userId,
      body: input.body ?? "",
    });
  } catch (cause) {
    console.error("Could not record note links", cause);
  }

  return data;
}
