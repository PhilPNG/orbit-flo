import type { MindMapView } from "../../lib/supabase/database.types";
import type { EditableMapNode } from "./map-types";

export function applyViewLayout(view: MindMapView, nodes: EditableMapNode[]) {
  if (view === "timeline") {
    return [...nodes]
      .sort((left, right) => {
        const leftDate = left.startDate ?? left.dueDate ?? "9999-12-31";
        const rightDate = right.startDate ?? right.dueDate ?? "9999-12-31";
        return leftDate.localeCompare(rightDate);
      })
      .map((node, index) => ({ ...node, position: { x: index * 260, y: node.startDate || node.dueDate ? 0 : 180 } }));
  }

  if (view === "flowchart") {
    return nodes.map((node, index) => ({ ...node, position: { x: index * 260, y: 0 } }));
  }

  if (view === "decision_tree") {
    return nodes.map((node, index) => {
      if (index === 0) return { ...node, position: { x: 0, y: 0 } };
      const branchIndex = index - 1;
      return { ...node, position: { x: (Math.floor(branchIndex / 2) + 1) * 280, y: branchIndex % 2 === 0 ? -90 : 90 } };
    });
  }

  return nodes.map((node, index) => {
    if (index === 0) return { ...node, position: { x: 0, y: 0 } };
    const angle = (index / Math.max(nodes.length - 1, 1)) * Math.PI * 2;
    return { ...node, position: { x: Math.round(Math.cos(angle) * 260), y: Math.round(Math.sin(angle) * 180) } };
  });
}
