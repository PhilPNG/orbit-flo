import { describe, expect, it } from "vitest";
import { createMapFromTemplate, mapTemplates } from "./map-templates";

describe("map templates", () => {
  it("includes every expected template", () => {
    expect(mapTemplates.map((item) => item.id)).toEqual([
      "feature-plan",
      "bug-investigation",
      "launch-flow",
      "product-roadmap",
      "decision-tree",
      "meeting-brainstorm",
    ]);
  });

  it("creates editable nodes and edges from the feature plan template", () => {
    const template = mapTemplates.find((item) => item.id === "feature-plan");
    expect(template).toBeTruthy();

    const graph = createMapFromTemplate("feature-plan", { projectId: "project-1" });

    expect(graph.title).toBe("Feature plan");
    expect(graph.defaultView).toBe("mind_map");
    expect(graph.nodes.length).toBeGreaterThan(3);
    expect(graph.edges.length).toBeGreaterThan(2);
    expect(graph.nodes[0]).toEqual(expect.objectContaining({ projectId: "project-1" }));
  });

  it("returns fresh mutable graph objects without leaking edits into later maps", () => {
    const firstGraph = createMapFromTemplate("feature-plan");
    firstGraph.nodes[0].position.x = 999;
    firstGraph.nodes[0].tags.push("edited");
    firstGraph.edges[0].label = "edited edge";

    const secondGraph = createMapFromTemplate("feature-plan");

    expect(secondGraph.nodes[0].position).toEqual({ x: 0, y: 0 });
    expect(secondGraph.nodes[0].tags).toEqual([]);
    expect(secondGraph.edges[0].label).toBe("");
  });

  it("prevents exported template mutations from affecting generated maps", () => {
    const template = mapTemplates.find((item) => item.id === "feature-plan");
    expect(template).toBeTruthy();

    try {
      (template!.nodes[0].position as { x: number }).x = 999;
      (template!.nodes[0].tags as string[]).push("edited");
      template!.edges[0].label = "edited edge";
    } catch {
      // Frozen ES module exports throw in strict mode; either way the generated map must stay unchanged.
    }

    const graph = createMapFromTemplate("feature-plan");

    expect(graph.nodes[0].position).toEqual({ x: 0, y: 0 });
    expect(graph.nodes[0].tags).toEqual([]);
    expect(graph.edges[0].label).toBe("");
  });
});
