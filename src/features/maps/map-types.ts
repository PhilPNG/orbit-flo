import type { MindMapEdgeType, MindMapNodeStatus, MindMapNodeType, MindMapView } from "../../lib/supabase/database.types";

export const mapViews = ["mind_map", "flowchart", "timeline", "decision_tree"] as const satisfies MindMapView[];
export const mapNodeTypes = ["idea", "task_candidate", "note", "milestone", "decision", "option", "risk", "reference"] as const satisfies MindMapNodeType[];
export const mapNodeStatuses = ["open", "selected", "rejected", "converted", "archived"] as const satisfies MindMapNodeStatus[];
export const mapEdgeTypes = ["association", "dependency", "sequence", "choice", "outcome"] as const satisfies MindMapEdgeType[];

export type MapScope = "all" | "global" | "project";
export type LinkedObjectType = "task" | "note" | "project" | "milestone" | "meeting" | "calendar_item";
export type ConvertedObjectType = "task" | "note" | "milestone";

export type EditableMapNode = {
  id: string;
  projectId?: string | null;
  title: string;
  body: string;
  nodeType: MindMapNodeType;
  status: MindMapNodeStatus;
  position: { x: number; y: number };
  width?: number | null;
  height?: number | null;
  accent: string;
  startDate?: string | null;
  dueDate?: string | null;
  tags: string[];
  linkedType?: LinkedObjectType | null;
  linkedId?: string | null;
  convertedType?: ConvertedObjectType | null;
  convertedId?: string | null;
  convertedAt?: string | null;
};

export type EditableMapEdge = {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  edgeType: MindMapEdgeType;
  label: string;
  isDirectional: boolean;
};

export type EditableMapGraph = {
  title: string;
  description: string;
  defaultView: MindMapView;
  nodes: EditableMapNode[];
  edges: EditableMapEdge[];
};

export function mapViewLabel(view: MindMapView) {
  const labels: Record<MindMapView, string> = {
    mind_map: "Mind Map",
    flowchart: "Flowchart",
    timeline: "Timeline",
    decision_tree: "Decision Tree",
  };
  return labels[view];
}
