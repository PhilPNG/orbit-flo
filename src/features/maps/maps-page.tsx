import { InlineAlert } from "../../components/inline-alert";
import { Rocket, Share2, Telescope } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import { EmptyState } from "../../components/empty-state";
import { supabase } from "../../lib/supabase/client";
import { useAuth } from "../auth/use-auth";
import { notesKeys } from "../notes/notes.queries";
import { MapCanvas } from "./map-canvas";
import { MapInspector } from "./map-inspector";
import { MapLibraryPanel } from "./map-library-panel";
import { createMapFromTemplate } from "./map-templates";
import { MapToolbar } from "./map-toolbar";
import type { ConvertedObjectType, EditableMapGraph, EditableMapNode } from "./map-types";
import { useWorkspaceId } from "../workspaces/workspace-context";
import {
  convertMindMapNode,
  createMindMap,
  getMindMapGraph,
  listMindMaps,
  mindMapKeys,
  replaceMindMapGraph,
} from "./maps.queries";

const mapsFeatureStrip = [
  { icon: Telescope, title: "See the big picture", body: "Zoom out and watch themes emerge." },
  { icon: Share2, title: "Connect what matters", body: "Link ideas into constellations." },
  { icon: Rocket, title: "Move ideas forward", body: "Turn a node into real mission work." },
];

type MapsPageProps = {
  projectId?: string | null;
};

function createBlankGraph(title = "Untitled map"): EditableMapGraph {
  return {
    title,
    description: "",
    defaultView: "mind_map",
    nodes: [],
    edges: [],
  };
}

function materializeTemplateGraph(graph: EditableMapGraph): EditableMapGraph {
  const nodeIds = new Map(graph.nodes.map((node) => [node.id, crypto.randomUUID()]));

  return {
    ...graph,
    nodes: graph.nodes.map((node) => ({ ...node, id: nodeIds.get(node.id) as string })),
    edges: graph.edges.map((edge) => ({
      ...edge,
      id: crypto.randomUUID(),
      sourceNodeId: nodeIds.get(edge.sourceNodeId) ?? edge.sourceNodeId,
      targetNodeId: nodeIds.get(edge.targetNodeId) ?? edge.targetNodeId,
    })),
  };
}

