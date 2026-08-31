import type { LinkKind } from "./orbit-link";

export type GraphLink = { noteId: string; targetKind: LinkKind; targetId: string };

export type GraphNode = {
  id: string;
  kind: LinkKind;
  entityId: string;
  label: string;
  degree: number;
  position: { x: number; y: number };
};

export type GraphEdge = { id: string; source: string; target: string };

export type LinkGraph = { nodes: GraphNode[]; edges: GraphEdge[] };

export type GraphTitles = Record<LinkKind, Map<string, string>>;

/** Columns rather than a physics simulation: deterministic, and no dependency. */
const columnOrder: LinkKind[] = ["project", "milestone", "note", "task"];
const COLUMN_WIDTH = 280;
const ROW_HEIGHT = 84;

function nodeId(kind: LinkKind, id: string) {
  return `${kind}:${id}`;
}

/**
 * Builds the graph from links alone, so anything with no connections is simply
 * absent — a canvas of isolated dots would say nothing.
 *
 * The layout is deterministic for a given input: the same links always produce
 * the same positions, so the view does not rearrange itself on every refetch.
 */
export function buildLinkGraph(links: GraphLink[], titles: GraphTitles): LinkGraph {
  const degrees = new Map<string, number>();
  const kinds = new Map<string, { kind: LinkKind; entityId: string }>();
  const edges = new Map<string, GraphEdge>();

  function touch(kind: LinkKind, entityId: string) {
    const id = nodeId(kind, entityId);
    kinds.set(id, { kind, entityId });
    degrees.set(id, (degrees.get(id) ?? 0) + 1);
    return id;
  }

  for (const link of links) {
    const source = nodeId("note", link.noteId);
    const target = nodeId(link.targetKind, link.targetId);
    const edgeId = `${source}->${target}`;

    // The same pair twice is one edge, and must not double the degree either.
    if (edges.has(edgeId)) continue;

    edges.set(edgeId, { id: edgeId, source, target });
    touch("note", link.noteId);
    touch(link.targetKind, link.targetId);
  }

  const byColumn = new Map<LinkKind, string[]>(columnOrder.map((kind) => [kind, []]));

  for (const [id, { kind }] of kinds) {
    byColumn.get(kind)?.push(id);
  }

  const nodes: GraphNode[] = [];

  columnOrder.forEach((kind, columnIndex) => {
    const column = (byColumn.get(kind) ?? []).sort((a, b) => {
      // Busiest first, then by id so ties never reorder between renders.
      const byDegree = (degrees.get(b) ?? 0) - (degrees.get(a) ?? 0);
      return byDegree || a.localeCompare(b);
    });

    column.forEach((id, rowIndex) => {
      const entry = kinds.get(id);
      if (!entry) return;

      nodes.push({
        id,
        kind: entry.kind,
        entityId: entry.entityId,
        label: titles[entry.kind].get(entry.entityId) ?? "Untitled",
        degree: degrees.get(id) ?? 0,
        position: { x: columnIndex * COLUMN_WIDTH, y: rowIndex * ROW_HEIGHT },
      });
    });
  });

  return { nodes, edges: [...edges.values()] };
}
