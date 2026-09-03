import { useCallback, useEffect, useRef, useState } from "react";
import type { EditableMapGraph, EditableMapNode } from "./map-types";

export type MapSaveStatus = "saved" | "dirty" | "saving" | "error";
export type MapSelection = { kind: "node" | "edge"; id: string } | null;
export type SetGraphOptions = { undoable?: boolean; coalesceKey?: string };

const SAVE_DEBOUNCE_MS = 800;
const COALESCE_WINDOW_MS = 500;
const UNDO_LIMIT = 50;
export const RETRY_DELAYS_MS = [2000, 6000, 18000];

type UseMapEditorInput = {
  initialGraph: EditableMapGraph | null;
  save: (graph: EditableMapGraph) => Promise<EditableMapGraph>;
  onSaved?: (graph: EditableMapGraph) => void;
  initialSelection?: MapSelection;
};

/** Only the fields the server owns come back into local state; positions and text stay local. */
export function mergeServerGraph(local: EditableMapGraph, server: EditableMapGraph): EditableMapGraph {
  const serverNodes = new Map(server.nodes.map((node) => [node.id, node]));
  return {
    ...local,
    nodes: local.nodes.map((node) => {
      const remote = serverNodes.get(node.id);
      if (!remote) return node;
      return {
        ...node,
        convertedType: remote.convertedType ?? null,
        convertedId: remote.convertedId ?? null,
        convertedAt: remote.convertedAt ?? null,
      };
    }),
  };
}

function errorMessage(cause: unknown) {
  return cause instanceof Error && cause.message ? cause.message : "Could not save the map.";
}

