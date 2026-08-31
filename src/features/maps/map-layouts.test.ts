import { describe, expect, it } from "vitest";
import type { EditableMapNode } from "./map-types";
import { applyViewLayout } from "./map-layouts";

const nodes: EditableMapNode[] = [
  { id: "node-1", title: "Root", body: "", nodeType: "idea", status: "open", position: { x: 0, y: 0 }, accent: "cyan", tags: [] },
  { id: "node-2", title: "Task", body: "", nodeType: "task_candidate", status: "open", position: { x: 0, y: 0 }, accent: "blue", tags: [], dueDate: "2026-07-10" },
];

describe("applyViewLayout", () => {
  it("places timeline nodes with dates before unscheduled nodes", () => {
    const layout = applyViewLayout("timeline", nodes);

    expect(layout[0].id).toBe("node-2");
    expect(layout[1].id).toBe("node-1");
    expect(layout[0].position.x).toBeLessThan(layout[1].position.x);
  });

  it("places decision tree options in branched columns after the root", () => {
    const decisionNodes: EditableMapNode[] = [
      { id: "decision", title: "Decision", body: "", nodeType: "decision", status: "open", position: { x: 0, y: 0 }, accent: "violet", tags: [] },
      { id: "option-a", title: "Option A", body: "", nodeType: "option", status: "open", position: { x: 0, y: 0 }, accent: "cyan", tags: [] },
      { id: "option-b", title: "Option B", body: "", nodeType: "option", status: "open", position: { x: 0, y: 0 }, accent: "cyan", tags: [] },
      { id: "outcome", title: "Outcome", body: "", nodeType: "milestone", status: "open", position: { x: 0, y: 0 }, accent: "cyan", tags: [] },
    ];

    const layout = applyViewLayout("decision_tree", decisionNodes);
    const decision = layout.find((node) => node.id === "decision")!;
    const optionA = layout.find((node) => node.id === "option-a")!;
    const optionB = layout.find((node) => node.id === "option-b")!;

    expect(decision.position).toEqual({ x: 0, y: 0 });
    expect(optionA.position.x).toBeGreaterThan(decision.position.x);
    expect(optionB.position.x).toBeGreaterThan(decision.position.x);
    expect(optionA.position.y).not.toBe(optionB.position.y);
  });
});
