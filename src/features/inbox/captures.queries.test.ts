import { describe, expect, it, vi } from "vitest";
import { listInboxCaptures, updateCapture } from "./captures.queries";

function createQueryClient(result: { data: unknown; error: unknown } = { data: [], error: null }) {
  const query = {
    ...result,
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    is: vi.fn(() => query),
    order: vi.fn(() => query),
    update: vi.fn(() => query),
    single: vi.fn(() => result),
  };

  return {
    client: {
      from: vi.fn(() => query),
    },
    query,
  };
}

describe("listInboxCaptures", () => {
  it("loads unprocessed workspace captures newest first", async () => {
    const { client, query } = createQueryClient();

    await listInboxCaptures(client as never, "workspace-1");

    expect(client.from).toHaveBeenCalledWith("captures");
    expect(query.eq).toHaveBeenCalledWith("workspace_id", "workspace-1");
    expect(query.is).toHaveBeenCalledWith("processed_at", null);
    expect(query.order).toHaveBeenCalledWith("created_at", { ascending: false });
  });
});

describe("updateCapture", () => {
  it("updates a workspace scoped capture", async () => {
    const { client, query } = createQueryClient({ data: { id: "capture-1" }, error: null });

    await updateCapture(client as never, {
      id: "capture-1",
      workspaceId: "workspace-1",
      projectId: "project-1",
      processedAt: "2026-07-01T00:00:00.000Z",
    });

    expect(query.update).toHaveBeenCalledWith({
      project_id: "project-1",
      work_item_id: undefined,
      type: undefined,
      title: undefined,
      body: undefined,
      processed_at: "2026-07-01T00:00:00.000Z",
    });
    expect(query.eq).toHaveBeenNthCalledWith(1, "id", "capture-1");
    expect(query.eq).toHaveBeenNthCalledWith(2, "workspace_id", "workspace-1");
  });
});