export function useMapEditor({ initialGraph, save, onSaved, initialSelection = null }: UseMapEditorInput) {
  const [graph, setGraphState] = useState<EditableMapGraph | null>(initialGraph);
  const [selection, setSelection] = useState<MapSelection>(initialSelection);
  const [status, setStatus] = useState<MapSaveStatus>("saved");
  const [error, setError] = useState<string | null>(null);
  const [, setHistoryVersion] = useState(0);

  const graphRef = useRef<EditableMapGraph | null>(initialGraph);
  const committedRef = useRef<EditableMapGraph | null>(initialGraph);
  const undoRef = useRef<EditableMapGraph[]>([]);
  const redoRef = useRef<EditableMapGraph[]>([]);
  const lastPushRef = useRef<{ key: string | null; at: number }>({ key: null, at: 0 });
  const loadedRef = useRef(initialGraph !== null);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlightRef = useRef<Promise<void> | null>(null);
  const pendingRef = useRef(false);
  const dirtyRef = useRef(false);
  const attemptRef = useRef(0);
  const errorRef = useRef<string | null>(null);
  const saveRef = useRef(save);
  saveRef.current = save;
  const onSavedRef = useRef(onSaved);
  onSavedRef.current = onSaved;
  const mountedRef = useRef(true);

  useEffect(() => {
    if (loadedRef.current || !initialGraph) return;
    loadedRef.current = true;
    graphRef.current = initialGraph;
    committedRef.current = initialGraph;
    setGraphState(initialGraph);
  }, [initialGraph]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const bumpHistory = useCallback(() => setHistoryVersion((version) => version + 1), []);

  const runSave = useCallback((): Promise<void> => {
    if (inFlightRef.current) {
      pendingRef.current = true;
      return inFlightRef.current;
    }
    const snapshot = graphRef.current;
    if (!snapshot) return Promise.resolve();

    dirtyRef.current = false;
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
    setStatus("saving");

    const promise = saveRef
      .current(snapshot)
      .then((serverGraph) => {
        attemptRef.current = 0;
        errorRef.current = null;
        const merged = mergeServerGraph(graphRef.current ?? snapshot, serverGraph);
        graphRef.current = merged;
        committedRef.current = committedRef.current ? mergeServerGraph(committedRef.current, serverGraph) : merged;
        // Seed the cache even after unmount: onSaved only touches the query client,
        // and dropping it here is how a save that lands post-navigation went missing.
        onSavedRef.current?.(merged);
        if (!mountedRef.current) return;
        setGraphState(merged);
        setError(null);
      })
      .catch((cause: unknown) => {
        dirtyRef.current = true;
        errorRef.current = errorMessage(cause);
        if (!mountedRef.current) return;
        setError(errorRef.current);
        setStatus("error");
        const delay = RETRY_DELAYS_MS[attemptRef.current];
        attemptRef.current += 1;
        if (delay !== undefined) {
          retryTimerRef.current = setTimeout(() => {
            retryTimerRef.current = null;
            void runSave();
          }, delay);
        }
      })
      .finally(() => {
        inFlightRef.current = null;
        if (pendingRef.current) {
          pendingRef.current = false;
          void runSave();
        } else if (!mountedRef.current) {
          // no state to update once the editor is gone
        } else if (!dirtyRef.current) {
          setStatus("saved");
        } else if (errorRef.current === null) {
          setStatus("dirty");
        }
      });

    inFlightRef.current = promise;
    return promise;
  }, []);

  const scheduleSave = useCallback(() => {
    dirtyRef.current = true;
    attemptRef.current = 0;
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
    setStatus((current) => (current === "saving" ? current : "dirty"));
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      void runSave();
    }, SAVE_DEBOUNCE_MS);
  }, [runSave]);

  const setGraph = useCallback(
    (next: EditableMapGraph, options: SetGraphOptions = {}) => {
      const { undoable = true, coalesceKey } = options;
      const previous = committedRef.current;
      graphRef.current = next;
      setGraphState(next);

      if (undoable && previous) {
        const now = Date.now();
        const coalesce =
          coalesceKey !== undefined &&
          lastPushRef.current.key === coalesceKey &&
          now - lastPushRef.current.at < COALESCE_WINDOW_MS;
        if (!coalesce) {
          undoRef.current.push(previous);
          if (undoRef.current.length > UNDO_LIMIT) undoRef.current.shift();
          redoRef.current = [];
          bumpHistory();
        }
        lastPushRef.current = { key: coalesceKey ?? null, at: now };
        committedRef.current = next;
      }

      scheduleSave();
    },
    [bumpHistory, scheduleSave],
  );

  const restore = useCallback(
    (target: EditableMapGraph) => {
      graphRef.current = target;
      committedRef.current = target;
      lastPushRef.current = { key: null, at: 0 };
      setGraphState(target);
      bumpHistory();
      scheduleSave();
    },
    [bumpHistory, scheduleSave],
  );

  const undo = useCallback(() => {
    const previous = undoRef.current.pop();
    if (!previous) return;
    if (committedRef.current) redoRef.current.push(committedRef.current);
    restore(previous);
  }, [restore]);

  const redo = useCallback(() => {
    const next = redoRef.current.pop();
    if (!next) return;
    if (committedRef.current) undoRef.current.push(committedRef.current);
    restore(next);
  }, [restore]);

  const flush = useCallback(async () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
    if (dirtyRef.current || pendingRef.current) await runSave();
    while (inFlightRef.current) await inFlightRef.current;
    if (dirtyRef.current) throw new Error(errorRef.current ?? "Could not save the map.");
  }, [runSave]);

  const retry = useCallback(() => {
    attemptRef.current = 0;
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
    void runSave();
  }, [runSave]);

  const mergeServerNode = useCallback((nodeId: string, patch: Partial<EditableMapNode>) => {
    const apply = (target: EditableMapGraph | null) =>
      target ? { ...target, nodes: target.nodes.map((node) => (node.id === nodeId ? { ...node, ...patch } : node)) } : target;
    graphRef.current = apply(graphRef.current);
    committedRef.current = apply(committedRef.current);
    setGraphState(graphRef.current);
  }, []);

  useEffect(() => {
    if (status === "saved") return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [status]);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);

      // Persist whatever is still dirty. Edits made while a save was in flight used to
      // be dropped here; wait for that save to settle and then write the latest graph.
      const finish = () => {
        if (!dirtyRef.current || !graphRef.current) return;
        const snapshot = graphRef.current;
        dirtyRef.current = false;
        void saveRef
          .current(snapshot)
          .then((server) => onSavedRef.current?.(mergeServerGraph(snapshot, server)))
          .catch(() => undefined);
      };

      const inFlight = inFlightRef.current;
      if (inFlight) void inFlight.then(finish, finish);
      else finish();
    },
    [],
  );

  return {
    graph,
    setGraph,
    selection,
    setSelection,
    status,
    error,
    flush,
    retry,
    undo,
    redo,
    canUndo: undoRef.current.length > 0,
    canRedo: redoRef.current.length > 0,
    mergeServerNode,
  };
}
