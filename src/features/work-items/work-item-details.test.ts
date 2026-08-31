import { describe, expect, it, vi } from "vitest";
import {
  createComment,
  deleteAttachment,
  getWorkItemMeta,
  sanitizeFileName,
  toggleChecklistItem,
  uploadAttachment,
} from "./work-item-details.queries";

type Result = { data: unknown; error: unknown };

function builder(result: Result) {
  const chain: Record<string, unknown> = {};
  const handler = vi.fn((..._args: unknown[]) => chain);
  for (const method of ["select", "insert", "update", "delete", "eq", "in", "order", "single"]) {
    chain[method] = handler;
  }
  (chain as { then: unknown }).then = (resolve: (value: Result) => void) => resolve(result);
  return { chain, handler };
}

function clientWith(results: Result[], storage?: Record<string, ReturnType<typeof vi.fn>>) {
  let call = 0;
  const builders = results.map((result) => builder(result));
  const from = vi.fn(() => builders[Math.min(call++, Math.max(builders.length - 1, 0))].chain);
  const storageFns = {
    upload: storage?.upload ?? vi.fn().mockResolvedValue({ data: {}, error: null }),
    remove: storage?.remove ?? vi.fn().mockResolvedValue({ data: {}, error: null }),
    createSignedUrl: storage?.createSignedUrl ?? vi.fn().mockResolvedValue({ data: { signedUrl: "https://signed" }, error: null }),
  };
  const client = {
    from,
    storage: { from: vi.fn(() => storageFns) },
  } as never;
  return { client, from, builders, storageFns };
}

describe("sanitizeFileName", () => {
  it("lowercases and strips unsafe characters", () => {
    expect(sanitizeFileName("My Report (v2).PDF")).toBe("my-report-v2.pdf");
  });
});

describe("uploadAttachment", () => {
  it("rejects files over 10 MB without touching storage", async () => {
    const { client, storageFns } = clientWith([{ data: null, error: null }]);
    const bigFile = { name: "big.zip", size: 11 * 1024 * 1024, type: "application/zip" } as File;

    await expect(
      uploadAttachment(client, { workspaceId: "ws", workItemId: "wi", userId: "u", file: bigFile }),
    ).rejects.toThrow("Attachments are limited to 10 MB.");
    expect(storageFns.upload).not.toHaveBeenCalled();
  });

  it("uploads to a namespaced path then inserts the row", async () => {
    const { client, storageFns, builders } = clientWith([{ data: { id: "att-1" }, error: null }]);
    const file = { name: "Spec Draft.pdf", size: 1024, type: "application/pdf" } as File;

    await uploadAttachment(client, { workspaceId: "ws", workItemId: "wi", userId: "u", file });

    const uploadedPath = storageFns.upload.mock.calls[0]?.[0] as string;
    expect(uploadedPath.startsWith("ws/wi/")).toBe(true);
    expect(uploadedPath.endsWith("-spec-draft.pdf")).toBe(true);

    const insertArg = builders[0].handler.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(insertArg.file_name).toBe("Spec Draft.pdf");
    expect(insertArg.storage_path).toBe(uploadedPath);
    expect(insertArg.size_bytes).toBe(1024);
  });
});

describe("deleteAttachment", () => {
  it("removes the storage object before the row", async () => {
    const { client, storageFns, from } = clientWith([{ data: null, error: null }]);

    await deleteAttachment(client, { id: "att-1", workspaceId: "ws", storagePath: "ws/wi/x.pdf" });

    expect(storageFns.remove).toHaveBeenCalledWith(["ws/wi/x.pdf"]);
    expect(from).toHaveBeenCalledWith("work_item_attachments");
  });
});

describe("getWorkItemMeta", () => {
  it("returns empty maps for no items without querying", async () => {
    const { client, from } = clientWith([]);

    const meta = await getWorkItemMeta(client, { workspaceId: "ws", workItemIds: [] });

    expect(meta.labelsByItem.size).toBe(0);
    expect(meta.commentCountByItem.size).toBe(0);
    expect(from).not.toHaveBeenCalled();
  });

  it("groups labels and counts per item", async () => {
    const label = { id: "l1", name: "Design", color: "violet" };
    const { client } = clientWith([
      { data: [{ work_item_id: "a", labels: label }], error: null },
      {
        data: [
          { work_item_id: "a", is_done: true },
          { work_item_id: "a", is_done: false },
          { work_item_id: "b", is_done: true },
        ],
        error: null,
      },
      { data: [{ work_item_id: "b" }, { work_item_id: "b" }], error: null },
      { data: [{ work_item_id: "a" }], error: null },
    ]);

    const meta = await getWorkItemMeta(client, { workspaceId: "ws", workItemIds: ["a", "b"] });

    expect(meta.labelsByItem.get("a")).toEqual([label]);
    expect(meta.checklistByItem.get("a")).toEqual({ done: 1, total: 2 });
    expect(meta.checklistByItem.get("b")).toEqual({ done: 1, total: 1 });
    expect(meta.commentCountByItem.get("b")).toBe(2);
    expect(meta.attachmentCountByItem.get("a")).toBe(1);
  });
});

describe("createComment", () => {
  it("inserts the trimmed body", async () => {
    const { client, builders } = clientWith([{ data: { id: "c1" }, error: null }]);

    await createComment(client, { workspaceId: "ws", workItemId: "wi", userId: "u", body: "  Nice work  " });

    const insertArg = builders[0].handler.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(insertArg.body).toBe("Nice work");
    expect(insertArg.created_by).toBe("u");
  });
});

describe("toggleChecklistItem", () => {
  it("updates is_done", async () => {
    const { client, builders } = clientWith([{ data: { id: "ck1" }, error: null }]);

    await toggleChecklistItem(client, { id: "ck1", workspaceId: "ws", isDone: true });

    const updateArg = builders[0].handler.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(updateArg.is_done).toBe(true);
  });
});
