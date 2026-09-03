import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { clsx } from "clsx";
import { ArrowLeft, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { EmptyState } from "../../components/empty-state";
import { supabase } from "../../lib/supabase/client";
import { useAuth } from "../auth/use-auth";
import { notesKeys } from "../notes/notes.queries";
import { useWorkspaceId } from "../workspaces/workspace-context";
import { MapCanvas, type MapCanvasHandle } from "./map-canvas";
import { createConnectedNode, createNodeAt } from "./map-graph-ops";
import { MapInspector } from "./map-inspector";
import { arrangeGraph, placeNewNode, type ArrangeMode } from "./map-layouts";
import { MapToolbar } from "./map-toolbar";
import type { ConvertedObjectType, EditableMapGraph } from "./map-types";
import { convertMindMapNode, getMindMapGraph, mindMapKeys, replaceMindMapGraph } from "./maps.queries";
import { useMapEditor, type MapSelection } from "./use-map-editor";

export const MAP_HINTS_KEY = "orbit-flo:maps-hints-dismissed";
const HINT_NODE_LIMIT = 3;
const editableTags = new Set(["INPUT", "TEXTAREA", "SELECT"]);

function readHintsDismissed() {
  try {
    return window.localStorage.getItem(MAP_HINTS_KEY) === "1";
  } catch {
    return false;
  }
}

function writeHintsDismissed() {
  try {
    window.localStorage.setItem(MAP_HINTS_KEY, "1");
  } catch {
    // Storage can be unavailable; the strip simply returns next visit.
  }
}

type MapEditorPageProps = {
  mapId: string;
  projectId?: string | null;
  onBack: () => void;
  initialSelection?: MapSelection;
};

function MapTitleInput({ title, onCommit }: { title: string; onCommit: (title: string) => void }) {
  const [draft, setDraft] = useState(title);
  const [isEditing, setIsEditing] = useState(false);
  const cancelledRef = useRef(false);

  useEffect(() => {
    if (!isEditing) setDraft(title);
  }, [isEditing, title]);

  function commit() {
    setIsEditing(false);
    if (cancelledRef.current) {
      cancelledRef.current = false;
      setDraft(title);
      return;
    }
    const trimmed = draft.trim();
    if (trimmed && trimmed !== title) onCommit(trimmed);
    else setDraft(title);
  }

  return (
    <input
      aria-label="Map title"
      className="map-title-input min-w-0 flex-1 bg-transparent px-1 text-base font-semibold text-white outline-none"
      onBlur={commit}
      onChange={(event) => setDraft(event.target.value)}
      onFocus={() => setIsEditing(true)}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          event.currentTarget.blur();
        }
        if (event.key === "Escape") {
          event.preventDefault();
          cancelledRef.current = true;
          event.currentTarget.blur();
        }
      }}
      value={draft}
    />
  );
}

const hints = [
  ["Double-click", "to add"],
  ["Tab", "child"],
  ["Enter", "sibling"],
  ["Drag a handle", "to connect"],
] as const;

