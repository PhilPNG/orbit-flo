import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { mapTemplates } from "./map-templates";
import { TemplateThumbnail } from "./map-template-thumbnail";

describe("TemplateThumbnail", () => {
  it("renders one truthful shape per node and one line per edge", () => {
    const template = mapTemplates[0];
    const nodes = template.nodes;
    const { container } = render(<TemplateThumbnail edges={template.edges} nodes={nodes} />);

    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(container.querySelectorAll("[data-thumbnail-node]")).toHaveLength(nodes.length);
    expect(container.querySelector('[data-thumbnail-shape="diamond"]')).toBeTruthy();
    expect(container.querySelector('[data-thumbnail-shape="triangle"]')).toBeTruthy();
    expect(container.querySelector('[data-thumbnail-shape="planet"]')).toBeTruthy();
    expect(container.querySelector("ellipse")).toBeTruthy();
    expect(container.querySelectorAll("line")).toHaveLength(template.edges.length);
  });

  it("uses the approved SVG primitive for every node shape", () => {
    const nodes = [
      { id: "dot", position: { x: 0, y: 0 }, nodeType: "idea" as const },
      { id: "planet", position: { x: 20, y: 0 }, nodeType: "milestone" as const },
      { id: "diamond", position: { x: 40, y: 0 }, nodeType: "decision" as const },
      { id: "triangle", position: { x: 60, y: 0 }, nodeType: "risk" as const },
      { id: "card", position: { x: 80, y: 0 }, nodeType: "note" as const },
      { id: "ring", position: { x: 100, y: 0 }, nodeType: "option" as const },
    ];
    const { container } = render(<TemplateThumbnail edges={[]} nodes={nodes} />);

    expect(container.querySelectorAll("[data-thumbnail-node]")).toHaveLength(nodes.length);
    expect(container.querySelector('[data-thumbnail-shape="dot"]')?.tagName.toLowerCase()).toBe("circle");
    expect(container.querySelector('[data-thumbnail-shape="planet"]')?.tagName.toLowerCase()).toBe("circle");
    expect(container.querySelector('[data-thumbnail-shape="diamond"]')?.tagName.toLowerCase()).toBe("polygon");
    expect(container.querySelector('[data-thumbnail-shape="triangle"]')?.tagName.toLowerCase()).toBe("polygon");
    expect(container.querySelector('[data-thumbnail-shape="card"]')?.tagName.toLowerCase()).toBe("rect");
    expect(container.querySelector('[data-thumbnail-shape="ring"]')?.tagName.toLowerCase()).toBe("circle");
    expect(container.querySelector("ellipse")).toBeTruthy();
  });

  it("renders a single node without dividing by zero", () => {
    const { container } = render(
      <TemplateThumbnail
        edges={[]}
        nodes={[{ id: "solo", position: { x: 5, y: 5 }, nodeType: "idea" }]}
      />,
    );

    const circle = container.querySelector("circle");
    expect(circle?.getAttribute("cx")).toBe("48");
  });
});
