import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Database } from "../../lib/supabase/database.types";
import { MeetingNotesPanel } from "./meeting-notes-panel";

type MeetingNote = Database["public"]["Tables"]["meeting_notes"]["Row"];
type MeetingActionItem = Database["public"]["Tables"]["meeting_action_items"]["Row"];

function meetingNote(overrides: Partial<MeetingNote> = {}): MeetingNote {
  return {
    id: "meeting-1",
    workspace_id: "workspace-1",
    project_id: "project-1",
    title: "Launch readiness",
    meeting_date: "2026-07-01",
    attendees: ["Ari", "Bea"],
    discussion: "Reviewed launch risk.",
    decisions: "Delay beta until Friday.",
    risks: "QA coverage is thin.",
    created_by: "user-1",
    created_at: "2026-07-01T12:00:00.000Z",
    updated_at: "2026-07-01T12:00:00.000Z",
    ...overrides,
  };
}

function actionItem(overrides: Partial<MeetingActionItem> = {}): MeetingActionItem {
  return {
    id: "action-1",
    workspace_id: "workspace-1",
    meeting_note_id: "meeting-1",
    project_id: "project-1",
    work_item_id: null,
    title: "Follow up on launch risk",
    owner_label: "",
    due_date: null,
    is_converted: false,
    created_by: "user-1",
    created_at: "2026-07-01T12:00:00.000Z",
    updated_at: "2026-07-01T12:00:00.000Z",
    ...overrides,
  };
}

describe("MeetingNotesPanel", () => {
  it("saves a meeting note and converts an action item to a task", async () => {
    const user = userEvent.setup();
    const onSaveMeeting = vi.fn();
    const onConvertActionItem = vi.fn();

    render(
      <MeetingNotesPanel
        actionItems={[actionItem()]}
        isSaving={false}
        meetingNotes={[]}
        onConvertActionItem={onConvertActionItem}
        onSaveMeeting={onSaveMeeting}
      />,
    );

    await user.type(screen.getByLabelText("Meeting title"), "Launch sync");
    await user.type(screen.getByLabelText("Discussion"), "Talked through launch risk.");
    await user.click(screen.getByRole("button", { name: "Save meeting note" }));
    await user.click(screen.getByRole("button", { name: "Convert Follow up on launch risk to task" }));

    expect(onSaveMeeting).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Launch sync",
        discussion: "Talked through launch risk.",
      }),
    );
    expect(onConvertActionItem).toHaveBeenCalledWith("action-1");
  });

  it("requires a meeting title before saving", async () => {
    const user = userEvent.setup();
    const onSaveMeeting = vi.fn();

    render(
      <MeetingNotesPanel
        actionItems={[]}
        isSaving={false}
        meetingNotes={[]}
        onConvertActionItem={vi.fn()}
        onSaveMeeting={onSaveMeeting}
      />,
    );

    await user.type(screen.getByLabelText("Discussion"), "A note without a title.");
    await user.click(screen.getByRole("button", { name: "Save meeting note" }));

    expect(onSaveMeeting).not.toHaveBeenCalled();
    expect(screen.getByText("Add a meeting title before saving.")).toBeTruthy();
  });

  it("shows converted action items without a convert button", () => {
    render(
      <MeetingNotesPanel
        actionItems={[actionItem({ is_converted: true, work_item_id: "work-item-1" })]}
        isSaving={false}
        meetingNotes={[meetingNote()]}
        onConvertActionItem={vi.fn()}
        onSaveMeeting={vi.fn()}
      />,
    );

    expect(screen.getByText("Launch readiness")).toBeTruthy();
    expect(screen.getByText("Converted")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Convert Follow up on launch risk to task" })).toBeNull();
  });
});
