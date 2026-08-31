import { describe, expect, it, vi } from "vitest";
import { listSignals, markAllSignalsRead, unreadCountsByWorkspace } from "./signals.queries";

function clientReturning(rows: Array<{ workspace_id: string }>) {
  const is = vi.fn().mockResolvedValue({ data: rows, error: null });
  const select = vi.fn().mockReturnValue({ is });
  return { from: vi.fn().mockReturnValue({ select }) } as never;
}

function listSignalsClient(
  rows: unknown[],
  targets: { workItems?: Array<{ id: string; title: string }>; notes?: Array<{ id: string; title: string }> } = {},
) {
  const limit = vi.fn().mockResolvedValue({ data: rows, error: null });
  const order = vi.fn().mockReturnValue({ limit });
  const eq = vi.fn().mockReturnValue({ order });
  const signalsSelect = vi.fn().mockReturnValue({ eq });

  const workItemsIn = vi.fn().mockResolvedValue({ data: targets.workItems ?? [], error: null });
  const workItemsSelect = vi.fn().mockReturnValue({ in: workItemsIn });

  const notesIn = vi.fn().mockResolvedValue({ data: targets.notes ?? [], error: null });
  const notesSelect = vi.fn().mockReturnValue({ in: notesIn });

  const from = vi.fn((table: string) => {
    if (table === "work_items") return { select: workItemsSelect };
    if (table === "notes") return { select: notesSelect };
    return { select: signalsSelect };
  });

  return { client: { from } as never, from, workItemsSelect, workItemsIn, notesSelect, notesIn };
}

function markAllSignalsReadClient() {
  const is = vi.fn().mockResolvedValue({ error: null });
  const eq = vi.fn().mockReturnValue({ is });
  const update = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ update });
  return { client: { from } as never, from, update, eq, is };
}

describe("unreadCountsByWorkspace", () => {
  it("counts unread per workspace", async () => {
    const counts = await unreadCountsByWorkspace(
      clientReturning([{ workspace_id: "a" }, { workspace_id: "b" }, { workspace_id: "a" }]),
    );

    expect(counts.get("a")).toBe(2);
    expect(counts.get("b")).toBe(1);
  });

  it("returns an empty map when nothing is unread", async () => {
    const counts = await unreadCountsByWorkspace(clientReturning([]));
    expect(counts.size).toBe(0);
  });
});

describe("listSignals", () => {
  it("maps a row from snake_case to camelCase", async () => {
    const { client } = listSignalsClient([
      {
        id: "sig-1",
        kind: "mention",
        created_at: "2026-08-01T00:00:00.000Z",
        read_at: null,
        actor_id: "actor-1",
        work_item_id: "work-1",
        note_id: "note-1",
        profiles: { display_name: "Ada" },
      },
    ]);
    const signals = await listSignals(client, "workspace-1");

    expect(signals).toEqual([
      {
        id: "sig-1",
        kind: "mention",
        createdAt: "2026-08-01T00:00:00.000Z",
        readAt: null,
        actorId: "actor-1",
        actorName: "Ada",
        workItemId: "work-1",
        noteId: "note-1",
        targetTitle: null,
      },
    ]);
  });

  it("yields a null actorId when the actor's account is gone (actor_id is on delete set null)", async () => {
    const { client } = listSignalsClient([
      {
        id: "sig-1",
        kind: "mention",
        created_at: "2026-08-01T00:00:00.000Z",
        read_at: null,
        actor_id: null,
        work_item_id: null,
        note_id: null,
        profiles: null,
      },
    ]);
    const signals = await listSignals(client, "workspace-1");

    expect(signals[0].actorId).toBeNull();
  });

  it("resolves the work item title as targetTitle", async () => {
    const { client } = listSignalsClient(
      [
        {
          id: "sig-1",
          kind: "assigned",
          created_at: "2026-08-01T00:00:00.000Z",
          read_at: null,
          work_item_id: "work-1",
          note_id: null,
          profiles: { display_name: "Ada" },
        },
      ],
      { workItems: [{ id: "work-1", title: "Ship the graph" }] },
    );

    const signals = await listSignals(client, "workspace-1");
    expect(signals[0].targetTitle).toBe("Ship the graph");
  });

  it("resolves the note title as targetTitle", async () => {
    const { client } = listSignalsClient(
      [
        {
          id: "sig-1",
          kind: "mentioned",
          created_at: "2026-08-01T00:00:00.000Z",
          read_at: null,
          work_item_id: null,
          note_id: "note-1",
          profiles: { display_name: "Ada" },
        },
      ],
      { notes: [{ id: "note-1", title: "Roadmap notes" }] },
    );

    const signals = await listSignals(client, "workspace-1");
    expect(signals[0].targetTitle).toBe("Roadmap notes");
  });

  it("yields a null targetTitle when the target row is absent (genuinely deleted)", async () => {
    const { client } = listSignalsClient(
      [
        {
          id: "sig-1",
          kind: "assigned",
          created_at: "2026-08-01T00:00:00.000Z",
          read_at: null,
          work_item_id: "work-gone",
          note_id: null,
          profiles: { display_name: "Ada" },
        },
      ],
      { workItems: [] },
    );

    const signals = await listSignals(client, "workspace-1");
    expect(signals[0].targetTitle).toBeNull();
  });

  it("issues no title query at all when no signal has a target", async () => {
    const { client, workItemsSelect, notesSelect } = listSignalsClient([
      {
        id: "sig-1",
        kind: "role_changed",
        created_at: "2026-08-01T00:00:00.000Z",
        read_at: null,
        work_item_id: null,
        note_id: null,
        profiles: { display_name: "Ada" },
      },
    ]);

    await listSignals(client, "workspace-1");

    expect(workItemsSelect).not.toHaveBeenCalled();
    expect(notesSelect).not.toHaveBeenCalled();
  });

  it("yields a null actorName when profiles is null", async () => {
    const { client } = listSignalsClient([
      {
        id: "sig-2",
        kind: "mention",
        created_at: "2026-08-01T00:00:00.000Z",
        read_at: "2026-08-02T00:00:00.000Z",
        work_item_id: null,
        note_id: null,
        profiles: null,
      },
    ]);
    const signals = await listSignals(client, "workspace-1");

    expect(signals[0].actorName).toBeNull();
  });
});

describe("markAllSignalsRead", () => {
  it("only touches rows that are still unread", async () => {
    const { client, is } = markAllSignalsReadClient();

    await markAllSignalsRead(client, { workspaceId: "workspace-1" });

    expect(is).toHaveBeenCalledWith("read_at", null);
  });

  it("writes only the read_at column", async () => {
    const { client, update } = markAllSignalsReadClient();

    await markAllSignalsRead(client, { workspaceId: "workspace-1" });

    expect(update).toHaveBeenCalledTimes(1);
    const patch = update.mock.calls[0][0];
    expect(Object.keys(patch)).toEqual(["read_at"]);
  });
});
