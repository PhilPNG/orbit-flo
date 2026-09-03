import type { User } from "@supabase/supabase-js";
import type { Database } from "../lib/supabase/database.types";
import type { BoardColumn } from "../features/work-items/board-columns.queries";
import type {
  Attachment,
  ChecklistItem,
  Label,
  WorkItemComment,
  WorkItemMeta,
} from "../features/work-items/work-item-details.queries";
import { createMapFromTemplate } from "../features/maps/map-templates";
import { defaultProjectRituals } from "../features/projects/project-rituals.queries";

export const visualScreenIds = [
  "01-inbox",
  "02-maps-library",
  "03-maps-mind-map",
  "04-missions",
  "05-auth",
  "06-brainstorm",
  "07-settings",
  "08-mission-workspace-board",
  "09-today",
  "10-task-card-modal",
] as const;

export type VisualScreenId = (typeof visualScreenIds)[number];

type Tables = Database["public"]["Tables"];
export type VisualWorkItem = Tables["work_items"]["Row"];

export const visualWorkspaceId = "visual-workspace";
export const visualProjectId = "565da75a-788c-4493-9fd0-e029f2a6259a";
export const visualUserId = "visual-user";
export const visualToday = "2026-07-12";
const timestamp = "2026-07-12T12:00:00.000Z";

export const visualUser: User = {
  id: visualUserId,
  app_metadata: { provider: "email", providers: ["email"] },
  user_metadata: {},
  aud: "authenticated",
  created_at: "2026-07-01T12:00:00.000Z",
  email: "philiprrodriguez@gmail.com",
};

export const pocketPupProject: Tables["projects"]["Row"] = {
  id: visualProjectId,
  workspace_id: visualWorkspaceId,
  name: "PocketPup",
  description: "Digital dog care app",
  status: "active",
  priority: "medium",
  health: "good",
  color: null,
  rituals_title: null,
  is_favorite: false,
  created_by: visualUserId,
  created_at: "2026-07-01T12:00:00.000Z",
  updated_at: timestamp,
};

function workItem(
  id: string,
  input: Pick<
    VisualWorkItem,
    "title" | "description" | "status" | "priority" | "column_id"
  > &
    Partial<VisualWorkItem>,
): VisualWorkItem {
  const { column_id, description, priority, status, title, ...overrides } = input;

  return {
    id,
    workspace_id: visualWorkspaceId,
    project_id: visualProjectId,
    milestone_id: null,
    assigned_to: null,
    recurrence_rule_id: null,
    occurrence_date: null,
    column_id,
    planned_at: null,
    planned_minutes: null,
    title,
    description,
    status,
    priority,
    due_date: null,
    estimate_points: null,
    sort_order: 0,
    blocked_reason: null,
    created_by: visualUserId,
    created_at: "2026-07-08T12:00:00.000Z",
    updated_at: timestamp,
    completed_at: null,
    ...overrides,
  };
}

function column(
  id: string,
  title: string,
  statusCategory: BoardColumn["status_category"],
  sortOrder: number,
): BoardColumn {
  return {
    id,
    workspace_id: visualWorkspaceId,
    project_id: visualProjectId,
    title,
    status_category: statusCategory,
    sort_order: sortOrder,
    created_by: visualUserId,
    created_at: "2026-07-08T12:00:00.000Z",
    updated_at: timestamp,
  };
}

export const visualBoardColumns: BoardColumn[] = [
  column("col-docked", "Docked", "backlog", 0),
  column("col-ready", "Ready to Launch", "ready", 1),
  column("col-launching", "Launching", "in_progress", 2),
  column("col-signal-lost", "Signal Lost", "blocked", 3),
  column("col-in-orbit", "In Orbit", "review", 4),
];

export const visualBoardItems: VisualWorkItem[] = [
  workItem("task-polish", {
    column_id: "col-docked",
    title: "Polish the release path",
    description: "Handle loading, error, mobile, and accessibility states before shipping.",
    status: "backlog",
    priority: "medium",
    sort_order: 0,
  }),
  workItem("task-define", {
    column_id: "col-ready",
    title: "Define the smallest useful version",
    description: "Write the user outcome and what is intentionally out of scope.",
    status: "ready",
    priority: "medium",
    due_date: "2026-07-18",
    sort_order: 0,
  }),
  workItem("task-build", {
    column_id: "col-launching",
    title: "Build the first usable slice",
    description: "Implement the core interaction with real data and empty states.",
    status: "in_progress",
    priority: "high",
    sort_order: 0,
  }),
  workItem("task-test", {
    column_id: "col-in-orbit",
    title: "Test",
    description: null,
    status: "review",
    priority: "medium",
    sort_order: 0,
  }),
];

export const visualTask = workItem("task-define", {
  column_id: "col-ready",
  title: "Define the smallest useful version",
  description: "Write the user outcome and what is intentionally out of scope.",
  status: "ready",
  priority: "medium",
  due_date: "2026-07-18",
  milestone_id: "milestone-launch-v1",
  assigned_to: null,
  blocked_reason: "None",
});

export const visualMilestones: Tables["milestones"]["Row"][] = [
  {
    id: "milestone-launch-v1",
    workspace_id: visualWorkspaceId,
    project_id: visualProjectId,
    title: "Launch v1",
    description: "Ship the smallest useful release.",
    target_date: "2026-07-18",
    completed_at: null,
    sort_order: 0,
    created_by: visualUserId,
    created_at: timestamp,
    updated_at: timestamp,
  },
];