export function MapsPage({ projectId = null }: MapsPageProps) {
  const { isLoading, user } = useAuth();
  const workspaceId = useWorkspaceId();
  const queryClient = useQueryClient();
  const [selectedMapId, setSelectedMapId] = useState<string | null>(null);
  const [editableGraph, setEditableGraph] = useState<EditableMapGraph | null>(null);
  const [graphCache, setGraphCache] = useState<Record<string, EditableMapGraph>>({});
  const [dirtyMapIds, setDirtyMapIds] = useState<Set<string>>(() => new Set());
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [draftMessage, setDraftMessage] = useState<string | null>(null);
  const [isInspectorOpen, setIsInspectorOpen] = useState(false);
  const mapScope = projectId ?? "global";

  useEffect(() => {
    setSelectedMapId(null);
    setEditableGraph(null);
    setGraphCache({});
    setDirtyMapIds(new Set());
    setSelectedNodeId(null);
    setIsDirty(false);
    setDraftMessage(null);
    setIsInspectorOpen(false);
  }, [mapScope]);

  const mapsQuery = useQuery({
    queryKey: workspaceId ? mindMapKeys.list(workspaceId, projectId) : ["mind-maps", "no-workspace", projectId ?? "global"],
    queryFn: () => listMindMaps(supabase, { workspaceId: workspaceId as string, projectId }),
    enabled: Boolean(user),
    staleTime: 60_000,
  });

  const createMapMutation = useMutation({
    mutationFn: (input: { graph: EditableMapGraph; isLocalDraft?: boolean }) =>
      createMindMap(supabase, {
        workspaceId: workspaceId as string,
        projectId,
        userId: user?.id as string,
        title: input.graph.title,
        description: input.graph.description,
        defaultView: input.graph.defaultView,
      }),
    onSuccess: (map, input) => {
      setSelectedMapId(map.id);
      setEditableGraph(input.graph);
      setGraphCache((cache) => ({ ...cache, [map.id]: input.graph }));
      setDirtyMapIds((current) => {
        const next = new Set(current);
        if (input.isLocalDraft) {
          next.add(map.id);
        } else {
          next.delete(map.id);
        }
        return next;
      });
      setSelectedNodeId(null);
      setIsDirty(Boolean(input.isLocalDraft));
      void queryClient.invalidateQueries({ queryKey: mindMapKeys.list(map.workspace_id, projectId) });
    },
  });
  const createMap = createMapMutation.mutate;
  const isCreatingMap = createMapMutation.isPending;

  const maps = mapsQuery.data ?? [];
  const selectedMap = maps.find((map) => map.id === selectedMapId) ?? null;
  const cachedSelectedGraph = selectedMapId ? graphCache[selectedMapId] : undefined;
  const selectedGraphQuery = useQuery({
    queryKey:
      selectedMapId
        ? mindMapKeys.graph(workspaceId, selectedMapId)
        : ["mind-map-graph", "no-workspace-or-map"],
    queryFn: () => getMindMapGraph(supabase, { workspaceId: workspaceId as string, mapId: selectedMapId as string }),
    enabled: Boolean(user && selectedMapId && !cachedSelectedGraph),
    staleTime: 5 * 60_000,
  });
  const selectedNode = useMemo(
    () => (isCreatingMap ? null : (editableGraph?.nodes.find((node) => node.id === selectedNodeId) ?? null)),
    [isCreatingMap, editableGraph?.nodes, selectedNodeId],
  );

  useEffect(() => {
    if (!selectedNode) setIsInspectorOpen(false);
  }, [selectedNode]);
  const isSelectedGraphLoading = Boolean(selectedMapId && !editableGraph && selectedGraphQuery.isPending);

  useEffect(() => {
    if (!selectedMapId || !selectedGraphQuery.data) return;

    const loadedGraph = selectedGraphQuery.data;
    setEditableGraph(loadedGraph);
    setGraphCache((cache) => ({ ...cache, [selectedMapId]: loadedGraph }));
    setDirtyMapIds((current) => {
      const next = new Set(current);
      next.delete(selectedMapId);
      return next;
    });
    setIsDirty(false);
  }, [selectedGraphQuery.data, selectedMapId]);

  const saveMapMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Sign in before saving maps.");
      if (!selectedMapId) throw new Error("Choose a map before saving.");
      if (!editableGraph) throw new Error("Open a map before saving.");
      if (isSelectedGraphLoading) throw new Error("Wait for the map graph to load before saving.");

      const mapId = selectedMapId;
      const graph = editableGraph;

      const savedGraph = await replaceMindMapGraph(supabase, { workspaceId, mapId, graph });

      return { graph: savedGraph, mapId, workspaceId };
    },
    onSuccess: ({ graph, mapId, workspaceId: savedWorkspaceId }) => {
      setEditableGraph((current) => (selectedMapId === mapId ? graph : current));
      setGraphCache((cache) => ({ ...cache, [mapId]: graph }));
      setDirtyMapIds((current) => {
        const next = new Set(current);
        next.delete(mapId);
        return next;
      });
      if (selectedMapId === mapId) {
        setIsDirty(false);
      }
      setDraftMessage(null);
      queryClient.setQueryData(mindMapKeys.graph(savedWorkspaceId, mapId), graph);
      void queryClient.invalidateQueries({ queryKey: mindMapKeys.graph(savedWorkspaceId, mapId) });
      void queryClient.invalidateQueries({ queryKey: mindMapKeys.list(savedWorkspaceId, projectId) });
    },
  });
  const saveMap = saveMapMutation.mutate;
  const isSavingMap = saveMapMutation.isPending;
  const hasUnsavedSelectedMap = Boolean(!selectedMapId || isDirty || (selectedMapId && dirtyMapIds.has(selectedMapId)));
  const conversionDisabledReason =
    selectedNode && (hasUnsavedSelectedMap || isCreatingMap || isSavingMap || isSelectedGraphLoading)
      ? "Save this map before converting nodes."
      : null;
  const conversionDisabledReasons: Partial<Record<ConvertedObjectType, string>> =
    selectedNode && !conversionDisabledReason && !projectId
      ? {
          task: "Choose a project map before converting nodes to tasks.",
          milestone: "Choose a project map before converting nodes to milestones.",
        }
      : {};

  function updateConvertedNode(input: {
    mapId: string;
    nodeId: string;
    convertedType: ConvertedObjectType;
    convertedId: string;
    convertedAt: string;
  }) {
    const updateGraph = (graph: EditableMapGraph) => ({
      ...graph,
      nodes: graph.nodes.map((node) =>
        node.id === input.nodeId
          ? {
              ...node,
              status: "converted" as const,
              convertedType: input.convertedType,
              convertedId: input.convertedId,
              convertedAt: input.convertedAt,
            }
          : node,
      ),
    });

    setEditableGraph((current) => (selectedMapId === input.mapId && current ? updateGraph(current) : current));
    setGraphCache((cache) => {
      const graph = cache[input.mapId];
      return graph ? { ...cache, [input.mapId]: updateGraph(graph) } : cache;
    });
    if (workspaceId) {
      queryClient.setQueryData<EditableMapGraph | undefined>(mindMapKeys.graph(workspaceId, input.mapId), (graph) =>
        graph ? updateGraph(graph) : graph,
      );
    }
  }

  const convertNodeMutation = useMutation({
    mutationFn: async (type: ConvertedObjectType) => {
      if (!user) throw new Error("Sign in before converting nodes.");
      if (!selectedMapId || hasUnsavedSelectedMap) throw new Error("Save this map before converting nodes.");
      if (isCreatingMap || isSavingMap || isSelectedGraphLoading) {
        throw new Error("Save this map before converting nodes.");
      }
      if (!selectedNode) throw new Error("Select a node before converting it.");

      if (type === "task") {
        if (!projectId) throw new Error("Choose a project map before converting nodes to tasks.");
      } else if (type === "milestone") {
        if (!projectId) throw new Error("Choose a project map before converting nodes to milestones.");
      }

      const result = await convertMindMapNode(supabase, {
        id: selectedNode.id,
        workspaceId,
        convertedType: type,
        projectId,
      });
      const convertedId = result.node.converted_id ?? result.convertedObject?.id;
      const convertedType = result.node.converted_type as ConvertedObjectType | null;

      if (!convertedId || !convertedType || !result.node.converted_at) {
        throw new Error("Could not convert the selected node.");
      }

      return {
        convertedAt: result.node.converted_at,
        convertedId,
        convertedType,
        mapId: selectedMapId,
        nodeId: selectedNode.id,
        workspaceId,
      };
    },
    onSuccess: ({ convertedAt, convertedId, convertedType, mapId, nodeId, workspaceId: convertedWorkspaceId }) => {
      updateConvertedNode({ convertedAt, convertedId, convertedType, mapId, nodeId });
      setDraftMessage(null);
      void queryClient.invalidateQueries({ queryKey: mindMapKeys.graph(convertedWorkspaceId, mapId) });
      if (convertedType === "task" && projectId) {
        void queryClient.invalidateQueries({ queryKey: ["work-items", convertedWorkspaceId, projectId] });
        void queryClient.invalidateQueries({ queryKey: ["due-calendar"] });
      }
      if (convertedType === "milestone" && projectId) {
        void queryClient.invalidateQueries({ queryKey: ["milestones", convertedWorkspaceId, projectId] });
      }
      if (convertedType === "note") {
        void queryClient.invalidateQueries({ queryKey: notesKeys.workspace(convertedWorkspaceId) });
        if (projectId) {
          void queryClient.invalidateQueries({ queryKey: notesKeys.project(convertedWorkspaceId, projectId) });
        }
      }
    },
  });
  const convertNode = convertNodeMutation.mutate;
  const isConvertingNode = convertNodeMutation.isPending;

  const handleCreateBlank = useCallback(() => {
    setDraftMessage(null);
    createMap({ graph: createBlankGraph(), isLocalDraft: false });
  }, [createMap]);

  const handleCreateFromTemplate = useCallback((templateId: string) => {
    const graph = materializeTemplateGraph(createMapFromTemplate(templateId, { projectId }));
    setDraftMessage(null);
    setEditableGraph(graph);
    setIsDirty(true);
    createMap({ graph, isLocalDraft: true });
  }, [createMap, projectId]);

  const handlePreviewMap = useCallback((mapId: string) => {
    if (!user || graphCache[mapId]) return;

    void queryClient.prefetchQuery({
      queryKey: mindMapKeys.graph(workspaceId, mapId),
      queryFn: () => getMindMapGraph(supabase, { workspaceId, mapId }),
      staleTime: 5 * 60_000,
    });
  }, [graphCache, queryClient, user, workspaceId]);

  const handleSelectMap = useCallback((mapId: string) => {
    const map = maps.find((item) => item.id === mapId);
    if (!map) return;

    setSelectedMapId(map.id);
    setEditableGraph(graphCache[map.id] ?? null);
    setSelectedNodeId(null);
    setIsDirty(Boolean(graphCache[map.id] && dirtyMapIds.has(map.id)));
    setDraftMessage(null);
    setIsInspectorOpen(false);
  }, [dirtyMapIds, graphCache, maps]);

  const handleGraphChange = useCallback((graph: EditableMapGraph) => {
    if (isCreatingMap) return;

    setEditableGraph(graph);
    if (selectedMapId) {
      setGraphCache((cache) => ({ ...cache, [selectedMapId]: graph }));
      setDirtyMapIds((current) => new Set(current).add(selectedMapId));
    }
    setDraftMessage(null);
    setIsDirty(true);
  }, [isCreatingMap, selectedMapId]);

  const handleAddNode = useCallback(() => {
    if (isCreatingMap) return;

    const graph = editableGraph ?? createBlankGraph(selectedMap?.title ?? "Untitled map");
    handleGraphChange({
      ...graph,
      nodes: [
        ...graph.nodes,
        {
          id: crypto.randomUUID(),
          title: "New idea",
          body: "",
          nodeType: "idea",
          status: "open",
          position: { x: 120, y: 120 },
          accent: "cyan",
          tags: [],
        },
      ],
    });
  }, [isCreatingMap, editableGraph, handleGraphChange, selectedMap?.title]);

  const handleNodeChange = useCallback((nextNode: EditableMapNode) => {
    if (!editableGraph) return;

    handleGraphChange({
      ...editableGraph,
      nodes: editableGraph.nodes.map((node) => (node.id === nextNode.id ? nextNode : node)),
    });
  }, [editableGraph, handleGraphChange]);

  const handleViewChange = useCallback((defaultView: EditableMapGraph["defaultView"]) => {
    if (isCreatingMap) return;
    if (!editableGraph) return;
    handleGraphChange({ ...editableGraph, defaultView });
  }, [isCreatingMap, editableGraph, handleGraphChange]);

  const handleSave = useCallback(() => {
    if (isCreatingMap || isSavingMap || isSelectedGraphLoading) return;

    setDraftMessage(null);
    saveMap();
  }, [isCreatingMap, isSavingMap, isSelectedGraphLoading, saveMap]);

  const handleConvert = useCallback((type: ConvertedObjectType) => {
    if (isConvertingNode) return;

    convertNode(type);
  }, [convertNode, isConvertingNode]);

  if (isLoading) {
    return <EmptyState isLoading title="Loading maps" message="Checking your session before opening the visual workspace." />;
  }

  if (!user) {
    return <EmptyState title="Sign in required" message="Sign in to plan with maps." />;
  }

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Visual planning workspace</h1>
      </div>

      <div className="grid gap-4 lg:grid-cols-[288px_minmax(0,1fr)]">
        <MapLibraryPanel
          isCreating={isCreatingMap}
          onCreateBlank={handleCreateBlank}
          onCreateFromTemplate={handleCreateFromTemplate}
        />

        <section className="grid min-w-0 content-start gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Open map"
              className="orbit-input max-w-56 px-2.5 py-1.5 text-xs"
              onChange={(event) => {
                if (event.target.value) handleSelectMap(event.target.value);
              }}
              onFocus={() => maps.forEach((item) => handlePreviewMap(item.id))}
              value={selectedMapId ?? ""}
            >
              <option value="">Open map…</option>
              {maps.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title}
                </option>
              ))}
            </select>
            {editableGraph && !isCreatingMap && !isSelectedGraphLoading ? (
              <MapToolbar
                activeView={editableGraph.defaultView}
                hasSelection={Boolean(selectedNode)}
                isDirty={isDirty}
                isSaving={isSavingMap}
                onAddNode={handleAddNode}
                onOpenDetails={() => setIsInspectorOpen(true)}
                onSave={handleSave}
                onViewChange={handleViewChange}
              />
            ) : null}
          </div>

          {draftMessage ? (
            <p className="rounded-md border border-cyan-400/30 bg-cyan-400/10 px-3 py-2 text-sm text-cyan-100">{draftMessage}</p>
          ) : null}

          {isCreatingMap ? (
            <EmptyState isLoading title="Creating map draft..." message="Preparing the editable map workspace." />
          ) : isSelectedGraphLoading ? (
            <EmptyState isLoading title="Loading map graph" message="Opening the saved nodes and connections." />
          ) : selectedGraphQuery.isError && selectedMapId && !editableGraph ? (
            <EmptyState title="Could not load map graph" message={selectedGraphQuery.error.message} />
          ) : editableGraph ? (
            <MapCanvas
              graph={editableGraph}
              selectedNodeId={selectedNodeId}
              view={editableGraph.defaultView}
              onChange={handleGraphChange}
              onSelectNode={setSelectedNodeId}
            />
          ) : mapsQuery.isPending ? (
            <EmptyState isLoading title="Loading map library" message="Fetching visual plans." />
          ) : mapsQuery.isError ? (
            <EmptyState title="Could not load maps" message={mapsQuery.error.message} />
          ) : (
            <div className="grid gap-4">
              <EmptyState
                title="Choose a visual plan"
                message="Start a blank map or pick a template to open the planning canvas."
              />
              <div aria-label="What maps are for" className="grid gap-3 sm:grid-cols-3">
                {mapsFeatureStrip.map(({ icon: Icon, title, body }) => (
                  <div className="surface-quiet flex items-start gap-3 rounded-xl p-4" key={title}>
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-cyan-300/10 text-cyan-200">
                      <Icon aria-hidden="true" className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white">{title}</p>
                      <p className="mt-0.5 text-sm leading-6 text-slate-400">{body}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {createMapMutation.isError ? (
            <InlineAlert tone="error">
              {createMapMutation.error.message}
            </InlineAlert>
          ) : null}
          {saveMapMutation.isError ? (
            <InlineAlert tone="error">
              {saveMapMutation.error.message}
            </InlineAlert>
          ) : null}
        </section>

      </div>

      {isInspectorOpen && selectedNode ? (
        <div className="surface-raised fixed inset-y-0 right-0 z-40 w-full max-w-sm overflow-y-auto p-4">
          <div className="flex justify-end pb-2">
            <button
              className="orbit-button-secondary px-2 py-1 text-xs"
              onClick={() => setIsInspectorOpen(false)}
              type="button"
            >
              Close details
            </button>
          </div>
          <MapInspector
            node={selectedNode}
            conversionDisabledReason={conversionDisabledReason}
            conversionDisabledReasons={conversionDisabledReasons}
            isConverting={isConvertingNode}
            onConvert={handleConvert}
            onNodeChange={handleNodeChange}
          />
          {convertNodeMutation.isError ? (
            <InlineAlert className="mt-3" tone="error">
              {convertNodeMutation.error.message}
            </InlineAlert>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
