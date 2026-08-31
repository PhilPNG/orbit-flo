import { describe, expect, it, vi } from "vitest";
import { createNote, listNotes, noteTypeLabel, notesKeys } from "./notes.queries";

function createQueryClient(result: { data: unknown; error: unknown } = { data: [], error: null }) {
  const query = {
    ...result,
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    order: vi.fn(() => query),
    insert: vi.fn(() => query),
    single: vi.fn(() => result),
  };

  return {
    client: {
      from: vi.fn(() => query),
    },
    query,
  };
}

describe("noteTypeLabel", () => {
  it("formats note types for display", () => {
    expect(noteTypeLabel("idea")).toBe("Idea");
    expect(noteTypeLabel("at_risk" as never)).toBe("at_risk");
  });
});

describe("notesKeys", () => {
  it("keeps project notes under the workspace cache prefix", () => {
    expect(notesKeys.workspace("workspace-1")).toEqual(["notes", "workspace-1"]);
    expect(notesKeys.project("workspace-1", "project-1")).toEqual(["notes", "workspace-1", "project", "project-1"]);
  });
});

describe("listNotes", () => {
  it("filters notes by workspace", async () => {
    const { client, query } = createQueryClient();

    await listNotes(client as never, "workspace-1");

    expect(client.from).toHaveBeenCalledWith("notes");
    expect(query.eq).toHaveBeenCalledTimes(1);
    expect(query.eq).toHaveBeenCalledWith("workspace_id", "workspace-1");
    expect(query.order).toHaveBeenCalledWith("updated_at", { ascending: false });
  });

  it("applies an optional project filter", async () => {
    const { client, query } = createQueryClient();

    await listNotes(client as never, "workspace-1", "project-1");

    expect(query.eq).toHaveBeenNthCalledWith(1, "workspace_id", "workspace-1");
    expect(query.eq).toHaveBeenNthCalledWith(2, "project_id", "project-1");
  });
});

describe("createNote", () => {
  it("creates workspace notes without a project id", async () => {
    const { client, query } = createQueryClient({ data: { id: "note-1" }, error: null });

    await createNote(client as never, {
      workspaceId: "workspace-1",
      userId: "user-1",
      noteType: "decision",
      title: "Decision made",
      body: "Use the simple approach.",
      tags: ["scope", "plan"],
    });

    expect(client.from).toHaveBeenCalledWith("notes");
    expect(query.insert).toHaveBeenCalledWith({
      workspace_id: "workspace-1",
      project_id: null,
      work_item_id: null,
      created_by: "user-1",
      note_type: "decision",
      title: "Decision made",
      body: "Use the simple approach.",
      tags: ["scope", "plan"],
    });
  });
});
