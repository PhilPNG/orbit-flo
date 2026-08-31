import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "../../lib/supabase/database.types";

type Client = SupabaseClient<Database>;
type MeetingNote = Database["public"]["Tables"]["meeting_notes"]["Row"];
type MeetingActionItem = Database["public"]["Tables"]["meeting_action_items"]["Row"];
type WorkItem = Database["public"]["Tables"]["work_items"]["Row"];

export type MeetingNoteValues = {
  title: string;
  meetingDate: string;
  attendees: string[];
  discussion: string;
  decisions: string;
  risks: string;
  actionItems: Array<{ title: string; ownerLabel: string; dueDate: string }>;
};

type CreateMeetingNoteResult = {
  meetingNote: MeetingNote;
  actionItems: MeetingActionItem[];
};

type ConvertMeetingActionItemResult = {
  actionItem: MeetingActionItem;
  workItem: WorkItem | null;
  alreadyConverted: boolean;
};

export async function listMeetingNotes(client: Client, workspaceId: string, projectId: string) {
  const { data, error } = await client
    .from("meeting_notes")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("project_id", projectId)
    .order("meeting_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data as MeetingNote[];
}

export async function createMeetingNote(
  client: Client,
  input: MeetingNoteValues & { workspaceId: string; projectId: string; userId: string },
) {
  const actionItems = input.actionItems.map((item) => ({
    title: item.title.trim(),
    owner_label: item.ownerLabel.trim(),
    due_date: item.dueDate,
  })) as unknown as Json;

  const { data, error } = await client.rpc("create_meeting_note_with_actions", {
    p_workspace_id: input.workspaceId,
    p_project_id: input.projectId,
    p_title: input.title,
    p_meeting_date: input.meetingDate,
    p_attendees: input.attendees,
    p_discussion: input.discussion,
    p_decisions: input.decisions,
    p_risks: input.risks,
    p_action_items: actionItems,
  });

  if (error) throw error;
  return data as unknown as CreateMeetingNoteResult;
}

export async function listMeetingActionItems(client: Client, workspaceId: string, projectId: string) {
  const { data, error } = await client
    .from("meeting_action_items")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data as MeetingActionItem[];
}

export async function convertMeetingActionItemToTask(
  client: Client,
  input: {
    id: string;
    workspaceId: string;
    projectId: string;
    userId: string;
  },
): Promise<{ actionItem: MeetingActionItem; workItem: WorkItem | null; alreadyConverted: boolean }> {
  const { data, error } = await client.rpc("convert_meeting_action_item_to_task", {
    p_action_item_id: input.id,
    p_workspace_id: input.workspaceId,
    p_project_id: input.projectId,
  });

  if (error) throw error;
  return data as unknown as ConvertMeetingActionItemResult;
}
