import { describe, expect, it, vi } from "vitest";
import { listBacklinks, saveNoteLinks, targetColumnFor } from "./note-links.queries";

const taskId = "8f3c1d2e-1111-4222-8333-444455556666";
const noteId = "aaaaaaaa-1111-4222-8333-444455556666";
const otherNoteId = "bbbbbbbb-1111-4222-8333-444455556666";

function createQueryClient(result: { data: unknown; error: unknown } = { data: [], error: null }) {
  const query = {
    ...result,
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    in: vi.fn(() => query),
    order: vi.fn(() => query),
    insert: vi.fn(() => query),
    delete: vi.fn(() => query),
  };

  return { client: { from: vi.fn(() => query) }, query };
}

describe("targetColumnFor", () => {
  it("maps each kind to its column", () => {
    expect(targetColumnFor("task")).toBe("target_work_item_id");
    expect(targetColumnFor("note")).toBe("target_note_id");
    expect(targetColumnFor("project")).toBe("target_project_id");
    expect(targetColumnFor("milestone")).toBe("target_milestone_id");
  });
});

describe("saveNoteLinks", () => {
  it("inserts only the targets that are new", async () => {
    const { client, query } = createQueryClient({
      data: [{ id: "link-1", target_work_item_id: taskId, target_note_id: null, target_project_id: null }],
      error: null,
    });

    await saveNoteLinks(client as never, {
      workspaceId: "workspace-1",
      noteId,
      userId: "user-1",
      body: `[Task](orbit:task/${taskId}) and [Note](orbit:note/${otherNoteId})`,
    });

    // The task link already exists; only the note link is new.
    expect(query.insert).toHaveBeenCalledWith([
      {
        workspace_id: "workspace-1",
        note_id: noteId,
        created_by: "user-1",
        target_note_id: otherNoteId,
        target_work_item_id: null,
        target_project_id: null,
        target_milestone_id: null,
      },
    ]);
  });

  it("deletes links whose target left the body", async () => {
    const { client, query } = createQueryClient({
      data: [
        { id: "link-1", target_work_item_id: taskId, target_note_id: null, target_project_id: null },
      ],
      error: null,
    });

    await saveNoteLinks(client as never, {
      workspaceId: "workspace-1",
      noteId,
      userId: "user-1",
      body: "the link is gone now",
    });

    expect(query.delete).toHaveBeenCalled();
    expect(query.in).toHaveBeenCalledWith("id", ["link-1"]);
  });

  it("writes nothing when the body is unchanged", async () => {
    const { client, query } = createQueryClient({
      data: [{ id: "link-1", target_work_item_id: taskId, target_note_id: null, target_project_id: null }],
      error: null,
    });

    await saveNoteLinks(client as never, {
      workspaceId: "workspace-1",
      noteId,
      userId: "user-1",
      body: `[Task](orbit:task/${taskId})`,
    });

    expect(query.insert).not.toHaveBeenCalled();
    expect(query.delete).not.toHaveBeenCalled();
  });
});

describe("listBacklinks", () => {
  it("filters by the column matching the target kind", async () => {
    const { client, query } = createQueryClient({ data: [], error: null });

    await listBacklinks(client as never, {
      workspaceId: "workspace-1",
      kind: "task",
      id: taskId,
    });

    expect(client.from).toHaveBeenCalledWith("note_links");
    expect(query.eq).toHaveBeenCalledWith("workspace_id", "workspace-1");
    expect(query.eq).toHaveBeenCalledWith("target_work_item_id", taskId);
  });

  it("returns the source notes, skipping rows whose note is not readable", async () => {
    const { client } = createQueryClient({
      data: [
        { note_id: noteId, notes: { id: noteId, title: "Why we shipped small", note_type: "decision" } },
        { note_id: otherNoteId, notes: null },
      ],
      error: null,
    });

    const backlinks = await listBacklinks(client as never, {
      workspaceId: "workspace-1",
      kind: "task",
      id: taskId,
    });

    expect(backlinks).toEqual([
      { id: noteId, title: "Why we shipped small", noteType: "decision" },
    ]);
  });
});
