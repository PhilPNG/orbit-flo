import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Rocket, Share2, Telescope } from "lucide-react";
import { useState } from "react";
import { EmptyState } from "../../components/empty-state";
import { InlineAlert } from "../../components/inline-alert";
import { supabase } from "../../lib/supabase/client";
import { useAuth } from "../auth/use-auth";
import { useWorkspaceId } from "../workspaces/workspace-context";
import { MapCard } from "./map-card";
import { withFreshIds } from "./map-graph-ops";
import { createMapFromTemplate } from "./map-templates";
import type { EditableMapGraph } from "./map-types";
import {
  archiveMindMap,
  createMindMap,
  duplicateMindMap,
  listMindMapPreviews,
  listMindMaps,
  mindMapKeys,
  replaceMindMapGraph,
  updateMindMap,
  type MindMap,
} from "./maps.queries";
import { NewMapDialog, type NewMapInput } from "./new-map-dialog";

const mapsFeatureStrip = [
  { icon: Telescope, title: "See the big picture", body: "Zoom out and watch themes emerge." },
  { icon: Share2, title: "Connect what matters", body: "Link ideas into constellations." },
  { icon: Rocket, title: "Move ideas forward", body: "Turn a node into real mission work." },
];

type MapLibraryPageProps = {
  projectId?: string | null;
  onOpenMap: (mapId: string) => void;
};

function blankGraph(title: string): EditableMapGraph {
  return { title, description: "", defaultView: "mind_map", nodes: [], edges: [] };
}

export function MapLibraryPage({ projectId = null, onOpenMap }: MapLibraryPageProps) {
  const { isLoading, user } = useAuth();
  // Computed unconditionally (rather than after a `!user` early return) so
  // hook order never changes across renders; mutations below are gated by
  // `enabled: Boolean(user)` / never fire while user is null anyway.
  const userId = user?.id ?? "";
  const workspaceId = useWorkspaceId();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [renamingMapId, setRenamingMapId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const listKey = mindMapKeys.list(workspaceId, projectId);
  const previewsKey = mindMapKeys.previews(workspaceId, projectId);

  const mapsQuery = useQuery({
    queryKey: listKey,
    queryFn: () => listMindMaps(supabase, { workspaceId, projectId }),
    enabled: Boolean(user),
    staleTime: 60_000,
  });
  const maps = mapsQuery.data ?? [];
  const mapIds = maps.map((item) => item.id);

  const previewsQuery = useQuery({
    queryKey: previewsKey,
    queryFn: () => listMindMapPreviews(supabase, { workspaceId, mapIds }),
    enabled: Boolean(user) && mapIds.length > 0,
    staleTime: 60_000,
  });

  function invalidateLibrary() {
    void queryClient.invalidateQueries({ queryKey: listKey });
    void queryClient.invalidateQueries({ queryKey: previewsKey });
  }

  const createMutation = useMutation({
    mutationFn: async ({ templateId, title }: NewMapInput) => {
      const graph = templateId ? withFreshIds({ ...createMapFromTemplate(templateId, { projectId }), title }) : blankGraph(title);
      const map = await createMindMap(supabase, {
        workspaceId,
        projectId,
        userId,
        title,
        description: graph.description,
        defaultView: "mind_map",
      });
      if (graph.nodes.length > 0) {
        try {
          await replaceMindMapGraph(supabase, { workspaceId, mapId: map.id, graph });
        } catch (cause) {
          await archiveMindMap(supabase, { id: map.id, workspaceId }).catch(() => undefined);
          throw cause;
        }
      }
      return map;
    },
    onSuccess: (map) => {
      invalidateLibrary();
      setIsDialogOpen(false);
      onOpenMap(map.id);
    },
  });

  const renameMutation = useMutation({
    mutationFn: (input: { id: string; title: string }) => updateMindMap(supabase, { id: input.id, workspaceId, title: input.title }),
    onSuccess: () => {
      setActionError(null);
      invalidateLibrary();
    },
    onError: (error) => setActionError(error.message),
    onSettled: () => setRenamingMapId(null),
  });

  const duplicateMutation = useMutation({
    mutationFn: (map: MindMap) =>
      duplicateMindMap(supabase, { workspaceId, projectId, userId, sourceMapId: map.id, title: `${map.title} copy` }),
    onSuccess: (map) => {
      setActionError(null);
      invalidateLibrary();
      onOpenMap(map.id);
    },
    onError: (error) => setActionError(error.message),
  });

  const archiveMutation = useMutation({
    mutationFn: (id: string) => archiveMindMap(supabase, { id, workspaceId }),
    onSuccess: (_map, id) => {
      setActionError(null);
      // Optimistic removal keeps the card gone immediately; the list is
      // still invalidated below so a refetch re-reads server state (which
      // filters archived_at) rather than relying on the client-side filter
      // forever — the mocked test double filters archived_at itself so this
      // stays consistent with the optimistic update.
      queryClient.setQueryData<MindMap[]>(listKey, (current) => current?.filter((item) => item.id !== id));
      invalidateLibrary();
    },
    onError: (error) => setActionError(error.message),
  });

  if (isLoading) {
    return <EmptyState isLoading title="Loading maps" message="Checking your session before opening the visual workspace." />;
  }
  if (!user) {
    return <EmptyState title="Sign in required" message="Sign in to plan with maps." />;
  }

  const newMapButton = (
    <button
      className="orbit-button gap-1.5"
      onClick={() => {
        setActionError(null);
        setIsDialogOpen(true);
      }}
      type="button"
    >
      <Plus aria-hidden="true" className="h-4 w-4" />
      New map
    </button>
  );

  return (
    <div className="orbit-page-enter grid gap-5">
      <div className="flex items-center justify-between gap-3">
        {projectId ? (
          <p className="text-sm text-slate-400">Maps attached to this mission.</p>
        ) : (
          <h1 className="text-2xl font-bold text-white">Maps</h1>
        )}
        {newMapButton}
      </div>

      {actionError ? <InlineAlert tone="error">{actionError}</InlineAlert> : null}

      {mapsQuery.isPending ? (
        <EmptyState isLoading title="Loading map library" message="Fetching visual plans." />
      ) : mapsQuery.isError ? (
        <EmptyState
          action={
            <button className="orbit-button-secondary" onClick={() => void mapsQuery.refetch()} type="button">
              Retry
            </button>
          }
          message={mapsQuery.error.message}
          title="Could not load maps"
        />
      ) : maps.length === 0 ? (
        <div className="grid gap-4">
          <EmptyState
            action={newMapButton}
            illustration="maps"
            message="Start a blank map or pick a template to open the planning canvas."
            title="No maps yet"
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
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {maps.map((item) => (
            <MapCard
              isRenaming={renamingMapId === item.id}
              key={item.id}
              map={item}
              onArchive={() => archiveMutation.mutate(item.id)}
              onCancelRename={() => setRenamingMapId(null)}
              onDuplicate={() => duplicateMutation.mutate(item)}
              onOpen={() => onOpenMap(item.id)}
              onRename={(title) => renameMutation.mutate({ id: item.id, title })}
              onStartRename={() => setRenamingMapId(item.id)}
              preview={previewsQuery.data?.[item.id]}
            />
          ))}
        </div>
      )}

      {isDialogOpen ? (
        <NewMapDialog
          error={createMutation.error?.message ?? null}
          isCreating={createMutation.isPending}
          onClose={() => {
            setIsDialogOpen(false);
            createMutation.reset();
          }}
          onCreate={(input) => createMutation.mutate(input)}
        />
      ) : null}
    </div>
  );
}
