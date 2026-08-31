import type { MindMapView } from "../../lib/supabase/database.types";
import type { EditableMapEdge, EditableMapGraph, EditableMapNode } from "./map-types";

type TemplateContext = { projectId?: string | null };
type MapTemplate = {
  id: string;
  title: string;
  description: string;
  defaultView: MindMapView;
  nodes: Array<Omit<EditableMapNode, "projectId">>;
  edges: EditableMapEdge[];
};

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object") {
    Object.freeze(value);
    Object.values(value).forEach((item) => deepFreeze(item));
  }
  return value;
}

function node(id: string, title: string, x: number, y: number, nodeType: EditableMapNode["nodeType"]): Omit<EditableMapNode, "projectId"> {
  return {
    id,
    title,
    body: "",
    nodeType,
    status: "open",
    position: { x, y },
    accent: nodeType === "risk" ? "rose" : nodeType === "decision" ? "violet" : "cyan",
    tags: [],
  };
}

function edge(id: string, sourceNodeId: string, targetNodeId: string, edgeType: EditableMapEdge["edgeType"] = "association"): EditableMapEdge {
  return { id, sourceNodeId, targetNodeId, edgeType, label: "", isDirectional: edgeType !== "association" };
}

const templateCatalog: MapTemplate[] = [
  {
    id: "feature-plan",
    title: "Feature plan",
    description: "Shape a feature from idea through launch readiness.",
    defaultView: "mind_map",
    nodes: [
      node("feature", "Feature", 0, 0, "idea"),
      node("requirements", "Requirements", 300, -160, "note"),
      node("users", "Target users", 340, 0, "reference"),
      node("scope", "Scope cuts", 300, 160, "decision"),
      node("tasks", "Task breakdown", -300, 160, "task_candidate"),
      node("risks", "Risks", -340, 0, "risk"),
      node("metrics", "Success metrics", -300, -160, "note"),
      node("launch", "Launch plan", 0, -240, "milestone"),
    ],
    edges: [
      edge("feature-requirements", "feature", "requirements"),
      edge("feature-users", "feature", "users"),
      edge("feature-scope", "feature", "scope"),
      edge("feature-tasks", "feature", "tasks"),
      edge("feature-risks", "feature", "risks"),
      edge("feature-metrics", "feature", "metrics"),
      edge("feature-launch", "feature", "launch"),
    ],
  },
  {
    id: "bug-investigation",
    title: "Bug investigation",
    description: "Track a bug from symptom to verified fix.",
    defaultView: "flowchart",
    nodes: [
      node("symptom", "Symptom report", 0, 0, "note"),
      node("reproduce", "Reproduce reliably", 240, 0, "task_candidate"),
      node("hypothesis", "Root-cause hypothesis", 480, 0, "idea"),
      node("evidence", "Evidence & logs", 720, 0, "reference"),
      node("fix", "Fix", 960, 0, "task_candidate"),
      node("verify", "Verify in prod", 1200, 0, "milestone"),
      node("regression", "Regression test", 960, 180, "task_candidate"),
    ],
    edges: [
      edge("symptom-reproduce", "symptom", "reproduce", "sequence"),
      edge("reproduce-hypothesis", "reproduce", "hypothesis", "sequence"),
      edge("hypothesis-evidence", "hypothesis", "evidence", "sequence"),
      edge("evidence-fix", "evidence", "fix", "sequence"),
      edge("fix-verify", "fix", "verify", "sequence"),
      edge("fix-regression", "fix", "regression"),
    ],
  },
  {
    id: "launch-flow",
    title: "Launch flow",
    description: "Coordinate launch steps, dependencies, approvals, and follow-up.",
    defaultView: "flowchart",
    nodes: [
      node("checklist", "Launch checklist", 0, 0, "task_candidate"),
      node("dependencies", "Dependencies clear", 250, 0, "reference"),
      node("approval", "Go / no-go", 500, 0, "decision"),
      node("deploy", "Deploy", 750, 0, "milestone"),
      node("announce", "Announce", 1000, 0, "task_candidate"),
      node("follow-up", "Follow-up review", 1250, 0, "note"),
      node("rollback", "Rollback plan", 750, 180, "risk"),
    ],
    edges: [
      edge("checklist-dependencies", "checklist", "dependencies", "sequence"),
      edge("dependencies-approval", "dependencies", "approval", "sequence"),
      edge("approval-deploy", "approval", "deploy", "sequence"),
      edge("deploy-announce", "deploy", "announce", "sequence"),
      edge("announce-follow-up", "announce", "follow-up", "sequence"),
      edge("deploy-rollback", "deploy", "rollback"),
    ],
  },
  {
    id: "product-roadmap",
    title: "Product roadmap",
    description: "Plan product themes, milestones, and candidate tasks over time.",
    defaultView: "timeline",
    nodes: [
      node("theme", "Theme", 0, 0, "idea"),
      node("now", "Now", 260, -120, "milestone"),
      node("next", "Next", 520, 0, "milestone"),
      node("later", "Later", 780, 120, "milestone"),
      node("candidates", "Candidate tasks", 1040, 0, "task_candidate"),
      node("bets", "Open bets", 520, 200, "option"),
    ],
    edges: [
      edge("theme-now", "theme", "now", "sequence"),
      edge("now-next", "now", "next", "sequence"),
      edge("next-later", "next", "later", "sequence"),
      edge("later-candidates", "later", "candidates", "sequence"),
      edge("next-bets", "next", "bets"),
    ],
  },
  {
    id: "decision-tree",
    title: "Decision tree",
    description: "Compare options and track outcomes from a decision point.",
    defaultView: "decision_tree",
    nodes: [
      node("decision", "Decision", 0, 0, "decision"),
      node("option-a", "Option A", 300, -160, "option"),
      node("option-b", "Option B", 300, 0, "option"),
      node("option-c", "Option C", 300, 160, "option"),
      node("outcome-a", "Outcome if A", 620, -80, "milestone"),
      node("outcome-b", "Outcome if B/C", 620, 100, "milestone"),
    ],
    edges: [
      edge("decision-option-a", "decision", "option-a", "choice"),
      edge("decision-option-b", "decision", "option-b", "choice"),
      edge("decision-option-c", "decision", "option-c", "choice"),
      edge("option-a-outcome-a", "option-a", "outcome-a", "outcome"),
      edge("option-b-outcome-b", "option-b", "outcome-b", "outcome"),
      edge("option-c-outcome-b", "option-c", "outcome-b", "outcome"),
    ],
  },
  {
    id: "meeting-brainstorm",
    title: "Meeting brainstorm",
    description: "Capture a meeting topic, decisions, and follow-up actions.",
    defaultView: "mind_map",
    nodes: [
      node("topic", "Topic", 0, 0, "idea"),
      node("ideas", "Ideas", 280, -150, "idea"),
      node("decisions", "Decisions", 320, 30, "decision"),
      node("actions", "Actions", 280, 200, "task_candidate"),
      node("questions", "Open questions", -300, 30, "note"),
    ],
    edges: [
      edge("topic-ideas", "topic", "ideas"),
      edge("topic-decisions", "topic", "decisions"),
      edge("topic-actions", "topic", "actions"),
      edge("topic-questions", "topic", "questions"),
    ],
  },
];

export const mapTemplates: MapTemplate[] = deepFreeze(templateCatalog);

export function createMapFromTemplate(templateId: string, context: TemplateContext = {}): EditableMapGraph {
  const template = mapTemplates.find((item) => item.id === templateId) ?? mapTemplates[0];
  return {
    title: template.title,
    description: template.description,
    defaultView: template.defaultView,
    nodes: template.nodes.map((item) => ({ ...item, projectId: context.projectId ?? null, position: { ...item.position }, tags: [...item.tags] })),
    edges: template.edges.map((item) => ({ ...item })),
  };
}
