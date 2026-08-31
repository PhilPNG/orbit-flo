import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import type { Database } from "../../lib/supabase/database.types";
import { convertMeetingActionItemToTask, createMeetingNote } from "./meeting-notes.queries";

function rpcClient(data: unknown) {
  return {
    rpc: vi.fn().mockResolvedValue({ data, error: null }),
  } as unknown as SupabaseClient<Database> & { rpc: ReturnType<typeof vi.fn> };
}

describe("meeting notes queries", () => {
  it("creates a meeting note and actions through the atomic RPC", async () => {
    const client = rpcClient({ meetingNote: { id: "meeting-1" }, actionItems: [] });

    await createMeetingNote(client, {
      workspaceId: "workspace-1",
      projectId: "project-1",
      userId: "user-1",
      title: "Launch sync",
      meetingDate: "2026-07-01",
      attendees: ["Ari"],
      discussion: "Reviewed risks.",
      decisions: "",
      risks: "",
      actionItems: [{ title: "Follow up", ownerLabel: "Ari", dueDate: "2026-07-05" }],
    });

    expect(client.rpc).toHaveBeenCalledWith(
      "create_meeting_note_with_actions",
      expect.objectContaining({
        p_workspace_id: "workspace-1",
        p_project_id: "project-1",
        p_title: "Launch sync",
        p_action_items: [expect.objectContaining({ title: "Follow up", owner_label: "Ari" })],
      }),
    );
  });

  it("converts action items through the row-locking RPC", async () => {
    const client = rpcClient({ actionItem: { id: "action-1" }, workItem: { id: "work-item-1" }, alreadyConverted: false });

    await convertMeetingActionItemToTask(client, {
      id: "action-1",
      workspaceId: "workspace-1",
      projectId: "project-1",
      userId: "user-1",
    });

    expect(client.rpc).toHaveBeenCalledWith("convert_meeting_action_item_to_task", {
      p_action_item_id: "action-1",
      p_workspace_id: "workspace-1",
      p_project_id: "project-1",
    });
  });
});
