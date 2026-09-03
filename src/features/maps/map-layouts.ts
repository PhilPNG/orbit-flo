import type { EditableMapGraph, EditableMapNode } from "./map-types";

export const arrangeModes = ["radial", "left_to_right", "top_down", "by_date"] as const;
export type ArrangeMode = (typeof arrangeModes)[number];

export function arrangeModeLabel(mode: ArrangeMode) {
  const labels: Record<ArrangeMode, string> = {
    radial: "Radial",
    left_to_right: "Left to right",
    top_down: "Top down",
    by_date: "By date",
  };
  return labels[mode];
}

const LTR_DEPTH_GAP = 260;
const LTR_SIBLING_GAP = 90;
const TD_DEPTH_GAP = 150;
const TD_SIBLING_GAP = 240;
const RING_GAP = 220;
const RING_ARC_PER_NODE = 230;
const DATE_COLUMN_GAP = 260;
const UNDATED_ROW_Y = 180;
const NODE_BOX = { width: 200, height: 40 };

type Point = { x: number; y: number };
type Forest = { roots: string[]; children: Map<string, string[]> };

function buildForest(graph: EditableMapGraph): Forest {
  const ids = graph.nodes.map((node) => node.id);
  const outgoing = new Map<string, string[]>(ids.map((id) => [id, []]));
  const incoming = new Map<string, number>(ids.map((id) => [id, 0]));
  const degree = new Map<string, number>(ids.map((id) => [id, 0]));

  for (const edge of graph.edges) {
    if (!outgoing.has(edge.sourceNodeId) || !incoming.has(edge.targetNodeId)) continue;
    outgoing.get(edge.sourceNodeId)?.push(edge.targetNodeId);
    incoming.set(edge.targetNodeId, (incoming.get(edge.targetNodeId) ?? 0) + 1);
    degree.set(edge.sourceNodeId, (degree.get(edge.sourceNodeId) ?? 0) + 1);
    degree.set(edge.targetNodeId, (degree.get(edge.targetNodeId) ?? 0) + 1);
  }

  const visited = new Set<string>();
  const children = new Map<string, string[]>();
  const roots: string[] = [];

  function visit(rootId: string) {
    roots.push(rootId);
    visited.add(rootId);
    const queue = [rootId];
    while (queue.length > 0) {
      const id = queue.shift() as string;
      const kids: string[] = [];
      for (const target of outgoing.get(id) ?? []) {
        if (visited.has(target)) continue;
        visited.add(target);
        kids.push(target);
        queue.push(target);
      }
      children.set(id, kids);
    }
  }

  const naturalRoots = ids.filter((id) => incoming.get(id) === 0);
  const seeds =
    naturalRoots.length > 0
      ? naturalRoots
      : [...ids].sort((left, right) => (degree.get(right) ?? 0) - (degree.get(left) ?? 0)).slice(0, 1);
  for (const id of seeds) if (!visited.has(id)) visit(id);
  for (const id of ids) if (!visited.has(id)) visit(id);

  return { roots, children };
}

function leafCount(id: string, children: Map<string, string[]>, memo: Map<string, number>): number {
  const known = memo.get(id);
  if (known !== undefined) return known;
  const kids = children.get(id) ?? [];
  const count = kids.length === 0 ? 1 : kids.reduce((sum, kid) => sum + leafCount(kid, children, memo), 0);
  memo.set(id, count);
  return count;
}

function layeredPositions(forest: Forest): Map<string, { depth: number; lane: number }> {
  const memo = new Map<string, number>();
  const out = new Map<string, { depth: number; lane: number }>();

  function place(id: string, depth: number, laneStart: number) {
    const width = leafCount(id, forest.children, memo);
    out.set(id, { depth, lane: laneStart + (width - 1) / 2 });
    let cursor = laneStart;
    for (const kid of forest.children.get(id) ?? []) {
      place(kid, depth + 1, cursor);
      cursor += leafCount(kid, forest.children, memo);
    }
  }

  let laneOffset = 0;
  for (const root of forest.roots) {
    place(root, 0, laneOffset);
    laneOffset += leafCount(root, forest.children, memo);
  }
  return out;
}