export const visualLabels: Label[] = [
  {
    id: "label-mvp",
    workspace_id: visualWorkspaceId,
    project_id: visualProjectId,
    name: "MVP",
    color: "cyan",
    created_by: visualUserId,
    created_at: timestamp,
    updated_at: timestamp,
  },
  {
    id: "label-product",
    workspace_id: visualWorkspaceId,
    project_id: visualProjectId,
    name: "Product",
    color: "violet",
    created_by: visualUserId,
    created_at: timestamp,
    updated_at: timestamp,
  },
];

export const visualChecklist: ChecklistItem[] = [
  ["check-outcome", "Define the user outcome", true],
  ["check-workflow", "Confirm the smallest workflow", true],
  ["check-states", "Capture empty and error states", false],
  ["check-acceptance", "Write acceptance criteria", false],
].map(([id, title, isDone], index) => ({
  id: id as string,
  workspace_id: visualWorkspaceId,
  work_item_id: visualTask.id,
  title: title as string,
  is_done: isDone as boolean,
  sort_order: index,
  created_by: visualUserId,
  created_at: timestamp,
  updated_at: timestamp,
}));

export const visualAttachments: Attachment[] = [
  {
    id: "attachment-scope-outline",
    workspace_id: visualWorkspaceId,
    work_item_id: visualTask.id,
    file_name: "scope-outline.pdf",
    storage_path: `${visualWorkspaceId}/${visualTask.id}/scope-outline.pdf`,
    mime_type: "application/pdf",
    size_bytes: 438272,
    created_by: visualUserId,
    created_at: timestamp,
  },
];

export const visualComments: WorkItemComment[] = [
  {
    id: "comment-approved",
    workspace_id: visualWorkspaceId,
    work_item_id: visualTask.id,
    body: "Keep the first release intentionally small; validate the core loop before adding automation.",
    created_by: visualUserId,
    created_at: timestamp,
    updated_at: timestamp,
  },
];

export const visualBoardMeta: WorkItemMeta = {
  labelsByItem: new Map([
    ["task-polish", [visualLabels[1]]],
    ["task-define", visualLabels],
    ["task-build", [visualLabels[0]]],
    ["task-test", [visualLabels[1]]],
  ]),
  checklistByItem: new Map([
    ["task-polish", { done: 2, total: 4 }],
    ["task-define", { done: 2, total: 4 }],
    ["task-build", { done: 1, total: 3 }],
    ["task-test", { done: 3, total: 3 }],
  ]),
  commentCountByItem: new Map([
    ["task-polish", 2],
    ["task-define", 1],
    ["task-build", 1],
    ["task-test", 1],
  ]),
  attachmentCountByItem: new Map([
    ["task-polish", 1],
    ["task-define", 1],
    ["task-build", 1],
    ["task-test", 1],
  ]),
};

export const visualRituals: Tables["project_rituals"]["Row"][] =
  defaultProjectRituals.map((title, index) => ({
    id: `ritual-${index + 1}`,
    workspace_id: visualWorkspaceId,
    project_id: visualProjectId,
    title,
    is_done: false,
    sort_order: index,
    created_by: visualUserId,
    created_at: timestamp,
    updated_at: timestamp,
  }));

export const visualMindMap = createMapFromTemplate("feature-plan", {
  projectId: visualProjectId,
});

export const visualMapId = "8a1f7c1e-6d2b-4c0e-9f3a-2b5d6e7f8a90";

export const visualMapRow: Tables["mind_maps"]["Row"] = {
  id: visualMapId,
  workspace_id: visualWorkspaceId,
  project_id: null,
  title: "Feature plan",
  description: "",
  default_view: "mind_map",
  created_by: visualUserId,
  created_at: "2026-07-01T12:00:00.000Z",
  updated_at: timestamp,
  archived_at: null,
};

export const visualMapRows: Tables["mind_maps"]["Row"][] = [
  visualMapRow,
  { ...visualMapRow, id: "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e", title: "Launch flow", updated_at: "2026-07-11T09:00:00.000Z" },
  { ...visualMapRow, id: "c3d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7f", title: "Q3 decision", updated_at: "2026-07-09T18:30:00.000Z" },
];

export const visualMapPreviews = Object.fromEntries(
  [
    [visualMapRows[0].id, createMapFromTemplate("feature-plan", { projectId: null })],
    [visualMapRows[1].id, createMapFromTemplate("launch-flow", { projectId: null })],
    [visualMapRows[2].id, createMapFromTemplate("decision-tree", { projectId: null })],
  ].map(([id, graph]) => [
    id,
    {
      nodes: (graph as typeof visualMindMap).nodes.map((node) => ({ id: node.id, position: node.position, nodeType: node.nodeType })),
      edges: (graph as typeof visualMindMap).edges.map((edge) => ({ id: edge.id, sourceNodeId: edge.sourceNodeId, targetNodeId: edge.targetNodeId })),
    },
  ]),
);

export const visualTodaySuggestions: VisualWorkItem[] = [
  workItem("suggestion-1", {
    column_id: "col-ready",
    title: "Define the smallest useful version",
    description: "Write the user outcome and what is intentionally out of scope.",
    status: "ready",
    priority: "critical",
    due_date: "2026-07-11",
  }),
  workItem("suggestion-2", {
    column_id: "col-docked",
    title: "Polish the release path",
    description: "Handle loading, error, mobile, and accessibility states before shipping.",
    status: "backlog",
    priority: "high",
    due_date: visualToday,
  }),
  workItem("suggestion-3", {
    column_id: "col-launching",
    title: "Build the first usable slice",
    description: "Implement the core interaction with real data and empty states.",
    status: "in_progress",
    priority: "high",
  }),
  workItem("suggestion-4", {
    column_id: "col-in-orbit",
    title: "Test",
    description: null,
    status: "review",
    priority: "medium",
  }),
];
