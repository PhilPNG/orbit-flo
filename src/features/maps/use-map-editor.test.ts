import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { EditableMapGraph } from "./map-types";
import { mergeServerGraph, useMapEditor } from "./use-map-editor";

function graphWith(title: string, x = 0): EditableMapGraph {
  return {
    title,
    description: "",
    defaultView: "mind_map",
    nodes: [{ id: "n1", title: "Node", body: "", nodeType: "idea", status: "open", position: { x, y: 0 }, accent: "cyan", tags: [] }],
    edges: [],
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const initial = graphWith("Initial");

function setup(save = vi.fn(async (graph: EditableMapGraph) => graph)) {
  const onSaved = vi.fn();
  const hook = renderHook(() => useMapEditor({ initialGraph: initial, save, onSaved }));
  return { ...hook, save, onSaved };
}

describe("useMapEditor", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("saves once, with the latest graph, after rapid edits", async () => {
    const { result, save } = setup();

    act(() => result.current.setGraph(graphWith("One")));
    act(() => result.current.setGraph(graphWith("Two")));
    act(() => result.current.setGraph(graphWith("Three")));
    expect(result.current.status).toBe("dirty");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(800);
    });

    expect(save).toHaveBeenCalledTimes(1);
    expect(save.mock.calls[0][0].title).toBe("Three");
    expect(result.current.status).toBe("saved");
  });

  it("sends exactly one follow-up save when edits arrive during an in-flight save", async () => {
    const first = deferred<EditableMapGraph>();
    const save = vi.fn().mockReturnValueOnce(first.promise).mockImplementation(async (graph: EditableMapGraph) => graph);
    const { result } = setup(save);

    act(() => result.current.setGraph(graphWith("One")));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(800);
    });
    expect(save).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe("saving");

    act(() => result.current.setGraph(graphWith("Two")));
    act(() => result.current.setGraph(graphWith("Three")));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(800);
    });
    expect(save).toHaveBeenCalledTimes(1);

    await act(async () => {
      first.resolve(graphWith("One"));
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(save).toHaveBeenCalledTimes(2);
    expect(save.mock.calls[1][0].title).toBe("Three");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current.status).toBe("saved");
  });

  it("reports dirty status when an edit lands mid-save and the save settles before the debounce fires", async () => {
    const first = deferred<EditableMapGraph>();
    const save = vi.fn().mockReturnValueOnce(first.promise).mockImplementation(async (graph: EditableMapGraph) => graph);
    const { result } = setup(save);

    act(() => result.current.setGraph(graphWith("One")));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(800);
    });
    expect(save).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe("saving");

    act(() => result.current.setGraph(graphWith("Two")));

    await act(async () => {
      first.resolve(graphWith("One"));
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(save).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe("dirty");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(800);
    });

    expect(save).toHaveBeenCalledTimes(2);
    expect(save.mock.calls[1][0].title).toBe("Two");
    expect(result.current.status).toBe("saved");
  });

  it("seeds the cache when a save settles after unmount", async () => {
    const first = deferred<EditableMapGraph>();
    const save = vi.fn().mockReturnValueOnce(first.promise).mockImplementation(async (graph: EditableMapGraph) => graph);
    const onSaved = vi.fn();
    const { result, unmount } = renderHook(() => useMapEditor({ initialGraph: initial, save, onSaved }));

    act(() => result.current.setGraph(graphWith("One")));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(800);
    });
    expect(save).toHaveBeenCalledTimes(1);
    expect(onSaved).not.toHaveBeenCalled();

    unmount();

    await act(async () => {
      first.resolve(graphWith("One"));
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ title: "One" }));
  });

  it("saves edits made during an in-flight save on unmount", async () => {
    const first = deferred<EditableMapGraph>();
    const save = vi.fn().mockReturnValueOnce(first.promise).mockImplementation(async (graph: EditableMapGraph) => graph);
    const onSaved = vi.fn();
    const { result, unmount } = renderHook(() => useMapEditor({ initialGraph: initial, save, onSaved }));

    act(() => result.current.setGraph(graphWith("A")));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(800);
    });
    expect(save).toHaveBeenCalledTimes(1);
    expect(save.mock.calls[0][0].title).toBe("A");

    act(() => result.current.setGraph(graphWith("B"))); // dirty again while save #1 is in flight
    unmount(); // navigate away before the debounce fires

    await act(async () => {
      first.resolve(graphWith("A"));
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(save).toHaveBeenCalledTimes(2);
    expect(save.mock.calls[1][0].title).toBe("B");
    expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ title: "B" }));
  });

  it("flush saves immediately and resolves once the save settles", async () => {
    const { result, save, onSaved } = setup();

    act(() => result.current.setGraph(graphWith("Flushed")));
    await act(async () => {
      await result.current.flush();
    });

    expect(save).toHaveBeenCalledTimes(1);
    expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ title: "Flushed" }));
    expect(result.current.status).toBe("saved");
  });

  it("keeps local edits, reports the error, and retries on the schedule", async () => {
    const save = vi.fn().mockRejectedValue(new Error("offline"));
    const { result } = setup(save);

    act(() => result.current.setGraph(graphWith("Edited")));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(800);
    });

    expect(result.current.status).toBe("error");
    expect(result.current.error).toBe("offline");
    expect(result.current.graph?.title).toBe("Edited");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(save).toHaveBeenCalledTimes(2);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(6000);
    });
    expect(save).toHaveBeenCalledTimes(3);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(18000);
    });
    expect(save).toHaveBeenCalledTimes(4);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60000);
    });
    expect(save).toHaveBeenCalledTimes(4);

    save.mockImplementation(async (graph: EditableMapGraph) => graph);
    act(() => result.current.retry());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current.status).toBe("saved");
  });

  it("cancels a stale retry timer once a later save succeeds", async () => {
    const first = deferred<EditableMapGraph>();
    const save = vi.fn().mockReturnValueOnce(first.promise).mockImplementation(async (graph: EditableMapGraph) => graph);
    const { result } = setup(save);

    act(() => result.current.setGraph(graphWith("One")));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(800);
    }); // save #1 in flight

    act(() => result.current.setGraph(graphWith("Two"))); // edit before the failure; debounce armed

    await act(async () => {
      first.reject(new Error("offline"));
      await vi.advanceTimersByTimeAsync(0);
    }); // catch arms the retry

    await act(async () => {
      await vi.advanceTimersByTimeAsync(800);
    }); // debounce fires save #2, succeeds

    expect(save).toHaveBeenCalledTimes(2);
    expect(save.mock.calls[1][0].title).toBe("Two");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30000);
    });
    expect(save).toHaveBeenCalledTimes(2); // 3 on the unfixed code
    expect(result.current.status).toBe("saved");
  });

  it("flush rejects when the save fails so callers can stop", async () => {
    const save = vi.fn().mockRejectedValue(new Error("offline"));
    const { result } = setup(save);

    act(() => result.current.setGraph(graphWith("Edited")));
    await expect(
      act(async () => {
        await result.current.flush();
      }),
    ).rejects.toThrow("offline");
  });

  it("undoes and redoes", () => {
    const { result } = setup();

    act(() => result.current.setGraph(graphWith("One")));
    act(() => result.current.setGraph(graphWith("Two")));
    expect(result.current.canUndo).toBe(true);

    act(() => result.current.undo());
    expect(result.current.graph?.title).toBe("One");
    act(() => result.current.undo());
    expect(result.current.graph?.title).toBe("Initial");
    expect(result.current.canUndo).toBe(false);

    act(() => result.current.redo());
    expect(result.current.graph?.title).toBe("One");
    expect(result.current.canRedo).toBe(true);
  });

  it("caps the undo stack at 50 entries", () => {
    const { result } = setup();

    for (let index = 1; index <= 60; index += 1) {
      act(() => result.current.setGraph(graphWith(`Edit ${index}`)));
    }
    for (let index = 0; index < 50; index += 1) {
      act(() => result.current.undo());
    }

    expect(result.current.graph?.title).toBe("Edit 10");
    expect(result.current.canUndo).toBe(false);
  });

  it("records a drag as one undo entry when frames are not undoable", () => {
    const { result } = setup();

    act(() => result.current.setGraph(graphWith("Initial", 10), { undoable: false }));
    act(() => result.current.setGraph(graphWith("Initial", 20), { undoable: false }));
    act(() => result.current.setGraph(graphWith("Initial", 30), { undoable: true }));

    act(() => result.current.undo());
    expect(result.current.graph?.nodes[0].position.x).toBe(0);
    expect(result.current.canUndo).toBe(false);
  });

  it("coalesces edits with the same key inside 500ms", () => {
    const { result } = setup();

    act(() => result.current.setGraph(graphWith("T"), { coalesceKey: "title" }));
    act(() => vi.advanceTimersByTime(200));
    act(() => result.current.setGraph(graphWith("Ty"), { coalesceKey: "title" }));
    act(() => vi.advanceTimersByTime(600));
    act(() => result.current.setGraph(graphWith("Typ"), { coalesceKey: "title" }));

    act(() => result.current.undo());
    expect(result.current.graph?.title).toBe("Ty");
    act(() => result.current.undo());
    expect(result.current.graph?.title).toBe("Initial");
  });

  it("merges server-owned fields without moving nodes", async () => {
    const save = vi.fn(async (graph: EditableMapGraph) => ({
      ...graph,
      nodes: graph.nodes.map((node) => ({ ...node, position: { x: 999, y: 999 }, convertedType: "note" as const, convertedId: "note-1", convertedAt: "2026-09-01T00:00:00.000Z" })),
    }));
    const { result } = setup(save);

    act(() => result.current.setGraph(graphWith("Edited", 5)));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(800);
    });

    expect(result.current.graph?.nodes[0].position.x).toBe(5);
    expect(result.current.graph?.nodes[0].convertedId).toBe("note-1");
  });

  it("mergeServerNode patches a node without dirtying the map", () => {
    const { result } = setup();

    act(() => result.current.mergeServerNode("n1", { status: "converted", convertedType: "task", convertedId: "task-1" }));

    expect(result.current.graph?.nodes[0].convertedId).toBe("task-1");
    expect(result.current.status).toBe("saved");
  });

  it("registers a beforeunload guard only while unsaved", () => {
    const addSpy = vi.spyOn(window, "addEventListener");
    const removeSpy = vi.spyOn(window, "removeEventListener");
    const { result } = setup();

    expect(addSpy.mock.calls.some(([type]) => type === "beforeunload")).toBe(false);
    act(() => result.current.setGraph(graphWith("Dirty")));
    expect(addSpy.mock.calls.some(([type]) => type === "beforeunload")).toBe(true);

    return act(async () => {
      await vi.advanceTimersByTimeAsync(800);
    }).then(() => {
      expect(removeSpy.mock.calls.some(([type]) => type === "beforeunload")).toBe(true);
    });
  });
});

describe("mergeServerGraph", () => {
  it("copies converted fields by node id and leaves unknown nodes alone", () => {
    const local = graphWith("Local", 1);
    const server = { ...local, nodes: [{ ...local.nodes[0], position: { x: 50, y: 50 }, convertedType: "task" as const, convertedId: "t1", convertedAt: "now" }] };

    const merged = mergeServerGraph(local, server);

    expect(merged.nodes[0].position).toEqual({ x: 1, y: 0 });
    expect(merged.nodes[0]).toMatchObject({ convertedType: "task", convertedId: "t1", convertedAt: "now" });
  });
});