function radialTree(forest: Forest, rootId: string): { positions: Map<string, Point>; radius: number } {
  const memo = new Map<string, number>();
  const positions = new Map<string, Point>();
  const perDepth = new Map<number, number>();

  const countDepths = (id: string, depth: number) => {
    perDepth.set(depth, (perDepth.get(depth) ?? 0) + 1);
    for (const kid of forest.children.get(id) ?? []) countDepths(kid, depth + 1);
  };
  countDepths(rootId, 0);

  const radiusAt = (depth: number) =>
    depth === 0 ? 0 : Math.max(RING_GAP * depth, ((perDepth.get(depth) ?? 1) * RING_ARC_PER_NODE) / (2 * Math.PI));

  const place = (id: string, depth: number, start: number, end: number) => {
    const mid = (start + end) / 2;
    const radius = radiusAt(depth);
    positions.set(id, { x: Math.round(Math.cos(mid) * radius), y: Math.round(Math.sin(mid) * radius) });
    const kids = forest.children.get(id) ?? [];
    const total = kids.reduce((sum, kid) => sum + leafCount(kid, forest.children, memo), 0);
    let cursor = start;
    for (const kid of kids) {
      const span = ((end - start) * leafCount(kid, forest.children, memo)) / total;
      place(kid, depth + 1, cursor, cursor + span);
      cursor += span;
    }
  };
  place(rootId, 0, -Math.PI / 2, (3 * Math.PI) / 2);

  const maxDepth = Math.max(...perDepth.keys());
  return { positions, radius: radiusAt(maxDepth) };
}

function radialPositions(forest: Forest): Map<string, Point> {
  const out = new Map<string, Point>();
  let offsetX = 0;
  forest.roots.forEach((root, index) => {
    const { positions, radius } = radialTree(forest, root);
    if (index > 0) offsetX += radius + RING_GAP;
    positions.forEach((point, id) => out.set(id, { x: point.x + offsetX, y: point.y }));
    offsetX += radius + RING_GAP;
  });
  return out;
}

function byDatePositions(nodes: EditableMapNode[]): Map<string, Point> {
  const out = new Map<string, Point>();
  const dateOf = (node: EditableMapNode) => node.startDate ?? node.dueDate ?? null;
  const dated = nodes.filter((node) => dateOf(node)).sort((a, b) => (dateOf(a) as string).localeCompare(dateOf(b) as string));
  const undated = nodes.filter((node) => !dateOf(node)).sort((a, b) => a.position.x - b.position.x);
  dated.forEach((node, index) => out.set(node.id, { x: index * DATE_COLUMN_GAP, y: 0 }));
  undated.forEach((node, index) => out.set(node.id, { x: index * DATE_COLUMN_GAP, y: UNDATED_ROW_Y }));
  return out;
}

export function arrangeGraph(graph: EditableMapGraph, mode: ArrangeMode): EditableMapGraph {
  if (graph.nodes.length === 0) return graph;

  let positions: Map<string, Point>;
  if (mode === "by_date") {
    positions = byDatePositions(graph.nodes);
  } else if (mode === "radial") {
    positions = radialPositions(buildForest(graph));
  } else {
    const layered = layeredPositions(buildForest(graph));
    positions = new Map();
    layered.forEach(({ depth, lane }, id) => {
      positions.set(
        id,
        mode === "left_to_right"
          ? { x: depth * LTR_DEPTH_GAP, y: lane * LTR_SIBLING_GAP }
          : { x: lane * TD_SIBLING_GAP, y: depth * TD_DEPTH_GAP },
      );
    });
  }

  return {
    ...graph,
    nodes: graph.nodes.map((node) => {
      const position = positions.get(node.id);
      return position ? { ...node, position } : node;
    }),
  };
}

export function placeNewNode(nodes: EditableMapNode[], center: Point): Point {
  const overlaps = (point: Point) =>
    nodes.some(
      (node) => Math.abs(node.position.x - point.x) < NODE_BOX.width && Math.abs(node.position.y - point.y) < NODE_BOX.height,
    );

  let candidate = { x: Math.round(center.x), y: Math.round(center.y) };
  let step = 0;
  while (overlaps(candidate) && step < 200) {
    step += 1;
    const angle = step * 0.9;
    const radius = 40 * Math.sqrt(step);
    candidate = {
      x: Math.round(center.x + Math.cos(angle) * radius * 2.5),
      y: Math.round(center.y + Math.sin(angle) * radius),
    };
  }
  return candidate;
}