function MapHintStrip({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div className="map-hint-strip" data-testid="map-hint-strip">
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
        {hints.map(([key, text], index) => (
          <span className="inline-flex items-center gap-1.5" key={key}>
            {index > 0 ? (
              <span aria-hidden="true" className="text-slate-600">
                ·
              </span>
            ) : null}
            <kbd className="map-hint-key">{key}</kbd>
            {text}
          </span>
        ))}
      </p>
      <button aria-label="Dismiss hints" className="grid h-6 w-6 place-items-center rounded-full text-slate-500 hover:text-slate-200" onClick={onDismiss} type="button">
        <X aria-hidden="true" className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export function MapEditorPage({ mapId, projectId = null, onBack, initialSelection = null }: MapEditorPageProps) {
  const { isLoading: isAuthLoading, user } = useAuth();
  const workspaceId = useWorkspaceId();
  const queryClient = useQueryClient();
  const canvasRef = useRef<MapCanvasHandle>(null);
  const [renamingNodeId, setRenamingNodeId] = useState<string | null>(null);
  const [isInspectorOpen, setIsInspectorOpen] = useState(initialSelection !== null);
  const [hintsDismissed, setHintsDismissed] = useState(readHintsDismissed);

  const graphQuery = useQuery({
    queryKey: mindMapKeys.graph(workspaceId, mapId),
    queryFn: () => getMindMapGraph(supabase, { workspaceId, mapId }),
    enabled: Boolean(user),
    staleTime: 5 * 60_000,
  });

  const save = useCallback(
    (graph: EditableMapGraph) => replaceMindMapGraph(supabase, { workspaceId, mapId, graph }),
    [mapId, workspaceId],
  );
  const onSaved = useCallback(
    (graph: EditableMapGraph) => {
      const key = mindMapKeys.graph(workspaceId, mapId);
      const previous = queryClient.getQueryData<EditableMapGraph>(key);
      queryClient.setQueryData(key, graph);
      // Every save can change the shape of the map, so the library thumbnails are stale.
      void queryClient.invalidateQueries({ queryKey: mindMapKeys.previews(workspaceId, projectId) });
      if (previous?.title !== graph.title) {
        void queryClient.invalidateQueries({ queryKey: mindMapKeys.list(workspaceId, projectId) });
      }
    },
    [mapId, projectId, queryClient, workspaceId],
  );

  const editor = useMapEditor({ initialGraph: graphQuery.data ?? null, save, onSaved, initialSelection });
  const { graph, selection, setGraph, setSelection } = editor;

  useEffect(() => {
    if (selection) setIsInspectorOpen(true);
  }, [selection]);

  const selectedNode = selection?.kind === "node" ? (graph?.nodes.find((item) => item.id === selection.id) ?? null) : null;

  const convertMutation = useMutation({
    mutationFn: async (type: ConvertedObjectType) => {
      if (!selectedNode) throw new Error("Select a node before converting it.");
      if ((type === "task" || type === "milestone") && !projectId) {
        throw new Error("Choose a project map to convert to a task or milestone.");
      }
      await editor.flush();
      const result = await convertMindMapNode(supabase, { id: selectedNode.id, workspaceId, projectId, convertedType: type });
      const convertedId = result.node.converted_id ?? result.convertedObject?.id;
      const convertedType = result.node.converted_type as ConvertedObjectType | null;
      if (!convertedId || !convertedType || !result.node.converted_at) {
        throw new Error("Could not convert the selected node.");
      }
      return { nodeId: selectedNode.id, convertedId, convertedType, convertedAt: result.node.converted_at };
    },
    onSuccess: ({ nodeId, convertedId, convertedType, convertedAt }) => {
      editor.mergeServerNode(nodeId, { status: "converted", convertedType, convertedId, convertedAt });
      void queryClient.invalidateQueries({ queryKey: mindMapKeys.graph(workspaceId, mapId) });
      if (convertedType === "task" && projectId) {
        void queryClient.invalidateQueries({ queryKey: ["work-items", workspaceId, projectId] });
        void queryClient.invalidateQueries({ queryKey: ["due-calendar"] });
      }
      if (convertedType === "milestone" && projectId) {
        void queryClient.invalidateQueries({ queryKey: ["milestones", workspaceId, projectId] });
      }
      if (convertedType === "note") {
        void queryClient.invalidateQueries({ queryKey: notesKeys.workspace(workspaceId) });
        if (projectId) void queryClient.invalidateQueries({ queryKey: notesKeys.project(workspaceId, projectId) });
      }
    },
  });

  // A failed conversion's error message should not linger once the user moves on
  // to a different node or edge; clear it whenever the selection changes.
  const { reset: resetConversion } = convertMutation;
  useEffect(() => {
    resetConversion();
  }, [selection, resetConversion]);

  const handleAddNode = useCallback(() => {
    if (!graph) return;
    const nodeId = crypto.randomUUID();
    if (selection?.kind === "node") {
      setGraph(createConnectedNode(graph, selection.id, nodeId, crypto.randomUUID()));
    } else {
      const center = canvasRef.current?.viewportCenter() ?? { x: 0, y: 0 };
      setGraph(createNodeAt(graph, placeNewNode(graph.nodes, center), nodeId));
    }
    setSelection({ kind: "node", id: nodeId });
    setRenamingNodeId(nodeId);
  }, [graph, selection, setGraph, setSelection]);

  const handleArrange = useCallback(
    (mode: ArrangeMode) => {
      if (!graph) return;
      setGraph(arrangeGraph(graph, mode));
      window.requestAnimationFrame(() => canvasRef.current?.fitView());
    },
    [graph, setGraph],
  );

  useEffect(() => {
    function handleWindowKeyDown(event: KeyboardEvent) {
      if (!(event.ctrlKey || event.metaKey)) return;
      const key = event.key.toLowerCase();
      if (key === "s") {
        event.preventDefault();
        const activeElement = document.activeElement;
        if (activeElement instanceof HTMLInputElement && activeElement.getAttribute("aria-label") === "Map title") {
          activeElement.blur();
        }
        void editor.flush().catch(() => undefined);
        return;
      }
      const target = event.target as HTMLElement;
      if (editableTags.has(target.tagName) || target.isContentEditable) return;
      if (key === "z") {
        event.preventDefault();
        if (event.shiftKey) editor.redo();
        else editor.undo();
      } else if (key === "y") {
        event.preventDefault();
        editor.redo();
      }
    }

    window.addEventListener("keydown", handleWindowKeyDown);
    return () => window.removeEventListener("keydown", handleWindowKeyDown);
  }, [editor.flush, editor.undo, editor.redo]);

  function dismissHints() {
    writeHintsDismissed();
    setHintsDismissed(true);
  }

  if (isAuthLoading) {
    return <EmptyState isLoading title="Loading map" message="Checking your session." />;
  }
  if (!user) {
    return <EmptyState title="Sign in required" message="Sign in to plan with maps." />;
  }
  if (graphQuery.isError && !graph) {
    return (
      <EmptyState
        action={
          <div className="flex gap-2">
            <button className="orbit-button-secondary" onClick={() => void graphQuery.refetch()} type="button">
              Retry
            </button>
            <button className="orbit-button-tertiary" onClick={onBack} type="button">
              Back to maps
            </button>
          </div>
        }
        message={graphQuery.error.message}
        title="Could not load map"
      />
    );
  }
  if (!graph) {
    return <EmptyState isLoading title="Opening map" message="Loading the saved nodes and connections." />;
  }

  const showHints = !hintsDismissed && graph.nodes.length < HINT_NODE_LIMIT;
  const canvasHeight = projectId ? "h-[max(28rem,calc(100vh-14rem))]" : "h-[max(28rem,calc(100vh-9.5rem))]";

  return (
    <div className="orbit-page-enter grid gap-3" data-testid="map-editor">
      <header className="surface-whisper flex min-h-11 flex-wrap items-center gap-2 rounded-lg px-2 py-1">
        <button className="orbit-button-tertiary gap-1 px-2 py-1 text-xs" onClick={onBack} type="button">
          <ArrowLeft aria-hidden="true" className="h-3.5 w-3.5" />
          Maps
        </button>
        <MapTitleInput onCommit={(title) => setGraph({ ...graph, title }, { coalesceKey: "map:title" })} title={graph.title} />
        <MapToolbar
          canRedo={editor.canRedo}
          canUndo={editor.canUndo}
          error={editor.error}
          isInspectorOpen={isInspectorOpen}
          onAddNode={handleAddNode}
          onArrange={handleArrange}
          onFitView={() => canvasRef.current?.fitView()}
          onRedo={editor.redo}
          onRetrySave={editor.retry}
          onToggleInspector={() => setIsInspectorOpen((current) => !current)}
          onUndo={editor.undo}
          status={editor.status}
        />
      </header>

      <div className={clsx("grid gap-3", isInspectorOpen && "lg:grid-cols-[minmax(0,1fr)_20rem]")}>
        <div className="relative min-w-0">
          <MapCanvas
            className={canvasHeight}
            graph={graph}
            onChange={setGraph}
            onRenamingChange={setRenamingNodeId}
            onSelect={setSelection}
            ref={canvasRef}
            renamingNodeId={renamingNodeId}
            selection={selection}
          />
          {graph.nodes.length === 0 ? <p className="map-canvas-empty">Double-click anywhere to place your first idea</p> : null}
          {showHints ? <MapHintStrip onDismiss={dismissHints} /> : null}
        </div>

        {isInspectorOpen ? (
          <aside aria-label="Map details" className="map-inspector-dock surface-raised">
            <div className="flex justify-end pb-2 lg:hidden">
              <button className="orbit-button-secondary px-2 py-1 text-xs" onClick={() => setIsInspectorOpen(false)} type="button">
                Close details
              </button>
            </div>
            <MapInspector
              conversionError={convertMutation.error?.message ?? null}
              graph={graph}
              isConverting={convertMutation.isPending}
              onConvert={(type) => convertMutation.mutate(type)}
              onGraphChange={setGraph}
              onSelect={setSelection}
              projectId={projectId}
              selection={selection}
              workspaceId={workspaceId}
            />
          </aside>
        ) : null}
      </div>
    </div>
  );
}
