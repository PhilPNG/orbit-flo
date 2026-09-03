import { describe, expect, it } from "vitest";
import { arrangeGraph, arrangeModes, placeNewNode } from "./map-layouts";
import { mapTemplates } from "./map-templates";
import type { EditableMapEdge, EditableMapGraph, EditableMapNode } from "./map-types";

function node(id: string, extra: Partial<EditableMapNode> = {}): EditableMapNode {
  return { id, title: id, body: "", nodeType: "idea", status: "open", position: { x: 0, y: 0 }, accent: "cyan", tags: [], ...extra };
}

function edge(source: string, target: string) {
  return { id: `${source}-${target}`, sourceNodeId: source, targetNodeId: target, edgeType: "association" as const, label: "", isDirectional: false };
}

function graphOf(nodes: EditableMapNode[], edges: EditableMapEdge[]): EditableMapGraph {
  return { title: "t", description: "", defaultView: "mind_map", nodes, edges };
}

function positionOf(graph: EditableMapGraph, id: string) {
  return graph.nodes.find((item) => item.id === id)!.position;
}

function boxesOverlap(a: { x: number; y: number }, b: { x: number; y: number }, width = 200, height = 40) {
  return Math.abs(a.x - b.x) < width && Math.abs(a.y - b.y) < height;
}

const tree = graphOf([node("root"), node("a"), node("b"), node("a1"), node("a2")], [
  edge("root", "a"),
  edge("root", "b"),
  edge("a", "a1"),
  edge("a", "a2"),
]);

describe("arrangeGraph", () => {
  it("is deterministic", () => {
    expect(arrangeGraph(tree, "left_to_right")).toEqual(arrangeGraph(tree, "left_to_right"));
  });

  it("returns the same graph when there are no nodes", () => {
    const empty = graphOf([], []);
    expect(arrangeGraph(empty, "radial")).toBe(empty);
  });

  it("lays a tree out left to right by depth with subtrees stacked", () => {
    const next = arrangeGraph(tree, "left_to_right");
    expect(positionOf(next, "root").x).toBe(0);
    expect(positionOf(next, "a").x).toBe(260);
    expect(positionOf(next, "a1").x).toBe(520);
    expect(positionOf(next, "a1").y).toBe(0);
    expect(positionOf(next, "a2").y).toBe(90);
    expect(positionOf(next, "a").y).toBe(45);
    expect(positionOf(next, "b").y).toBe(180);
  });

  it("lays a tree out top down", () => {
    const next = arrangeGraph(tree, "top_down");
    expect(positionOf(next, "root").y).toBe(0);
    expect(positionOf(next, "a").y).toBe(150);
    expect(positionOf(next, "a1").x).toBe(0);
    expect(positionOf(next, "a2").x).toBe(240);
    expect(positionOf(next, "b").x).toBe(480);
  });

  it("puts the root at the centre in radial and children on the first ring", () => {
    const next = arrangeGraph(tree, "radial");
    expect(positionOf(next, "root")).toEqual({ x: 0, y: 0 });
    const distance = (id: string) => Math.hypot(positionOf(next, id).x, positionOf(next, id).y);
    expect(distance("a")).toBeCloseTo(220, 0);
    expect(distance("b")).toBeCloseTo(220, 0);
    expect(distance("a1")).toBeCloseTo(440, 0);
  });

  it("handles cycles and disconnected nodes without looping", () => {
    const cyclic = graphOf([node("x"), node("y"), node("lonely")], [edge("x", "y"), edge("y", "x")]);
    for (const mode of arrangeModes) {
      const next = arrangeGraph(cyclic, mode);
      const positions = next.nodes.map((item) => `${item.position.x},${item.position.y}`);
      expect(new Set(positions).size).toBe(3);
    }
  });

  it("sorts dated nodes on the top row and keeps undated nodes below", () => {
    const dated = graphOf(
      [
        node("later", { dueDate: "2026-10-01", position: { x: 900, y: 0 } }),
        node("sooner", { startDate: "2026-09-01" }),
        node("undated-b", { position: { x: 50, y: 0 } }),
        node("undated-a", { position: { x: 10, y: 0 } }),
      ],
      [],
    );
    const next = arrangeGraph(dated, "by_date");
    expect(positionOf(next, "sooner")).toEqual({ x: 0, y: 0 });
    expect(positionOf(next, "later")).toEqual({ x: 260, y: 0 });
    expect(positionOf(next, "undated-a")).toEqual({ x: 0, y: 180 });
    expect(positionOf(next, "undated-b")).toEqual({ x: 260, y: 180 });
  });

  it.each(mapTemplates.map((template) => [template.id, template]))("does not overlap nodes for template %s", (_id, template) => {
    const graph = graphOf(template.nodes.map((item) => ({ ...item })), template.edges);
    for (const mode of ["left_to_right", "top_down", "by_date"] as const) {
      const next = arrangeGraph(graph, mode);
      next.nodes.forEach((a, i) =>
        next.nodes.slice(i + 1).forEach((b) => {
          expect(boxesOverlap(a.position, b.position)).toBe(false);
        }),
      );
    }
    const radial = arrangeGraph(graph, "radial");
    radial.nodes.forEach((a, i) =>
      radial.nodes.slice(i + 1).forEach((b) => {
        expect(Math.hypot(a.position.x - b.position.x, a.position.y - b.position.y)).toBeGreaterThanOrEqual(120);
      }),
    );
  });
});

describe("placeNewNode", () => {
  it("returns the centre when nothing is there", () => {
    expect(placeNewNode([], { x: 100.4, y: 50.6 })).toEqual({ x: 100, y: 51 });
  });

  it("moves off an occupied box", () => {
    const occupied = [node("a", { position: { x: 100, y: 50 } })];
    const placed = placeNewNode(occupied, { x: 100, y: 50 });
    expect(boxesOverlap(placed, { x: 100, y: 50 })).toBe(false);
  });
});
