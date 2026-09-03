import { describe, expect, it } from "vitest";
import {
  createConnectedNode,
  createNodeAt,
  createSiblingNode,
  deleteEdge,
  deleteNode,
  nodeAccentColor,
  nodeShape,
  updateEdge,
  updateNode,
  withFreshIds,
} from "./map-graph-ops";
import type { EditableMapGraph } from "./map-types";

function twoNodeGraph(): EditableMapGraph {
  return {
    title: "Plan",
    description: "",
    defaultView: "mind_map",
    nodes: [
      { id: "a", title: "A", body: "", nodeType: "idea", status: "open", position: { x: 0, y: 0 }, accent: "cyan", tags: [] },
      { id: "b", title: "B", body: "", nodeType: "idea", status: "open", position: { x: 1, y: 1 }, accent: "cyan", tags: [] },
    ],
    edges: [{ id: "a-b", sourceNodeId: "a", targetNodeId: "b", edgeType: "association", label: "", isDirectional: false }],
  };
}

function graph(): EditableMapGraph {
  return {
    title: "Ideas",
    description: "",
    defaultView: "mind_map",
    nodes: [
      { id: "root", title: "Root", body: "", nodeType: "idea", status: "open", position: { x: 0, y: 0 }, accent: "cyan", tags: [] },
      { id: "child-a", title: "Child A", body: "", nodeType: "idea", status: "open", position: { x: 180, y: 40 }, accent: "cyan", tags: [] },
    ],
    edges: [
      { id: "e-root-a", sourceNodeId: "root", targetNodeId: "child-a", edgeType: "association", label: "", isDirectional: false },
    ],
  };
}

describe("nodeAccentColor", () => {
  it("maps node types onto the three accents", () => {
    expect(nodeAccentColor("idea")).toBe("cyan");
    expect(nodeAccentColor("task_candidate")).toBe("cyan");
    expect(nodeAccentColor("note")).toBe("blue");
    expect(nodeAccentColor("reference")).toBe("blue");
    expect(nodeAccentColor("option")).toBe("blue");
    expect(nodeAccentColor("milestone")).toBe("violet");
    expect(nodeAccentColor("decision")).toBe("violet");
    expect(nodeAccentColor("risk")).toBe("violet");
  });
});

describe("nodeShape", () => {
  it("maps node types onto distinct glyph shapes", () => {
    expect(nodeShape("idea")).toBe("dot");
    expect(nodeShape("task_candidate")).toBe("dot");
    expect(nodeShape("milestone")).toBe("planet");
    expect(nodeShape("decision")).toBe("diamond");
    expect(nodeShape("risk")).toBe("triangle");
    expect(nodeShape("note")).toBe("card");
    expect(nodeShape("reference")).toBe("card");
    expect(nodeShape("option")).toBe("ring");
  });
});

describe("createNodeAt", () => {
  it("appends a blank idea node at the position", () => {
    const next = createNodeAt(graph(), { x: 300, y: 200 }, "new-id");
    const added = next.nodes.at(-1);

    expect(next.nodes).toHaveLength(3);
    expect(added).toMatchObject({
      id: "new-id",
      title: "New idea",
      nodeType: "idea",
      status: "open",
      position: { x: 300, y: 200 },
    });
    expect(next.edges).toHaveLength(1);
  });
});

describe("createConnectedNode", () => {
  it("adds a child offset from the source with an association edge", () => {
    const next = createConnectedNode(graph(), "child-a", "new-id", "new-edge");

    expect(next.nodes.at(-1)).toMatchObject({ id: "new-id", position: { x: 360, y: 80 } });
    expect(next.edges.at(-1)).toEqual({
      id: "new-edge",
      sourceNodeId: "child-a",
      targetNodeId: "new-id",
      edgeType: "association",
      label: "",
      isDirectional: false,
    });
  });

  it("returns the graph unchanged when the source is missing", () => {
    const start = graph();
    expect(createConnectedNode(start, "ghost", "new-id", "new-edge")).toBe(start);
  });

  it("keeps consecutive children from stacking on top of each other", () => {
    const first = createConnectedNode(graph(), "root", "child-1", "edge-1");
    const second = createConnectedNode(first, "root", "child-2", "edge-2");

    const one = first.nodes.at(-1)?.position as { x: number; y: number };
    const two = second.nodes.at(-1)?.position as { x: number; y: number };

    expect(Math.abs(one.x - two.x) >= 200 || Math.abs(one.y - two.y) >= 40).toBe(true);
  });
});

describe("createSiblingNode", () => {
  it("connects the new node from the selected node's parent", () => {
    const next = createSiblingNode(graph(), "child-a", "new-id", "new-edge");

    expect(next.edges.at(-1)).toMatchObject({ sourceNodeId: "root", targetNodeId: "new-id" });
    expect(next.nodes.at(-1)).toMatchObject({ position: { x: 180, y: 160 } });
  });

  it("falls back to a child when the selected node has no parent", () => {
    const next = createSiblingNode(graph(), "root", "new-id", "new-edge");

    expect(next.edges.at(-1)).toMatchObject({ sourceNodeId: "root", targetNodeId: "new-id" });
  });

  it("keeps consecutive siblings from stacking on top of each other", () => {
    const first = createSiblingNode(graph(), "child-a", "sibling-1", "edge-1");
    const second = createSiblingNode(first, "child-a", "sibling-2", "edge-2");

    const one = first.nodes.at(-1)?.position as { x: number; y: number };
    const two = second.nodes.at(-1)?.position as { x: number; y: number };

    expect(Math.abs(one.x - two.x) >= 200 || Math.abs(one.y - two.y) >= 40).toBe(true);
  });
});

describe("withFreshIds", () => {
  it("gives every node and edge a new id and rewires edges", () => {
    const graph = twoNodeGraph();

    const fresh = withFreshIds(graph);

    expect(fresh.nodes.map((node) => node.id)).not.toContain("a");
    expect(fresh.edges[0].id).not.toBe("a-b");
    expect(fresh.edges[0].sourceNodeId).toBe(fresh.nodes[0].id);
    expect(fresh.edges[0].targetNodeId).toBe(fresh.nodes[1].id);
    expect(graph.nodes[0].id).toBe("a");
  });
});

describe("node and edge edits", () => {
  it("updates a node without touching the others", () => {
    const next = updateNode(twoNodeGraph(), "a", { title: "Renamed", nodeType: "risk" });
    expect(next.nodes[0]).toMatchObject({ id: "a", title: "Renamed", nodeType: "risk" });
    expect(next.nodes[1].title).toBe("B");
  });

  it("deletes a node and every edge touching it", () => {
    const next = deleteNode(twoNodeGraph(), "a");
    expect(next.nodes.map((node) => node.id)).toEqual(["b"]);
    expect(next.edges).toEqual([]);
  });

  it("updates an edge", () => {
    const next = updateEdge(twoNodeGraph(), "a-b", { edgeType: "dependency", label: "needs", isDirectional: true });
    expect(next.edges[0]).toMatchObject({ id: "a-b", edgeType: "dependency", label: "needs", isDirectional: true });
  });

  it("deletes an edge and keeps the nodes", () => {
    const next = deleteEdge(twoNodeGraph(), "a-b");
    expect(next.edges).toEqual([]);
    expect(next.nodes).toHaveLength(2);
  });
});
