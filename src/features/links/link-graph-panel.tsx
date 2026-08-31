import { useQuery } from "@tanstack/react-query";
import { Background, ReactFlow, type Edge, type Node } from "@xyflow/react";
import { useMemo } from "react";
import { EmptyState } from "../../components/empty-state";
import { supabase } from "../../lib/supabase/client";
import { useWorkspaceId } from "../workspaces/workspace-context";
import { buildLinkGraph, type GraphNode } from "./link-graph";
import { linkGraphQueryKey, loadLinkGraph } from "./link-graph.queries";

const kindClass: Record<GraphNode["kind"], string> = {
  note: "border-cyan-300/40 bg-cyan-300/10 text-cyan-50",
  task: "border-blue-400/40 bg-blue-400/10 text-blue-50",
  project: "border-violet-400/40 bg-violet-400/10 text-violet-50",
  milestone: "border-emerald-400/40 bg-emerald-400/10 text-emerald-50",
};

/**
 * The link network, drawn from note_links. Distinct from the mind maps on the
 * Maps page: those are drawn by hand, this is derived and read-only.
 */
export function LinkGraphPanel() {
  const workspaceId = useWorkspaceId();

  const graphQuery = useQuery({
    queryKey: linkGraphQueryKey(workspaceId),
    queryFn: () => loadLinkGraph(supabase, workspaceId),
  });

  const graph = useMemo(() => {
    if (!graphQuery.data) return { nodes: [], edges: [] };
    return buildLinkGraph(graphQuery.data.links, graphQuery.data.titles);
  }, [graphQuery.data]);

  const nodes: Node[] = useMemo(
    () =>
      graph.nodes.map((node) => ({
        id: node.id,
        position: node.position,
        data: { label: node.label },
        draggable: false,
        connectable: false,
        selectable: false,
        // A plain node with our own styling rather than React Flow's default.
        type: "default",
        className: `rounded-lg border px-3 py-2 text-xs font-semibold ${kindClass[node.kind]}`,
        style: { width: 200 },
      })),
    [graph.nodes],
  );

  const edges: Edge[] = useMemo(
    () =>
      graph.edges.map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        animated: false,
        style: { stroke: "rgb(148 163 184 / 0.45)" },
      })),
    [graph.edges],
  );

  if (graphQuery.isPending) {
    return <EmptyState isLoading title="Drawing the graph" message="Reading how your notes connect." />;
  }

  if (graphQuery.isError) {
    return <EmptyState title="Could not load the graph" message={graphQuery.error.message} />;
  }

  // An empty canvas says nothing; explain what would fill it.
  if (graph.nodes.length === 0) {
    return (
      <EmptyState
        title="Nothing linked yet"
        message="Type [[ in a note to link a task, note, project or milestone. Those links draw this graph."
      />
    );
  }

  return (
    <div aria-label="Link graph" className="surface-quiet h-[28rem] overflow-hidden rounded-xl">
      <ReactFlow
        edges={edges}
        fitView
        nodes={nodes}
        nodesConnectable={false}
        nodesDraggable={false}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="rgb(148 163 184 / 0.15)" gap={24} />
      </ReactFlow>
    </div>
  );
}
