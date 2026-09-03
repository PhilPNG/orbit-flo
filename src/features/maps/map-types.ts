import type { MindMapEdgeType, MindMapNodeStatus, MindMapNodeType, MindMapView } from "../../lib/supabase/database.types";

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

export function mapNodeTypeLabel(type: MindMapNodeType) {
  const labels: Record<MindMapNodeType, string> = {
    idea: "Idea",
    task_candidate: "Task candidate",
    note: "Note",
    milestone: "Milestone",
    decision: "Decision",
    option: "Option",
    risk: "Risk",
    reference: "Reference",
  };
  return labels[type];
}

export function mapNodeStatusLabel(status: MindMapNodeStatus) {
  const labels: Record<MindMapNodeStatus, string> = {
    open: "Open",
    selected: "Selected",
    rejected: "Rejected",
    converted: "Converted",
    archived: "Archived",
  };
  return labels[status];
}

export function mapEdgeTypeLabel(type: MindMapEdgeType) {
  const labels: Record<MindMapEdgeType, string> = {
    association: "Association",
    dependency: "Dependency",
    sequence: "Sequence",
    choice: "Choice",
    outcome: "Outcome",
  };
  return labels[type];
}
